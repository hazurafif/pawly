// pawly is the Pawly home server: a single binary storing family cat data
// in SQLite and serving the sync API for the Pawly mobile app.
package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"pawly/internal/api"
	"pawly/internal/photos"
	"pawly/internal/store"
)

func main() {
	port := flag.String("port", "8080", "listen port")
	dataDir := flag.String("data-dir", "./data", "directory for SQLite DB and photos")
	flag.Parse()

	if err := os.MkdirAll(*dataDir, 0o755); err != nil {
		log.Fatalf("create data dir: %v", err)
	}

	dbPath := filepath.Join(*dataDir, "pawly.db")

	st, err := store.Open(dbPath)
	if err != nil {
		log.Fatalf("open store: %v", err)
	}
	defer st.Close()

	if err := st.Migrate(); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	srv := api.New(st, photos.New(filepath.Join(*dataDir, "photos")))

	addr := ":" + *port
	log.Printf("pawly listening on %s (data dir %s)", addr, *dataDir)
	if err := http.ListenAndServe(addr, srv.Handler()); err != nil {
		log.Fatalf("listen: %v", err)
	}
}
