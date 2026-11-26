package socialinspect

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"
)

const (
	maxInspectBody = 1 << 20         // 1 MiB
	maxAssetBytes  = 8 * 1024 * 1024 // 8 MiB
	assetTimeout   = 10 * time.Second
	assetUserAgent = "Mozilla/5.0 (compatible; social-inspect/1.0)"
)

var errInspectBodyTooLarge = errors.New("Request body exceeds 1 MB")
var errAssetTooLarge = errors.New("Asset exceeds 8 MB")

type inspectHandler struct {
	client *http.Client
}

// NewHandler returns a single http.Handler serving both /api/inspect (POST)
// and /api/asset (GET). Every other path receives a JSON 404.
func NewHandler(client *http.Client) http.Handler {
	if client == nil {
		client = http.DefaultClient
	}
	return &inspectHandler{client: client}
}

func marshalJSON(value any) ([]byte, error) {
	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		return nil, err
	}
	return bytes.TrimRight(buffer.Bytes(), "\n"), nil
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	data, err := marshalJSON(value)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error":"Internal server error"}`))
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_, _ = w.Write(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func writeMethodError(w http.ResponseWriter, allow string) {
	w.Header().Set("Allow", allow)
	writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
}

func (h *inspectHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Path {
	case "/api/inspect":
		if r.Method != http.MethodPost {
			writeMethodError(w, http.MethodPost)
			return
		}
		h.handleInspect(w, r)
	case "/api/asset":
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Content-Security-Policy", "sandbox")
		if r.Method != http.MethodGet {
			writeMethodError(w, http.MethodGet)
			return
		}
		h.handleAsset(w, r)
	default:
		writeError(w, http.StatusNotFound, "Not found")
	}
}

type inspectBody struct {
	URL          string `json:"url"`
	AllowPrivate *bool  `json:"allowPrivate"`
}

func decodeInspectBody(body io.Reader) (inspectBody, error) {
	var payload inspectBody
	data, err := io.ReadAll(io.LimitReader(body, maxInspectBody+1))
	if err != nil {
		return payload, errors.New("Invalid JSON")
	}
	if len(data) > maxInspectBody {
		return payload, errInspectBodyTooLarge
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		return payload, errors.New("Invalid JSON")
	}
	return payload, nil
}

func (h *inspectHandler) handleInspect(w http.ResponseWriter, r *http.Request) {
	payload, err := decodeInspectBody(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if payload.URL == "" {
		writeError(w, http.StatusBadRequest, "A url is required.")
		return
	}

	// The HTTP route allows local targets by default, as in the TS route.
	allowPrivate := true
	if payload.AllowPrivate != nil {
		allowPrivate = *payload.AllowPrivate
	}

	report, err := Inspect(h.client, r.Context(), payload.URL, allowPrivate)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, report)
}

func (h *inspectHandler) handleAsset(w http.ResponseWriter, r *http.Request) {
	target, err := normalizeTarget(r.URL.Query().Get("url"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), assetTimeout)
	defer cancel()

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, target.URL, nil)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	request.Header.Set("User-Agent", assetUserAgent)
	request.Header.Set("Accept", "image/*,*/*;q=0.8")

	response, err := h.client.Do(request)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		writeError(w, http.StatusBadGateway, "Upstream request failed")
		return
	}

	data, err := readAllContext(ctx, io.LimitReader(response.Body, maxAssetBytes+1))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if len(data) > maxAssetBytes {
		writeError(w, http.StatusRequestEntityTooLarge, errAssetTooLarge.Error())
		return
	}

	contentType := response.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}
