package socialinspect

import (
	"bytes"
	"context"
	"encoding/binary"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	defaultUserAgent = "Mozilla/5.0 (compatible; social-inspect/1.0; +https://github.com/tigawanna/social-inspect)"
	pageTimeout      = 10 * time.Second
	imageTimeout     = 8 * time.Second
)

// readAllContext reads a body while checking cancellation between chunks.
func readAllContext(ctx context.Context, reader io.Reader) ([]byte, error) {
	var buffer bytes.Buffer
	chunk := make([]byte, 32*1024)
	for {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		n, err := reader.Read(chunk)
		if n > 0 {
			buffer.Write(chunk[:n])
		}
		if err == io.EOF {
			return buffer.Bytes(), nil
		}
		if err != nil {
			return nil, err
		}
	}
}

// Inspect fetches a URL and returns normalized metadata plus its analysis.
func Inspect(client *http.Client, ctx context.Context, rawURL string, allowPrivate bool) (Report, error) {
	if client == nil {
		client = http.DefaultClient
	}
	if ctx == nil {
		ctx = context.Background()
	}

	target, err := normalizeTarget(rawURL)
	if err != nil {
		return Report{}, err
	}
	if err := assertFetchAllowed(target, allowPrivate); err != nil {
		return Report{}, err
	}

	requestCtx, cancel := context.WithTimeout(ctx, pageTimeout)
	defer cancel()

	request, err := http.NewRequestWithContext(requestCtx, http.MethodGet, target.URL, nil)
	if err != nil {
		return Report{}, fmt.Errorf("Could not fetch %s: %v", target.URL, err)
	}
	request.Header.Set("User-Agent", defaultUserAgent)
	request.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")

	started := time.Now()
	response, err := client.Do(request)
	if err != nil {
		return Report{}, fmt.Errorf("Could not fetch %s: %v", target.URL, err)
	}
	defer response.Body.Close()

	body, err := readAllContext(requestCtx, response.Body)
	if err != nil {
		return Report{}, fmt.Errorf("Could not fetch %s: %v", target.URL, err)
	}
	elapsed := math.Round(float64(time.Since(started)) / float64(time.Millisecond))

	finalURL := target.URL
	if response.Request != nil && response.Request.URL != nil {
		if candidate := response.Request.URL.String(); candidate != "" {
			finalURL = candidate
		}
	}
	fetchedAt := time.Now().UTC().Format("2006-01-02T15:04:05.000Z")

	report := ParseDocument(finalURL, response.StatusCode, int64(elapsed), fetchedAt, body)
	report.URL = target.URL
	Analyze(&report)

	imageValue := mapValue(report.OG, "image")
	if imageValue == nil {
		imageValue = mapValue(report.Twitter, "image")
	}
	if imageValue != nil {
		if imageURL := resolveAsset(finalURL, *imageValue); imageURL != nil {
			report.OGImageInfo = inspectImage(client, ctx, *imageURL)
		}
	}
	return report, nil
}

// inspectImage returns best-effort metadata for the share image. Fetch or
// decode failures produce an empty ImageInfo, serialized as {}.
func inspectImage(client *http.Client, ctx context.Context, imageURL string) *ImageInfo {
	requestCtx, cancel := context.WithTimeout(ctx, imageTimeout)
	defer cancel()

	request, err := http.NewRequestWithContext(requestCtx, http.MethodGet, imageURL, nil)
	if err != nil {
		return &ImageInfo{}
	}
	request.Header.Set("User-Agent", defaultUserAgent)
	response, err := client.Do(request)
	if err != nil {
		return &ImageInfo{}
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return &ImageInfo{}
	}

	data, err := readAllContext(requestCtx, response.Body)
	if err != nil {
		return &ImageInfo{}
	}
	contentType := response.Header.Get("Content-Type")
	if contentType != "" {
		value := strings.Split(contentType, ";")[0]
		if value != "" {
			return imageInfoFromBytes(data, &value)
		}
	}
	return imageInfoFromBytes(data, nil)
}

func imageInfoFromBytes(data []byte, contentType *string) *ImageInfo {
	length := int64(len(data))
	info := &ImageInfo{Bytes: &length, Type: contentType}
	if width, height, ok := decodeDimensions(data); ok {
		info.Width = &width
		info.Height = &height
	}
	return info
}

// decodeDimensions uses the standard PNG/JPEG/GIF decoders and lightweight
// header parsing for SVG and ICO, whose formats the standard library does not
// register with image.DecodeConfig.
func decodeDimensions(data []byte) (int, int, bool) {
	if config, _, err := image.DecodeConfig(bytes.NewReader(data)); err == nil && config.Width > 0 && config.Height > 0 {
		return config.Width, config.Height, true
	}
	if width, height, ok := svgDimensions(data); ok {
		return width, height, true
	}
	if width, height, ok := icoDimensions(data); ok {
		return width, height, true
	}
	return 0, 0, false
}

// svgDimensions reads width/height (or the viewBox fallback) from the root
// <svg> tag without using regular expressions.
func svgDimensions(data []byte) (int, int, bool) {
	start := bytes.Index(data, []byte("<svg"))
	if start < 0 {
		return 0, 0, false
	}
	end := bytes.IndexByte(data[start:], '>')
	if end < 0 {
		return 0, 0, false
	}
	tag := data[start : start+end]

	var width, height, viewBox string
	for i := 0; i < len(tag); {
		for i < len(tag) && (tag[i] == ' ' || tag[i] == '\t' || tag[i] == '\n' || tag[i] == '\r') {
			i++
		}
		nameStart := i
		for i < len(tag) && tag[i] != '=' && tag[i] != ' ' && tag[i] != '\t' && tag[i] != '\n' && tag[i] != '\r' {
			i++
		}
		name := string(tag[nameStart:i])
		for i < len(tag) && (tag[i] == ' ' || tag[i] == '\t' || tag[i] == '\n' || tag[i] == '\r') {
			i++
		}
		if i >= len(tag) || tag[i] != '=' {
			continue
		}
		i++
		for i < len(tag) && (tag[i] == ' ' || tag[i] == '\t' || tag[i] == '\n' || tag[i] == '\r') {
			i++
		}
		if i >= len(tag) || (tag[i] != '"' && tag[i] != '\'') {
			continue
		}
		quote := tag[i]
		i++
		valueStart := i
		for i < len(tag) && tag[i] != quote {
			i++
		}
		value := string(tag[valueStart:i])
		if i < len(tag) {
			i++
		}
		switch name {
		case "width":
			width = value
		case "height":
			height = value
		case "viewBox":
			viewBox = value
		}
	}

	if w, ok := parseLeadingInt(width); ok {
		if h, ok2 := parseLeadingInt(height); ok2 {
			return w, h, true
		}
	}
	fields := strings.FieldsFunc(viewBox, func(r rune) bool {
		return r == ' ' || r == '\t' || r == '\n' || r == '\r' || r == ','
	})
	if len(fields) >= 4 {
		w, okW := parseLeadingInt(fields[2])
		h, okH := parseLeadingInt(fields[3])
		if okW && okH {
			return w, h, true
		}
	}
	return 0, 0, false
}

func parseLeadingInt(value string) (int, bool) {
	value = strings.TrimSpace(value)
	i := 0
	if i < len(value) && (value[i] == '+' || value[i] == '-') {
		i++
	}
	start := i
	for i < len(value) && value[i] >= '0' && value[i] <= '9' {
		i++
	}
	if i == start {
		return 0, false
	}
	parsed, err := strconv.Atoi(value[:i])
	if err != nil || parsed < 0 {
		return 0, false
	}
	return parsed, true
}

// icoDimensions reads the first directory entry of an ICO file. A zero byte in
// the width/height field means 256 pixels.
func icoDimensions(data []byte) (int, int, bool) {
	if len(data) < 22 {
		return 0, 0, false
	}
	if binary.LittleEndian.Uint16(data[0:2]) != 0 || binary.LittleEndian.Uint16(data[2:4]) != 1 {
		return 0, 0, false
	}
	if binary.LittleEndian.Uint16(data[4:6]) == 0 {
		return 0, 0, false
	}
	width := int(data[6])
	height := int(data[7])
	if width == 0 {
		width = 256
	}
	if height == 0 {
		height = 256
	}
	return width, height, true
}
