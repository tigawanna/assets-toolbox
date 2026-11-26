package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"

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
		"/api/workspace": app.workspace.handler(),
		"/api/inspect":   socialHandler,
		"/api/asset":     socialHandler,
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
				return newModuleMiddleware(apiRoutes, next)
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
