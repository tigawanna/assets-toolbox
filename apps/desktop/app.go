package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io/fs"
	"math"
	"net/http"
	"path"
	"path/filepath"
	"runtime"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/tigawanna/assets-toolbox/apps/desktop/internal/assetgen"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	appName    = "Assets Toolbox"
	appVersion = "0.1.0"
)

// SystemInfo is the small native bridge used by the desktop shell.
// The catalog itself stays in TypeScript so package UI can be mounted without
// changing the Go API.
type SystemInfo struct {
	AppName   string `json:"appName"`
	Version   string `json:"version"`
	OS        string `json:"os"`
	Arch      string `json:"arch"`
	GoVersion string `json:"goVersion"`
	Desktop   bool   `json:"desktop"`
}

// App owns the Wails application lifecycle and native services.
type App struct {
	ctx               context.Context
	workspace         *workspaceStore
	projects          *projectsStore
	closeMu           sync.Mutex
	activeModules     map[string]bool
	closing           bool
	quitApproved      bool
	flushRequests     map[string]flushRequest
	flushSequence     uint64
	closeSequence     uint64
	flushTimeout      time.Duration
	quit              func(context.Context)
	emit              func(context.Context, string, ...interface{})
	eventCleanup      []func()
	assetManager      *assetgen.Manager
	directories       *directoryStore
	assetInputsMu     sync.Mutex
	assetInputs       map[string]string
	mcpBridgeMu       sync.Mutex
	mcpBridgeRequests map[string]chan mcpBridgeResult
	mcpBridgeSeq      uint64
}

type mcpBridgeResult struct {
	result any
	err    error
}

type flushRequest struct {
	id  uint64
	ack chan bool
}

// NewApp creates the desktop application.
func NewApp() *App {
	return &App{
		workspace:         newWorkspaceStore(defaultWorkspacePath()),
		projects:          newProjectsStore(defaultProjectsRoot()),
		activeModules:     make(map[string]bool),
		flushRequests:     make(map[string]flushRequest),
		quit:              wailsruntime.Quit,
		emit:              wailsruntime.EventsEmit,
		flushTimeout:      3 * time.Second,
		assetManager:      newAssetManager(),
		directories:       newDirectoryStore(defaultDirectoryStorePath()),
		assetInputs:       make(map[string]string),
		mcpBridgeRequests: make(map[string]chan mcpBridgeResult),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	for _, module := range []string{"workspace", "studio", "projects", "mcp"} {
		module := module
		a.eventCleanup = append(a.eventCleanup,
			wailsruntime.EventsOn(ctx, module+":active", func(...interface{}) {
				a.closeMu.Lock()
				a.activeModules[module] = true
				restartClose := a.closing
				a.closeMu.Unlock()
				if restartClose {
					a.startCloseCycle(ctx)
				}
			}),
			wailsruntime.EventsOn(ctx, module+":inactive", func(...interface{}) {
				a.closeMu.Lock()
				delete(a.activeModules, module)
				a.closeMu.Unlock()
			}),
			wailsruntime.EventsOn(ctx, module+":flushed", func(data ...interface{}) {
				a.acknowledgeFlush(module, data...)
			}),
		)
	}
	a.eventCleanup = append(a.eventCleanup,
		wailsruntime.EventsOn(ctx, "mcp:response", func(data ...interface{}) {
			if len(data) < 2 {
				return
			}
			id, ok := data[0].(string)
			if !ok {
				return
			}
			a.mcpBridgeMu.Lock()
			channel := a.mcpBridgeRequests[id]
			delete(a.mcpBridgeRequests, id)
			a.mcpBridgeMu.Unlock()
			if channel == nil {
				return
			}
			var bridgeErr error
			if len(data) > 2 {
				if message, ok := data[2].(string); ok && message != "" {
					bridgeErr = fmt.Errorf("%s", message)
				}
			}
			channel <- mcpBridgeResult{result: data[1], err: bridgeErr}
		}),
	)
}

// mcpBridge asks the frontend to run a tool whose state lives in the WebView
// (Studio boards, global templates) and waits for the response event.
func (a *App) mcpBridge(tool string, args map[string]any) (any, error) {
	if a.emit == nil {
		return nil, fmt.Errorf("frontend bridge is unavailable")
	}
	id := strconv.FormatUint(atomic.AddUint64(&a.mcpBridgeSeq, 1), 10)
	channel := make(chan mcpBridgeResult, 1)
	a.mcpBridgeMu.Lock()
	a.mcpBridgeRequests[id] = channel
	a.mcpBridgeMu.Unlock()
	defer func() {
		a.mcpBridgeMu.Lock()
		delete(a.mcpBridgeRequests, id)
		a.mcpBridgeMu.Unlock()
	}()
	a.emit(a.ctx, "mcp:request", id, tool, args)
	select {
	case response := <-channel:
		return response.result, response.err
	case <-time.After(3 * time.Second):
		return nil, fmt.Errorf("frontend bridge timed out for %s", tool)
	}
}

func (a *App) shutdown(ctx context.Context) {
	if a.assetManager != nil {
		a.assetManager.Close()
	}
	for _, cleanup := range a.eventCleanup {
		cleanup()
	}
	a.eventCleanup = nil
	a.ctx = ctx
}

func (a *App) acknowledgeFlush(module string, data ...interface{}) bool {
	a.closeMu.Lock()
	defer a.closeMu.Unlock()
	request, ok := a.flushRequests[module]
	if !ok {
		return false
	}
	if len(data) < 2 {
		return false
	}
	id, ok := flushID(data[1])
	if !ok || id != request.id {
		return false
	}
	succeeded := true
	if value, ok := data[0].(bool); ok {
		succeeded = value
	}

	request.ack <- succeeded
	delete(a.flushRequests, module)
	if !succeeded {
		// Keep the window open so the user can retry after resolving the save error.
		a.closing = false
		a.closeSequence++
		a.cancelFlushRequestsLocked()
	}
	return succeeded
}

func (a *App) cancelFlushRequestsLocked() {
	for _, request := range a.flushRequests {
		close(request.ack)
	}
	a.flushRequests = make(map[string]flushRequest)
}

func flushID(value interface{}) (uint64, bool) {
	switch id := value.(type) {
	case float64:
		return uint64(id), id >= 0 && id == math.Trunc(id)
	case uint64:
		return id, true
	case int:
		return uint64(id), id >= 0
	default:
		return 0, false
	}
}

func (a *App) beforeClose(ctx context.Context) bool {
	a.closeMu.Lock()
	if a.quitApproved || len(a.activeModules) == 0 {
		a.closeMu.Unlock()
		return false
	}
	if a.closing {
		a.closeMu.Unlock()
		return true
	}
	a.closing = true
	a.closeMu.Unlock()

	a.startCloseCycle(ctx)
	return true
}

// startCloseCycle flushes every module active at the time of the close. If a
// module becomes active mid-close, the cycle restarts so its unsaved work is
// included before the app exits.
func (a *App) startCloseCycle(ctx context.Context) {
	a.closeMu.Lock()
	a.closing = true
	a.closeSequence++
	closeSequence := a.closeSequence
	requests := make(map[string]flushRequest, len(a.activeModules))
	for module := range a.activeModules {
		a.flushSequence++
		requests[module] = flushRequest{id: a.flushSequence, ack: make(chan bool, 1)}
	}
	a.cancelFlushRequestsLocked()
	a.flushRequests = make(map[string]flushRequest, len(requests))
	for module, request := range requests {
		a.flushRequests[module] = request
	}
	a.closeMu.Unlock()

	for module, request := range requests {
		a.emit(ctx, module+":flush", request.id)
	}
	go a.finishClose(ctx, closeSequence, requests)
}

func (a *App) finishClose(ctx context.Context, closeSequence uint64, requests map[string]flushRequest) {
	results := make(chan bool, len(requests))
	for _, request := range requests {
		go func(request flushRequest) {
			results <- <-request.ack
		}(request)
	}

	timer := time.NewTimer(a.flushTimeout)
	defer timer.Stop()
	for range requests {
		select {
		case succeeded := <-results:
			if !succeeded {
				return
			}
		case <-timer.C:
			a.closeMu.Lock()
			if a.closeSequence == closeSequence {
				a.cancelFlushRequestsLocked()
				a.closing = false
				a.closeMu.Unlock()
				for module := range requests {
					a.emit(ctx, module+":flush-timeout", closeSequence)
				}
				return
			}
			a.closeMu.Unlock()
			return
		}
	}

	a.closeMu.Lock()
	if a.closeSequence != closeSequence {
		a.closeMu.Unlock()
		return
	}
	a.quitApproved = true
	a.closeMu.Unlock()
	a.quit(ctx)
}

// GetSystemInfo lets the UI distinguish a native launch from a browser preview.
func (a *App) GetSystemInfo() SystemInfo {
	return SystemInfo{
		AppName:   appName,
		Version:   appVersion,
		OS:        runtime.GOOS,
		Arch:      runtime.GOARCH,
		GoVersion: runtime.Version(),
		Desktop:   true,
	}
}

// WorkspaceID identifies the native data directory for browser fallback keys.
func (a *App) WorkspaceID() string {
	return workspaceIdentity(a.workspace.path)
}

func workspaceIdentity(path string) string {
	if path == "" {
		return ""
	}
	if absolute, err := filepath.Abs(path); err == nil {
		path = absolute
	}
	sum := sha256.Sum256([]byte(filepath.Clean(path)))
	return hex.EncodeToString(sum[:8])
}

// LoadWorkspace and SaveWorkspace keep persistence available while Wails is
// serving the React SPA from an external development server.
func (a *App) LoadWorkspace() (*WorkspaceDocument, error) {
	return a.workspace.load()
}

func (a *App) SaveWorkspace(document WorkspaceDocument) (WorkspaceDocument, error) {
	return a.workspace.save(document)
}

// newSPAHandler serves the React SPA fallback for client-side routes such as
// /packages/svg-compose. Requests for missing assets still return a real 404.
func newSPAHandler(frontend fs.FS) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", http.MethodGet)
			http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
			return
		}

		if path.Ext(r.URL.Path) != "" {
			http.NotFound(w, r)
			return
		}

		index, err := fs.ReadFile(frontend, "index.html")
		if err != nil {
			http.Error(w, fmt.Sprintf("frontend unavailable: %v", err), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		http.ServeContent(w, r, "index.html", time.Time{}, bytes.NewReader(index))
	})
}
