package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

func TestWorkspaceSaveAndReload(t *testing.T) {
	path := filepath.Join(t.TempDir(), "nested", "workspace.json")
	store := newWorkspaceStore(path)
	handler := store.handler()

	request := httptest.NewRequest(http.MethodPut, "/api/workspace", strings.NewReader(`{
		"name": "  Test drawing  ",
		"svg": "<rect width=\"10\" height=\"10\"/>",
		"viewport": { "zoom": 2, "tx": 12, "ty": -4 }
	}`))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), `<rect width=`) || strings.Contains(recorder.Body.String(), `&lt;rect`) {
		t.Fatalf("SVG was HTML-escaped in response: %s", recorder.Body.String())
	}

	var saved struct {
		Document WorkspaceDocument `json:"document"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &saved); err != nil {
		t.Fatal(err)
	}
	if saved.Document.ID != "draft" || saved.Document.Name != "Test drawing" {
		t.Fatalf("unexpected document metadata: %+v", saved.Document)
	}
	if saved.Document.Viewport.Zoom != 2 || saved.Document.Viewport.Tx != 12 || saved.Document.Viewport.Ty != -4 {
		t.Fatalf("unexpected viewport: %+v", saved.Document.Viewport)
	}

	reloaded, err := newWorkspaceStore(path).load()
	if err != nil {
		t.Fatal(err)
	}
	if reloaded == nil || reloaded.SVG != saved.Document.SVG {
		t.Fatalf("reloaded document = %+v", reloaded)
	}
}

func TestWorkspaceEmptyLoad(t *testing.T) {
	store := newWorkspaceStore(filepath.Join(t.TempDir(), "workspace.json"))
	recorder := httptest.NewRecorder()
	store.handler().ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/workspace", nil))

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d", recorder.Code)
	}
	if strings.TrimSpace(recorder.Body.String()) != `{"document":null}` {
		t.Fatalf("body = %q", recorder.Body.String())
	}
}

func TestWorkspaceValidation(t *testing.T) {
	store := newWorkspaceStore(filepath.Join(t.TempDir(), "workspace.json"))
	tests := []struct {
		name   string
		body   string
		status int
	}{
		{name: "invalid json", body: `{`, status: http.StatusBadRequest},
		{name: "missing svg", body: `{"name":"Draft"}`, status: http.StatusInternalServerError},
		{name: "non-string svg", body: `{"svg":42}`, status: http.StatusInternalServerError},
		{name: "non-finite viewport string", body: `{"svg":"<rect/>","viewport":{"zoom":"NaN","tx":0,"ty":0}}`, status: http.StatusOK},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			store.handler().ServeHTTP(recorder, httptest.NewRequest(http.MethodPut, "/api/workspace", strings.NewReader(test.body)))
			if recorder.Code != test.status {
				t.Fatalf("status = %d, want %d", recorder.Code, test.status)
			}
		})
	}
}

func TestWorkspaceMethodNotAllowed(t *testing.T) {
	store := newWorkspaceStore(filepath.Join(t.TempDir(), "workspace.json"))
	recorder := httptest.NewRecorder()
	store.handler().ServeHTTP(recorder, httptest.NewRequest(http.MethodDelete, "/api/workspace", nil))
	if recorder.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d", recorder.Code)
	}
}

func TestModuleMiddlewareInterceptsWorkspaceOnly(t *testing.T) {
	workspaceCalled := false
	nextCalled := false
	workspace := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		workspaceCalled = true
		w.WriteHeader(http.StatusNoContent)
	})
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusNotFound)
	})
	handler := newModuleMiddleware(workspace, next)

	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/api/workspace", nil))
	if !workspaceCalled || nextCalled {
		t.Fatalf("workspace called = %v, next called = %v", workspaceCalled, nextCalled)
	}

	workspaceCalled = false
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/packages/svg-compose", nil))
	if workspaceCalled || !nextCalled {
		t.Fatalf("workspace called = %v, next called = %v", workspaceCalled, nextCalled)
	}
}
