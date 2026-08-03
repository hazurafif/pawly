// Package api exposes the Pawly sync API over HTTP.
package api

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"pawly/internal/photos"
	"pawly/internal/store"
)

const maxPhotoBytes = 20 << 20 // 20 MB

type Server struct {
	store  *store.Store
	photos *photos.Store
	mux    *http.ServeMux
}

func New(st *store.Store, ph *photos.Store) *Server {
	s := &Server{store: st, photos: ph, mux: http.NewServeMux()}
	s.mux.HandleFunc("GET /healthz", s.handleHealth)
	s.mux.HandleFunc("GET /sync/pull", s.handlePull)
	s.mux.HandleFunc("POST /sync/push", s.handlePush)
	s.mux.HandleFunc("PUT /photos/{id}", s.handlePutPhoto)
	s.mux.HandleFunc("GET /photos/{id}", s.handleGetPhoto)
	return s
}

func (s *Server) Handler() http.Handler {
	return s.mux
}

// RunPhotoGC removes on-disk binaries for photo rows that are soft-deleted
// (tombstoned). Tombstone rows must survive for sync, but their files are
// unreachable — safe to sweep. Safe to call repeatedly.
func (s *Server) RunPhotoGC() error {
	ids, err := s.store.TombstonedPhotoIDs()
	if err != nil {
		return err
	}
	for _, id := range ids {
		if err := s.photos.Delete(id); err != nil {
			return err
		}
	}
	return nil
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if err := s.store.Ping(); err != nil {
		log.Printf("healthz: %v", err)
		writeError(w, http.StatusInternalServerError, "db unavailable")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handlePull(w http.ResponseWriter, r *http.Request) {
	since := time.Time{}
	if raw := r.URL.Query().Get("since"); raw != "" {
		parsed, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			writeError(w, http.StatusBadRequest, "since must be RFC3339")
			return
		}
		since = parsed
	}
	changes, err := s.store.PullChanges(since)
	if err != nil {
		log.Printf("pull internal error: %v", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"server_time": time.Now().UTC().Format(time.RFC3339),
		"changes":     changes,
	})
}

func (s *Server) handlePush(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Changes map[string][]map[string]any `json:"changes"`
	}
	dec := json.NewDecoder(io.LimitReader(r.Body, 64<<20))
	if err := dec.Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if err := dec.Decode(&struct{}{}); err != io.EOF {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.Changes == nil {
		writeError(w, http.StatusBadRequest, "missing changes")
		return
	}
	// Clamp stale client timestamps so rows pushed by a clock-behind device
	// never fall behind another device's pull cursor (which would strand
	// them forever). This is the server's only time normalization; the
	// phone's own timestamps are unchanged locally.
	now := time.Now().UTC()
	for _, rows := range req.Changes {
		for _, row := range rows {
			up, ok := row["updated_at"].(string)
			if !ok {
				continue
			}
			t, err := time.Parse(store.TimestampFormat, up)
			if err != nil {
				continue // PushRows will reject with a clear error
			}
			if t.Before(now) {
				row["updated_at"] = now.Format(store.TimestampFormat)
			}
		}
	}
	applied, err := s.store.PushRows(req.Changes)
	if err != nil {
		var ve *store.ValidationError
		if errors.As(err, &ve) {
			writeError(w, http.StatusBadRequest, err.Error())
		} else {
			log.Printf("push internal error: %v", err)
			writeError(w, http.StatusInternalServerError, "internal server error")
		}
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "applied": applied})
}

func (s *Server) handlePutPhoto(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	_, exists, err := s.store.PhotoMeta(id)
	if err != nil {
		log.Printf("put photo internal error: %v", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	if !exists {
		writeError(w, http.StatusNotFound, "photo row not found")
		return
	}
	data, err := io.ReadAll(io.LimitReader(r.Body, maxPhotoBytes+1))
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read body")
		return
	}
	if len(data) > maxPhotoBytes {
		writeError(w, http.StatusRequestEntityTooLarge, "photo too large")
		return
	}
	if len(data) == 0 {
		writeError(w, http.StatusBadRequest, "empty body")
		return
	}
	if err := s.photos.Save(id, data); err != nil {
		log.Printf("put photo internal error: %v", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	if ct := r.Header.Get("Content-Type"); ct != "" {
		if err := s.store.SetPhotoContentType(id, ct); err != nil {
			log.Printf("put photo internal error: %v", err)
			writeError(w, http.StatusInternalServerError, "internal server error")
			return
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleGetPhoto(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	ct, exists, err := s.store.PhotoMeta(id)
	if err != nil {
		log.Printf("get photo internal error: %v", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	if !exists {
		writeError(w, http.StatusNotFound, "photo not found")
		return
	}
	data, err := s.photos.Open(id)
	if errors.Is(err, os.ErrNotExist) {
		writeError(w, http.StatusNotFound, "photo file missing")
		return
	}
	if err != nil {
		log.Printf("get photo internal error: %v", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	w.Header().Set("Content-Type", ct)
	w.Write(data)
}
