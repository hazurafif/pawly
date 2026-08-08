// pawly is the Pawly home server: a single binary storing family pet data
// in SQLite and serving the sync API for the Pawly mobile app.
package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"pawly/internal/api"
	"pawly/internal/photos"
	"pawly/internal/store"
)

func main() {
	loadDotEnv()
	port := flag.String("port", envOr("PAWLY_PORT", "8080"), "listen port")
	dataDir := flag.String("data-dir", envOr("PAWLY_DATA_DIR", "./data"), "directory for SQLite DB and photos")
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

	// Sweep tombstoned photo binaries once at startup, then hourly.
	if err := srv.RunPhotoGC(); err != nil {
		log.Printf("photo gc (startup): %v", err)
	}
	go func() {
		ticker := time.NewTicker(time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			if err := srv.RunPhotoGC(); err != nil {
				log.Printf("photo gc: %v", err)
			}
		}
	}()

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

// envOr returns the environment variable's value, or a fallback.
func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// loadDotEnv reads KEY=VALUE lines from .env (no shell expansion, quotes
// stripped). Real environment variables always win; a missing file is not
// an error. Relative values resolve against the .env file's directory, so
// PAWLY_DATA_DIR=../data always means the parent of .env regardless of the
// working directory.
//
// The file is looked up next to the executable first (so a binary installed
// in /usr/local/bin reads /usr/local/bin/.env), then in the working
// directory (so `go run ./cmd` from the repo root works).
func loadDotEnv() {
	var dirs []string
	if exe, err := os.Executable(); err == nil {
		dirs = append(dirs, filepath.Dir(exe))
	}
	if cwd, err := os.Getwd(); err == nil {
		dirs = append(dirs, cwd)
	}
	for _, dir := range dirs {
		if loaded := readDotEnv(dir); loaded {
			return
		}
	}
}

func readDotEnv(dir string) bool {
	data, err := os.ReadFile(filepath.Join(dir, ".env"))
	if err != nil {
		return false
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.Trim(strings.TrimSpace(value), `"'`)
		if key == "" {
			continue
		}
		if _, exists := os.LookupEnv(key); !exists {
			if strings.HasPrefix(value, "./") || strings.HasPrefix(value, "../") {
				value = filepath.Join(dir, value)
			}
			os.Setenv(key, value)
		}
	}
	return true
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
