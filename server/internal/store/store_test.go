package store

import "testing"

func TestMigrateCreatesTables(t *testing.T) {
	s, err := OpenMemory()
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()

	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}

	want := append([]string{"schema_migrations"}, TableNames...)
	for _, tbl := range want {
		var name string
		if err := s.db.QueryRow(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, tbl).Scan(&name); err != nil {
			t.Fatalf("table %s missing: %v", tbl, err)
		}
	}
}

func TestMigrateIsIdempotent(t *testing.T) {
	s, err := OpenMemory()
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()

	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
}

func TestUpsertInsertsNewRow(t *testing.T) {
	s, err := OpenMemory()
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}

	applied, err := s.Upsert("cats", map[string]any{
		"id":         "cat-1",
		"name":       "Miko",
		"sex":        "male",
		"status":     "alive",
		"created_at": "2026-08-01T00:00:00Z",
		"updated_at": "2026-08-01T00:00:00Z",
	})
	if err != nil {
		t.Fatal(err)
	}
	if !applied {
		t.Fatal("expected new row to be applied")
	}

	var name string
	if err := s.db.QueryRow(`SELECT name FROM cats WHERE id = 'cat-1'`).Scan(&name); err != nil {
		t.Fatal(err)
	}
	if name != "Miko" {
		t.Fatalf("got name %q, want Miko", name)
	}
}

func TestUpsertLastWriteWins(t *testing.T) {
	s, err := OpenMemory()
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}

	mk := func(updated, name string) map[string]any {
		return map[string]any{
			"id":         "cat-1",
			"name":       name,
			"sex":        "male",
			"status":     "alive",
			"created_at": "2026-08-01T00:00:00Z",
			"updated_at": updated,
		}
	}

	if _, err := s.Upsert("cats", mk("2026-08-01T01:00:00Z", "v1")); err != nil {
		t.Fatal(err)
	}

	// Older incoming row must NOT overwrite.
	applied, err := s.Upsert("cats", mk("2026-08-01T00:30:00Z", "older"))
	if err != nil {
		t.Fatal(err)
	}
	if applied {
		t.Fatal("older row should not have been applied")
	}

	// Newer incoming row must overwrite.
	applied, err = s.Upsert("cats", mk("2026-08-01T02:00:00Z", "newer"))
	if err != nil {
		t.Fatal(err)
	}
	if !applied {
		t.Fatal("newer row should have been applied")
	}

	var name string
	if err := s.db.QueryRow(`SELECT name FROM cats WHERE id = 'cat-1'`).Scan(&name); err != nil {
		t.Fatal(err)
	}
	if name != "newer" {
		t.Fatalf("got name %q, want newer", name)
	}
}

func TestUpsertRejectsUnknownTable(t *testing.T) {
	s, err := OpenMemory()
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}

	if _, err := s.Upsert("nope", map[string]any{"id": "x", "updated_at": "2026-08-01T00:00:00Z"}); err == nil {
		t.Fatal("expected error for unknown table")
	}
}

func TestUpsertRejectsMissingID(t *testing.T) {
	s, err := OpenMemory()
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}

	if _, err := s.Upsert("cats", map[string]any{"updated_at": "2026-08-01T00:00:00Z"}); err == nil {
		t.Fatal("expected error for missing id")
	}
}
