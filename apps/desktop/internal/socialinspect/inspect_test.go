package socialinspect

import (
	"bytes"
	"context"
	"encoding/binary"
	"image"
	"image/color"
	"image/png"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func testPNG(t *testing.T, width, height int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			img.Set(x, y, color.RGBA{R: 200, G: 100, B: 50, A: 255})
		}
	}
	var buffer bytes.Buffer
	if err := png.Encode(&buffer, img); err != nil {
		t.Fatal(err)
	}
	return buffer.Bytes()
}

func newInspectServer(t *testing.T) *httptest.Server {
	t.Helper()
	pngBytes := testPNG(t, 4, 3)
	mux := http.NewServeMux()
	mux.HandleFunc("/page", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(`<html><head><title>Hello</title><meta name="description" content="Desc">` +
			`<meta property="og:title" content="OG Title"><meta property="og:image" content="/img.png">` +
			`<link rel="icon" href="/favicon.png"></head><body>Body</body></html>`))
	})
	mux.HandleFunc("/img.png", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write(pngBytes)
	})
	mux.HandleFunc("/redirect", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/page", http.StatusFound)
	})
	mux.HandleFunc("/missing", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`<html><head><title>Missing page</title></head><body>Not here</body></html>`))
	})
	mux.HandleFunc("/badimgpage", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`<meta property="og:image" content="/badimage">`))
	})
	mux.HandleFunc("/badimage", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})
	mux.HandleFunc("/unknownpage", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`<meta property="og:image" content="/unknown.png">`))
	})
	mux.HandleFunc("/twitterpage", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`<meta name="twitter:image" content="/img.png">`))
	})
	mux.HandleFunc("/unknown.png", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png; charset=binary")
		_, _ = w.Write([]byte("not really a png"))
	})
	return httptest.NewServer(mux)
}

func TestInspectPageAndImage(t *testing.T) {
	server := newInspectServer(t)
	defer server.Close()

	report, err := Inspect(server.Client(), context.Background(), server.URL+"/page", true)
	if err != nil {
		t.Fatal(err)
	}
	if report.URL != server.URL+"/page" || report.FinalURL != server.URL+"/page" {
		t.Fatalf("urls = %q / %q", report.URL, report.FinalURL)
	}
	if report.Status != 200 || report.HTMLSizeBytes == 0 {
		t.Fatalf("status/size = %d/%d", report.Status, report.HTMLSizeBytes)
	}
	if report.ResponseTimeMs < 0 {
		t.Fatalf("responseTimeMs = %d", report.ResponseTimeMs)
	}
	if _, err := time.Parse("2006-01-02T15:04:05.000Z", report.FetchedAt); err != nil {
		t.Fatalf("fetchedAt %q: %v", report.FetchedAt, err)
	}
	// og:title takes precedence over the <title> element.
	if report.Title == nil || *report.Title != "OG Title" {
		t.Fatalf("title = %v", report.Title)
	}
	if report.OG["title"] != "OG Title" || report.OG["image"] != "/img.png" {
		t.Fatalf("og = %#v", report.OG)
	}
	if len(report.Favicons) != 1 {
		t.Fatalf("favicons = %#v", report.Favicons)
	}
	if report.Analysis.Score == 0 || len(report.Analysis.Checks) != 11 {
		t.Fatalf("analysis = %#v", report.Analysis)
	}
	info := report.OGImageInfo
	if info == nil || info.Width == nil || info.Height == nil || *info.Width != 4 || *info.Height != 3 {
		t.Fatalf("image info = %#v", info)
	}
	if info.Bytes == nil || *info.Bytes != int64(len(testPNG(t, 4, 3))) {
		t.Fatalf("image bytes = %v", info.Bytes)
	}
	if info.Type == nil || *info.Type != "image/png" {
		t.Fatalf("image type = %v", info.Type)
	}
}

func TestInspectRedirectAndNon2xx(t *testing.T) {
	server := newInspectServer(t)
	defer server.Close()

	report, err := Inspect(server.Client(), context.Background(), server.URL+"/redirect", true)
	if err != nil {
		t.Fatal(err)
	}
	if report.FinalURL != server.URL+"/page" {
		t.Fatalf("finalUrl = %q, want %q", report.FinalURL, server.URL+"/page")
	}
	if report.URL != server.URL+"/redirect" {
		t.Fatalf("url = %q", report.URL)
	}

	report, err = Inspect(server.Client(), context.Background(), server.URL+"/missing", true)
	if err != nil {
		t.Fatal(err)
	}
	if report.Status != http.StatusNotFound {
		t.Fatalf("status = %d", report.Status)
	}
	if report.Title == nil || *report.Title != "Missing page" {
		t.Fatalf("non-2xx page was not parsed: %#v", report.Title)
	}
}

func TestInspectImageFailures(t *testing.T) {
	server := newInspectServer(t)
	defer server.Close()

	report, err := Inspect(server.Client(), context.Background(), server.URL+"/badimgpage", true)
	if err != nil {
		t.Fatal(err)
	}
	if report.OGImageInfo == nil {
		t.Fatal("ogImageInfo should be {} for a failed image fetch")
	}
	if report.OGImageInfo.Width != nil || report.OGImageInfo.Height != nil ||
		report.OGImageInfo.Bytes != nil || report.OGImageInfo.Type != nil {
		t.Fatalf("failed image must be empty: %#v", report.OGImageInfo)
	}
	data, err := marshalJSON(report.OGImageInfo)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "{}" {
		t.Fatalf("failed image JSON = %s, want {}", data)
	}

	report, err = Inspect(server.Client(), context.Background(), server.URL+"/unknownpage", true)
	if err != nil {
		t.Fatal(err)
	}
	info := report.OGImageInfo
	if info == nil || info.Width != nil || info.Height != nil {
		t.Fatalf("unknown dimensions must be omitted: %#v", info)
	}
	if info.Bytes == nil || *info.Bytes != int64(len("not really a png")) {
		t.Fatalf("bytes must be preserved: %#v", info.Bytes)
	}
	if info.Type == nil || *info.Type != "image/png" {
		t.Fatalf("type must be preserved: %#v", info.Type)
	}
}

func TestInspectTwitterImageFallback(t *testing.T) {
	server := newInspectServer(t)
	defer server.Close()

	report, err := Inspect(server.Client(), context.Background(), server.URL+"/twitterpage", true)
	if err != nil {
		t.Fatal(err)
	}
	if report.OGImageInfo == nil || report.OGImageInfo.Width == nil || *report.OGImageInfo.Width != 4 {
		t.Fatalf("twitter:image should be used when og:image is absent: %#v", report.OGImageInfo)
	}
}

func TestInspectRejectsPrivateAndCancellation(t *testing.T) {
	server := newInspectServer(t)
	defer server.Close()

	_, err := Inspect(server.Client(), context.Background(), server.URL+"/page", false)
	if err == nil || !strings.Contains(err.Error(), "Refusing to fetch private/local address") {
		t.Fatalf("private guard error = %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err = Inspect(server.Client(), ctx, server.URL+"/page", true)
	if err == nil || !strings.Contains(err.Error(), "Could not fetch") {
		t.Fatalf("cancellation error = %v", err)
	}

	_, err = Inspect(server.Client(), context.Background(), "ftp://example.com", true)
	if err == nil || err.Error() != "Unsupported protocol: ftp:" {
		t.Fatalf("protocol error = %v", err)
	}
}

func TestDecodeSVGAndICO(t *testing.T) {
	svg := []byte(`<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="640px" height='480px'></svg>`)
	if width, height, ok := decodeDimensions(svg); !ok || width != 640 || height != 480 {
		t.Fatalf("svg dimensions = %d/%d/%v", width, height, ok)
	}

	viewBox := []byte(`<svg viewBox="0 0 1200 630"></svg>`)
	if width, height, ok := decodeDimensions(viewBox); !ok || width != 1200 || height != 630 {
		t.Fatalf("viewBox dimensions = %d/%d/%v", width, height, ok)
	}

	ico := make([]byte, 22)
	binary.LittleEndian.PutUint16(ico[2:4], 1)
	binary.LittleEndian.PutUint16(ico[4:6], 1)
	ico[6] = 0 // 256
	ico[7] = 32
	if width, height, ok := decodeDimensions(ico); !ok || width != 256 || height != 32 {
		t.Fatalf("ico dimensions = %d/%d/%v", width, height, ok)
	}

	if _, _, ok := decodeDimensions([]byte("plain text")); ok {
		t.Fatal("plain text must not decode as an image")
	}
}
