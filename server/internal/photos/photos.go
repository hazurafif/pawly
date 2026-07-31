// Package photos stores photo binaries on disk, one file per photo id.
package photos

import (
	"os"
	"path/filepath"
)

type Store struct {
	dir string
}

func New(dir string) *Store {
	return &Store{dir: dir}
}

// Path returns the on-disk location for a photo id.
func (s *Store) Path(id string) string {
	return filepath.Join(s.dir, id)
}

// Save writes photo data atomically (temp file + rename).
func (s *Store) Save(id string, data []byte) error {
	if err := os.MkdirAll(s.dir, 0o755); err != nil {
		return err
	}
	tmp := filepath.Join(s.dir, "."+id+".tmp")
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, s.Path(id))
}

// Open reads a photo's bytes. Errors when the photo is missing.
func (s *Store) Open(id string) ([]byte, error) {
	return os.ReadFile(s.Path(id))
}

// Delete removes a photo, ignoring missing files.
func (s *Store) Delete(id string) error {
	err := os.Remove(s.Path(id))
	if os.IsNotExist(err) {
		return nil
	}
	return err
}
