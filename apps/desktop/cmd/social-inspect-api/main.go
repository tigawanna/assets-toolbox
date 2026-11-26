package main

import (
	"flag"
	"log"
	"net/http"

	"github.com/tigawanna/assets-toolbox/apps/desktop/internal/socialinspect"
)

func main() {
	addr := flag.String("addr", "127.0.0.1:4332", "address to listen on")
	flag.Parse()

	server := &http.Server{
		Addr:    *addr,
		Handler: socialinspect.NewHandler(http.DefaultClient),
	}
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
