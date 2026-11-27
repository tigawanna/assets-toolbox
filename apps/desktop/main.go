package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
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
