package main

import (
	"context"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"testing/fstest"
	"time"
)

func TestBeforeCloseWithoutWorkspace(t *testing.T) {
	app := NewApp()
	if app.beforeClose(context.Background()) {
		t.Fatal("beforeClose = true without an active module")
	}
}

func TestAcknowledgeFlushClosesChannel(t *testing.T) {
	app := NewApp()
	ack := make(chan bool, 1)
	app.flushRequests["workspace"] = flushRequest{id: 7, ack: ack}
	if !app.acknowledgeFlush("workspace", true, float64(7)) {
		t.Fatal("acknowledgement should succeed")
	}
	if len(app.flushRequests) != 0 {
		t.Fatal("flush request should be cleared after acknowledgement")
	}
	select {
	case succeeded := <-ack:
		if !succeeded {
			t.Fatal("flush acknowledgement should report success")
		}
	default:
		t.Fatal("flush acknowledgement channel was not signalled")
	}
}

func TestAcknowledgeFlushRejectsStaleRequestID(t *testing.T) {
	app := NewApp()
	ack := make(chan bool, 1)
	app.flushRequests["workspace"] = flushRequest{id: 8, ack: ack}
	if app.acknowledgeFlush("workspace", true, float64(7)) {
		t.Fatal("stale acknowledgement should not succeed")
	}
	if len(app.flushRequests) != 1 {
		t.Fatal("stale acknowledgement cleared the current request")
	}
	if !app.acknowledgeFlush("workspace", true, float64(8)) {
		t.Fatal("current acknowledgement should succeed")
	}
}

func activeCloseApp(t *testing.T) (*App, chan struct{}) {
	t.Helper()
	app := NewApp()
	app.activeModules["workspace"] = true
	app.emit = func(context.Context, string, ...interface{}) {}
	quitCalled := make(chan struct{}, 1)
	app.quit = func(context.Context) { quitCalled <- struct{}{} }
	return app, quitCalled
}

func flushRequestID(app *App, module string) uint64 {
	app.closeMu.Lock()
	defer app.closeMu.Unlock()
	return app.flushRequests[module].id
}

func TestBeforeCloseBlocksUntilFlushSucceeds(t *testing.T) {
	app, quitCalled := activeCloseApp(t)
	if !app.beforeClose(context.Background()) {
		t.Fatal("first close should wait for the flush")
	}
	if !app.beforeClose(context.Background()) {
		t.Fatal("second close must not bypass the pending flush")
	}
	app.acknowledgeFlush("workspace", true, float64(flushRequestID(app, "workspace")))
	select {
	case <-quitCalled:
	case <-time.After(time.Second):
		t.Fatal("successful flush did not quit the app")
	}
	if app.beforeClose(context.Background()) {
		t.Fatal("internal quit should be allowed to close the window")
	}
}

func TestFailedFlushKeepsWindowOpen(t *testing.T) {
	app, quitCalled := activeCloseApp(t)
	if !app.beforeClose(context.Background()) {
		t.Fatal("first close should request a flush")
	}
	if app.acknowledgeFlush("workspace", false, float64(flushRequestID(app, "workspace"))) {
		t.Fatal("failed flush should not be acknowledged as successful")
	}
	if app.closing {
		t.Fatal("failed flush should reset the close state")
	}
	select {
	case <-quitCalled:
		t.Fatal("failed flush must not quit")
	default:
	}
	if !app.beforeClose(context.Background()) {
		t.Fatal("user should be able to retry the flush")
	}
	app.acknowledgeFlush("workspace", true, float64(flushRequestID(app, "workspace")))
	select {
	case <-quitCalled:
	case <-time.After(time.Second):
		t.Fatal("successful retry should quit")
	}
}

func TestFlushTimeoutAllowsRetry(t *testing.T) {
	app := NewApp()
	app.activeModules["workspace"] = true
	app.flushTimeout = 5 * time.Millisecond
	timeouts := make(chan string, 2)
	app.emit = func(_ context.Context, event string, _ ...interface{}) {
		timeouts <- event
	}
	app.quit = func(context.Context) { t.Error("timed-out flush must not quit") }

	if !app.beforeClose(context.Background()) {
		t.Fatal("first close should request a flush")
	}
	select {
	case event := <-timeouts:
		if event != "workspace:flush" {
			t.Fatalf("first event = %q", event)
		}
	case <-time.After(time.Second):
		t.Fatal("flush request was not emitted")
	}
	select {
	case event := <-timeouts:
		if event != "workspace:flush-timeout" {
			t.Fatalf("timeout event = %q", event)
		}
	case <-time.After(time.Second):
		t.Fatal("flush timeout was not emitted")
	}
	if app.closing {
		t.Fatal("timeout should reset the close state")
	}
}

func TestBeforeCloseWaitsForEveryActiveModule(t *testing.T) {
	app, quitCalled := activeCloseApp(t)
	app.activeModules["studio"] = true
	if !app.beforeClose(context.Background()) {
		t.Fatal("first close should request module flushes")
	}
	app.acknowledgeFlush("workspace", true, float64(flushRequestID(app, "workspace")))
	select {
	case <-quitCalled:
		t.Fatal("app quit before the studio flush completed")
	default:
	}
	app.acknowledgeFlush("studio", true, float64(flushRequestID(app, "studio")))
	select {
	case <-quitCalled:
	case <-time.After(time.Second):
		t.Fatal("app did not quit after every module flushed")
	}
}

func TestModuleActivatedDuringCloseRestartsFlush(t *testing.T) {
	app, quitCalled := activeCloseApp(t)
	if !app.beforeClose(context.Background()) {
		t.Fatal("first close should request the workspace flush")
	}
	firstID := flushRequestID(app, "workspace")

	app.closeMu.Lock()
	app.activeModules["studio"] = true
	app.closeMu.Unlock()
	app.startCloseCycle(context.Background())

	secondID := flushRequestID(app, "workspace")
	if secondID == firstID {
		t.Fatal("restarted close should issue a new request ID")
	}
	if app.acknowledgeFlush("workspace", true, float64(firstID)) {
		t.Fatal("stale acknowledgement must not finish the restarted close")
	}
	app.acknowledgeFlush("workspace", true, float64(secondID))
	select {
	case <-quitCalled:
		t.Fatal("app quit before the newly active studio flushed")
	default:
	}
	app.acknowledgeFlush("studio", true, float64(flushRequestID(app, "studio")))
	select {
	case <-quitCalled:
	case <-time.After(time.Second):
		t.Fatal("app did not quit after the restarted close completed")
	}
}

func TestWorkspaceIdentityIsStableAndDirectorySpecific(t *testing.T) {
	firstPath := filepath.Join(t.TempDir(), "workspace.json")
	secondPath := filepath.Join(t.TempDir(), "workspace.json")
	first := workspaceIdentity(firstPath)
	second := workspaceIdentity(secondPath)
	if first == "" || first != workspaceIdentity(firstPath) {
		t.Fatal("workspace identity should be stable")
	}
	if first == second {
		t.Fatal("different workspace directories should have different identities")
	}
}

func TestGetSystemInfo(t *testing.T) {
	info := NewApp().GetSystemInfo()
	if info.AppName != appName {
		t.Fatalf("AppName = %q, want %q", info.AppName, appName)
	}
	if info.Version != appVersion {
		t.Fatalf("Version = %q, want %q", info.Version, appVersion)
	}
	if info.OS != runtime.GOOS || info.Arch != runtime.GOARCH {
		t.Fatalf("platform = %s/%s, want %s/%s", info.OS, info.Arch, runtime.GOOS, runtime.GOARCH)
	}
	if !info.Desktop {
		t.Fatal("Desktop = false, want true")
	}
}

func TestSPAHandlerServesClientRoutes(t *testing.T) {
	frontend := fstest.MapFS{
		"index.html": &fstest.MapFile{Data: []byte("<!doctype html><title>Toolbox</title>")},
	}
	handler := newSPAHandler(fs.FS(frontend))

	for _, path := range []string{"/", "/packages/svg-compose", "/unknown/module"} {
		t.Run(path, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))

			if recorder.Code != http.StatusOK {
				t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
			}
			if !strings.Contains(recorder.Body.String(), "Toolbox") {
				t.Fatalf("body = %q, want fallback HTML", recorder.Body.String())
			}
			if contentType := recorder.Header().Get("Content-Type"); contentType != "text/html; charset=utf-8" {
				t.Fatalf("Content-Type = %q", contentType)
			}
		})
	}
}

func TestSPAHandlerDoesNotHideMissingAssets(t *testing.T) {
	frontend := fstest.MapFS{
		"index.html": &fstest.MapFile{Data: []byte("fallback")},
	}
	handler := newSPAHandler(fs.FS(frontend))
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/_app/missing.js", nil))

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusNotFound)
	}
}

func TestSPAHandlerRejectsWrites(t *testing.T) {
	frontend := fstest.MapFS{
		"index.html": &fstest.MapFile{Data: []byte("fallback")},
	}
	handler := newSPAHandler(fs.FS(frontend))
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/packages/svg-compose", nil))

	if recorder.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusMethodNotAllowed)
	}
}
