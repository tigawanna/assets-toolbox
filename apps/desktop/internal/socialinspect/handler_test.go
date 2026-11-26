package socialinspect

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func newUpstream(t *testing.T) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("/page", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		_, _ = w.Write([]byte(`<title>Handler page</title><meta property="og:title" content="Handler OG">`))
	})
	mux.HandleFunc("/ok.png", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/webp")
		_, _ = w.Write([]byte("image-bytes"))
	})
	mux.HandleFunc("/fail", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("boom"))
	})
	mux.HandleFunc("/big", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write(bytes.Repeat([]byte("x"), maxAssetBytes+1))
	})
	return httptest.NewServer(mux)
}

func serve(handler http.Handler, method, target, body string) *httptest.ResponseRecorder {
	var reader *strings.Reader
	if body == "" {
		reader = strings.NewReader("")
	} else {
		reader = strings.NewReader(body)
	}
	request := httptest.NewRequest(method, target, reader)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	return recorder
}

func assertJSONError(t *testing.T, recorder *httptest.ResponseRecorder, status int, message string) {
	t.Helper()
	if recorder.Code != status {
		t.Fatalf("status = %d, want %d (body %s)", recorder.Code, status, recorder.Body.String())
	}
	var payload map[string]string
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("response is not JSON: %q", recorder.Body.String())
	}
	if payload["error"] != message {
		t.Fatalf("error = %q, want %q", payload["error"], message)
	}
}

func TestHandlerInspectEndpoint(t *testing.T) {
	upstream := newUpstream(t)
	defer upstream.Close()
	handler := NewHandler(upstream.Client())

	body, err := json.Marshal(map[string]any{"url": upstream.URL + "/page"})
	if err != nil {
		t.Fatal(err)
	}
	recorder := serve(handler, http.MethodPost, "/api/inspect", string(body))
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var report Report
	if err := json.Unmarshal(recorder.Body.Bytes(), &report); err != nil {
		t.Fatal(err)
	}
	if report.Title == nil || *report.Title != "Handler OG" {
		t.Fatalf("title = %v", report.Title)
	}
	if report.OG["title"] != "Handler OG" {
		t.Fatalf("og = %#v", report.OG)
	}

	assertJSONError(t, serve(handler, http.MethodPost, "/api/inspect", `{}`),
		http.StatusBadRequest, "A url is required.")
	assertJSONError(t, serve(handler, http.MethodPost, "/api/inspect", `{`),
		http.StatusBadRequest, "Invalid JSON")
	assertJSONError(t, serve(handler, http.MethodPost, "/api/inspect", `{"url":"ftp://example.com"}`),
		http.StatusBadRequest, "Unsupported protocol: ftp:")
	assertJSONError(t, serve(handler, http.MethodPost, "/api/inspect", strings.Repeat("x", maxInspectBody+1)),
		http.StatusBadRequest, "Request body exceeds 1 MB")
}

func TestHandlerAssetEndpoint(t *testing.T) {
	upstream := newUpstream(t)
	defer upstream.Close()
	handler := NewHandler(upstream.Client())

	recorder := serve(handler, http.MethodGet, "/api/asset?url="+upstream.URL+"/ok.png", "")
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	if recorder.Body.String() != "image-bytes" {
		t.Fatalf("body = %q", recorder.Body.String())
	}
	if got := recorder.Header().Get("Content-Type"); got != "image/webp" {
		t.Fatalf("content type = %q", got)
	}
	if got := recorder.Header().Get("Cache-Control"); got != "public, max-age=3600" {
		t.Fatalf("cache control = %q", got)
	}
	if got := recorder.Header().Get("X-Content-Type-Options"); got != "nosniff" {
		t.Fatalf("nosniff = %q", got)
	}
	if got := recorder.Header().Get("Content-Security-Policy"); got != "sandbox" {
		t.Fatalf("csp = %q", got)
	}

	assertJSONError(t, serve(handler, http.MethodGet, "/api/asset?url="+upstream.URL+"/fail", ""),
		http.StatusBadGateway, "Upstream request failed")
	assertJSONError(t, serve(handler, http.MethodGet, "/api/asset?url="+upstream.URL+"/big", ""),
		http.StatusRequestEntityTooLarge, "Asset exceeds 8 MB")
	assertJSONError(t, serve(handler, http.MethodGet, "/api/asset?url=", ""),
		http.StatusBadRequest, "URL is empty")
	assertJSONError(t, serve(handler, http.MethodGet, "/api/asset?url=ftp%3A%2F%2Fexample.com", ""),
		http.StatusBadRequest, "Unsupported protocol: ftp:")
}

func TestHandlerRoutingAndMethods(t *testing.T) {
	handler := NewHandler(nil)

	assertJSONError(t, serve(handler, http.MethodGet, "/api/unknown", ""),
		http.StatusNotFound, "Not found")
	assertJSONError(t, serve(handler, http.MethodGet, "/", ""),
		http.StatusNotFound, "Not found")
	assertJSONError(t, serve(handler, http.MethodGet, "/api/inspect/", ""),
		http.StatusNotFound, "Not found")

	recorder := serve(handler, http.MethodGet, "/api/inspect", "")
	assertJSONError(t, recorder, http.StatusMethodNotAllowed, "Method not allowed")
	if recorder.Header().Get("Allow") != "POST" {
		t.Fatalf("Allow = %q", recorder.Header().Get("Allow"))
	}

	recorder = serve(handler, http.MethodPost, "/api/asset", "")
	assertJSONError(t, recorder, http.StatusMethodNotAllowed, "Method not allowed")
	if recorder.Header().Get("Allow") != "GET" {
		t.Fatalf("Allow = %q", recorder.Header().Get("Allow"))
	}
}
