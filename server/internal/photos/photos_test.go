package photos

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSaveAndOpenRoundtrip(t *testing.T) {
	dir := t.TempDir()
	s := New(dir)

	if err := s.Save("p-1", []byte("JPEGDATA")); err != nil {
		t.Fatal(err)
	}
	data, err := s.Open("p-1")
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "JPEGDATA" {
		t.Fatalf("got %q, want JPEGDATA", data)
	}
}

func TestOpenMissingReturnsError(t *testing.T) {
	s := New(t.TempDir())
	if _, err := s.Open("p-nope"); err == nil {
		t.Fatal("expected error for missing photo")
	}
}

func TestSaveOverwritesAtomically(t *testing.T) {
	dir := t.TempDir()
	s := New(dir)

	if err := s.Save("p-1", []byte("one")); err != nil {
		t.Fatal(err)
	}
	if err := s.Save("p-1", []byte("two")); err != nil {
		t.Fatal(err)
	}
	data, err := s.Open("p-1")
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "two" {
		t.Fatalf("got %q, want two", data)
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 {
		t.Fatalf("temp files leaked: %d entries", len(entries))
	}
}

func TestPathIsWithinDir(t *testing.T) {
	s := New("/data/photos")
	got := s.Path("abc-123")
	if filepath.Dir(got) != "/data/photos" {
		t.Fatalf("path %q not inside dir", got)
	}
}
