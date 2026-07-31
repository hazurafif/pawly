// pawly is the Pawly home server: a single binary storing family cat data
// in SQLite and serving the sync API for the Pawly mobile app.
package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

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
	handler := logRequests(srv.Handler())

	srvHTTP := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	log.Printf("pawly listening on %s (data dir %s)", addr, *dataDir)
	if err := srvHTTP.ListenAndServe(); err != nil {
		log.Fatalf("listen: %v", err)
	}
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

// logRequests logs one line per request: method, path, status, duration.
func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(sw, r)
		log.Printf("%s %s %d %s", r.Method, r.URL.Path, sw.status, time.Since(start))
	})
}
