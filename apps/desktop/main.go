package main

import (
	"bufio"
	"bytes"
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"net/http/httptest"
	"os"

	"github.com/tigawanna/assets-toolbox/apps/desktop/internal/socialinspect"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/build
var assets embed.FS

func main() {
	frontend, err := fs.Sub(assets, "frontend/build")
	if err != nil {
		log.Fatal(err)
	}

	app := NewApp()
	socialHandler := socialinspect.NewHandler(http.DefaultClient)
	apiRoutes := map[string]http.Handler{
		"/mcp":           app.mcpHandler(),
		"/api/workspace": app.workspace.handler(),
		"/api/inspect":   socialHandler,
		"/api/asset":     socialHandler,
		"/api/projects":  app.projects.handler(),
	}

	// Headless mode is for MCP contract tests and agents that cannot open a
	// WebKit window. Native dialogs are unavailable; project assets are the
	// only supported generation inputs.
	if addr := os.Getenv("ASSETS_TOOLBOX_MCP_HTTP"); addr != "" {
		log.Fatal(http.ListenAndServe(addr, newProjectsModuleMiddleware(apiRoutes, http.NotFoundHandler())))
	}

	if os.Getenv("ASSETS_TOOLBOX_MCP_STDIO") != "" {
		handler := app.mcpHandler()
		scanner := bufio.NewScanner(os.Stdin)
		scanner.Buffer(make([]byte, 0, 64*1024), 1<<20)
		for scanner.Scan() {
			line := bytes.TrimSpace(scanner.Bytes())
			if len(line) == 0 {
				continue
			}
			request := httptest.NewRequest(http.MethodPost, "/mcp", bytes.NewReader(line))
			request.Header.Set("Content-Type", "application/json")
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, request)
			fmt.Fprintln(os.Stdout, recorder.Body.String())
		}
		return
	}

	err = wails.Run(&options.App{
		Title:            appName,
		Width:            1180,
		Height:           780,
		MinWidth:         920,
		MinHeight:        620,
		BackgroundColour: &options.RGBA{R: 242, G: 240, B: 234, A: 1},
		AssetServer: &assetserver.Options{
			Assets:  frontend,
			Handler: newSPAHandler(frontend),
			Middleware: func(next http.Handler) http.Handler {
				return newProjectsModuleMiddleware(apiRoutes, next)
			},
		},
		OnStartup:     app.startup,
		OnShutdown:    app.shutdown,
		OnBeforeClose: app.beforeClose,
		Bind:          []interface{}{app},
		SingleInstanceLock: &options.SingleInstanceLock{
			UniqueId: "com.tigawanna.assets-toolbox",
		},
	})
	if err != nil {
		log.Fatal(err)
	}
}
