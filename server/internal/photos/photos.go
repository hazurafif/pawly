// Package photos stores photo binaries on disk, one file per photo id.
package photos

import (
	"fmt"
	"os"
	"path/filepath"
)

type Store struct {
	dir string
}

func New(dir string) *Store {
	return &Store{dir: dir}
}

// Path returns the on-disk location for a photo id, erroring on ids that
// could escape the photos directory (empty, ".", "..", or containing a
// path separator).
func (s *Store) Path(id string) (string, error) {
	if id == "" || id == "." || id == ".." || id != filepath.Base(id) {
		return "", fmt.Errorf("invalid photo id %q", id)
	}
	return filepath.Join(s.dir, id), nil
}

// Save writes photo data atomically (temp file + fsync + rename).
func (s *Store) Save(id string, data []byte) error {
	path, err := s.Path(id)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(s.dir, 0o755); err != nil {
		return err
	}
	f, err := os.CreateTemp(s.dir, "."+id+"-*.tmp")
	if err != nil {
		return err
	}
	tmp := f.Name()
	defer func() {
		if err != nil {
			f.Close()
			os.Remove(tmp)
		}
	}()
	if _, err = f.Write(data); err != nil {
		return err
	}
	if err = f.Sync(); err != nil {
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	if err = os.Rename(tmp, path); err != nil {
		return err
	}
	return nil
}

// Open reads a photo's bytes. Errors when the photo is missing.
func (s *Store) Open(id string) ([]byte, error) {
	path, err := s.Path(id)
	if err != nil {
		return nil, err
	}
	return os.ReadFile(path)
}

// Delete removes a photo, ignoring missing files.
func (s *Store) Delete(id string) error {
	path, err := s.Path(id)
	if err != nil {
		return err
	}
	err = os.Remove(path)
	if os.IsNotExist(err) {
		return nil
	}
	return err
}
