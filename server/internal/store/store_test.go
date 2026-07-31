package store

import (
	"database/sql"
	"strings"
	"testing"
	"time"
)

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

func TestUpsertRejectsUnknownColumn(t *testing.T) {
	s, err := OpenMemory()
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}

	_, err = s.Upsert("cats", map[string]any{
		"id":         "cat-1",
		"name":       "Miko",
		"created_at": "2026-08-01T00:00:00Z",
		"updated_at": "2026-08-01T00:00:00Z",
		"namee":      "x",
	})
	if err == nil {
		t.Fatal("expected error for unknown column")
	}
	if !strings.Contains(err.Error(), "namee") {
		t.Fatalf("error %q should mention unknown column %q", err, "namee")
	}
}

func TestUpsertRejectsMissingUpdatedAt(t *testing.T) {
	s, err := OpenMemory()
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}

	if _, err := s.Upsert("cats", map[string]any{"id": "cat-1", "name": "Miko", "created_at": "2026-08-01T00:00:00Z"}); err == nil {
		t.Fatal("expected error for missing updated_at")
	}
}

func TestUpsertAppliesSchemaDefaults(t *testing.T) {
	s, err := OpenMemory()
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}

	if _, err := s.Upsert("cats", map[string]any{
		"id":         "cat-1",
		"name":       "Miko",
		"created_at": "2026-08-01T00:00:00Z",
		"updated_at": "2026-08-01T00:00:00Z",
	}); err != nil {
		t.Fatal(err)
	}

	var birthEstimated, rescueEstimated int64
	var isNeutered, sex, status string
	if err := s.db.QueryRow(`SELECT birth_date_is_estimated, rescue_date_is_estimated, is_neutered, sex, status FROM cats WHERE id = 'cat-1'`).Scan(&birthEstimated, &rescueEstimated, &isNeutered, &sex, &status); err != nil {
		t.Fatal(err)
	}
	if birthEstimated != 0 || rescueEstimated != 0 || isNeutered != "unknown" || sex != "unknown" || status != "alive" {
		t.Fatalf("got defaults (%d, %d, %q, %q, %q), want (0, 0, %q, %q, %q)", birthEstimated, rescueEstimated, isNeutered, sex, status, "unknown", "unknown", "alive")
	}
}

func TestUpsertAbsentColumnStaysUnchangedOnUpdate(t *testing.T) {
	s, err := OpenMemory()
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}

	full := func(name, story, updated string) map[string]any {
		return map[string]any{
			"id": "cat-1", "name": name, "sex": "male", "status": "alive",
			"birth_date_is_estimated": 0, "rescue_date_is_estimated": 0,
			"is_neutered": "unknown", "story": story,
			"created_at": "2026-08-01T00:00:00Z", "updated_at": updated,
		}
	}
	if _, err := s.Upsert("cats", full("Miko", "a", "2026-08-01T01:00:00Z")); err != nil {
		t.Fatal(err)
	}

	// Newer row without a story key: story must stay unchanged.
	applied, err := s.Upsert("cats", map[string]any{
		"id": "cat-1", "name": "Miko2", "sex": "male", "status": "alive",
		"birth_date_is_estimated": 0, "rescue_date_is_estimated": 0,
		"is_neutered": "unknown",
		"created_at":  "2026-08-01T00:00:00Z", "updated_at": "2026-08-01T02:00:00Z",
	})
	if err != nil {
		t.Fatal(err)
	}
	if !applied {
		t.Fatal("newer row should have been applied")
	}

	var name, story string
	if err := s.db.QueryRow(`SELECT name, story FROM cats WHERE id = 'cat-1'`).Scan(&name, &story); err != nil {
		t.Fatal(err)
	}
	if name != "Miko2" || story != "a" {
		t.Fatalf("got (%q, %q), want (Miko2, a)", name, story)
	}
}

func TestUpsertExplicitNullPassesThrough(t *testing.T) {
	s, err := OpenMemory()
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}

	full := func(story any, updated string) map[string]any {
		return map[string]any{
			"id": "cat-1", "name": "Miko", "sex": "male", "status": "alive",
			"birth_date_is_estimated": 0, "rescue_date_is_estimated": 0,
			"is_neutered": "unknown", "story": story,
			"created_at": "2026-08-01T00:00:00Z", "updated_at": updated,
		}
	}
	if _, err := s.Upsert("cats", full("a", "2026-08-01T01:00:00Z")); err != nil {
		t.Fatal(err)
	}

	applied, err := s.Upsert("cats", full(nil, "2026-08-01T02:00:00Z"))
	if err != nil {
		t.Fatal(err)
	}
	if !applied {
		t.Fatal("newer row should have been applied")
	}

	var story sql.NullString
	if err := s.db.QueryRow(`SELECT story FROM cats WHERE id = 'cat-1'`).Scan(&story); err != nil {
		t.Fatal(err)
	}
	if story.Valid {
		t.Fatalf("story = %q, want NULL", story.String)
	}
}

func TestUpsertTieKeepsExisting(t *testing.T) {
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
			"id": "cat-1", "name": name, "sex": "male", "status": "alive",
			"birth_date_is_estimated": 0, "rescue_date_is_estimated": 0,
			"is_neutered": "unknown",
			"created_at":  "2026-08-01T00:00:00Z", "updated_at": updated,
		}
	}
	if _, err := s.Upsert("cats", mk("2026-08-01T01:00:00Z", "v1")); err != nil {
		t.Fatal(err)
	}

	// Same updated_at must NOT overwrite (strict < comparison).
	applied, err := s.Upsert("cats", mk("2026-08-01T01:00:00Z", "v2"))
	if err != nil {
		t.Fatal(err)
	}
	if applied {
		t.Fatal("tie should not have been applied")
	}

	var name string
	if err := s.db.QueryRow(`SELECT name FROM cats WHERE id = 'cat-1'`).Scan(&name); err != nil {
		t.Fatal(err)
	}
	if name != "v1" {
		t.Fatalf("got name %q, want v1", name)
	}
}

func TestUpsertMissingNotNullColumnFails(t *testing.T) {
	s, err := OpenMemory()
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}

	_, err = s.Upsert("cats", map[string]any{
		"id": "cat-1", "sex": "male", "status": "alive",
		"birth_date_is_estimated": 0, "rescue_date_is_estimated": 0,
		"is_neutered": "unknown",
		"created_at":  "2026-08-01T00:00:00Z", "updated_at": "2026-08-01T00:00:00Z",
	})
	if err == nil {
		t.Fatal("expected NOT NULL constraint error for missing name")
	}
	if !strings.Contains(err.Error(), "NOT NULL") {
		t.Fatalf("error %q should mention NOT NULL constraint", err)
	}
}

func TestPullChangesSince(t *testing.T) {
	s, err := OpenMemory()
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}

	old := map[string]any{
		"id": "cat-1", "name": "Miko", "sex": "male", "status": "alive",
		"created_at": "2026-07-01T00:00:00Z", "updated_at": "2026-07-01T00:00:00Z",
	}
	newer := map[string]any{
		"id": "cat-2", "name": "Bella", "sex": "female", "status": "alive",
		"created_at": "2026-07-05T00:00:00Z", "updated_at": "2026-07-05T00:00:00Z",
	}
	for _, c := range []map[string]any{old, newer} {
		if _, err := s.Upsert("cats", c); err != nil {
			t.Fatal(err)
		}
	}

	// since = 2026-07-02 → only cat-2 comes back, with all columns.
	changes, err := s.PullChanges(mustTime(t, "2026-07-02T00:00:00Z"))
	if err != nil {
		t.Fatal(err)
	}
	rows := changes["cats"]
	if len(rows) != 1 {
		t.Fatalf("got %d rows, want 1", len(rows))
	}
	if rows[0]["id"] != "cat-2" {
		t.Fatalf("got id %v, want cat-2", rows[0]["id"])
	}
	if rows[0]["name"] != "Bella" || rows[0]["sex"] != "female" {
		t.Fatalf("unexpected row: %v", rows[0])
	}
	if rows[0]["deleted_at"] != nil {
		t.Fatalf("deleted_at should be nil, got %v", rows[0]["deleted_at"])
	}
}

func TestPullIncludesDeletedRows(t *testing.T) {
	s, err := OpenMemory()
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}

	row := map[string]any{
		"id": "cat-1", "name": "Miko", "sex": "male", "status": "alive",
		"created_at": "2026-07-01T00:00:00Z", "updated_at": "2026-07-01T00:00:00Z",
	}
	if _, err := s.Upsert("cats", row); err != nil {
		t.Fatal(err)
	}
	row["deleted_at"] = "2026-07-10T00:00:00Z"
	row["updated_at"] = "2026-07-10T00:00:00Z"
	if _, err := s.Upsert("cats", row); err != nil {
		t.Fatal(err)
	}

	changes, err := s.PullChanges(mustTime(t, "2026-07-02T00:00:00Z"))
	if err != nil {
		t.Fatal(err)
	}
	rows := changes["cats"]
	if len(rows) != 1 {
		t.Fatalf("got %d rows, want 1", len(rows))
	}
	if rows[0]["deleted_at"] != "2026-07-10T00:00:00Z" {
		t.Fatalf("expected deleted_at to be synced, got %v", rows[0]["deleted_at"])
	}
}

func TestPushRowsAppliesChildBeforeParent(t *testing.T) {
	s, err := OpenMemory()
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}

	// A moment referencing a cat that hasn't been synced yet — both arrive
	// in the same batch. foreign_keys=OFF during push makes this work.
	changes := map[string][]map[string]any{
		"moments": {{
			"id": "m-1", "cat_id": "cat-99", "kind": "milestone", "title": "First mouse",
			"occurred_at": "2026-07-20T00:00:00Z",
			"created_at": "2026-07-20T00:00:00Z", "updated_at": "2026-07-20T00:00:00Z",
		}},
		"cats": {{
			"id": "cat-99", "name": "Miko", "sex": "male", "status": "alive",
			"created_at": "2026-07-20T00:00:00Z", "updated_at": "2026-07-20T00:00:00Z",
		}},
	}
	applied, err := s.PushRows(changes)
	if err != nil {
		t.Fatal(err)
	}
	if applied != 2 {
		t.Fatalf("got %d applied, want 2", applied)
	}

	var count int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM moments WHERE id = 'm-1'`).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("moment not stored, count=%d", count)
	}
}

func TestPushRowsLastWriteWins(t *testing.T) {
	s, err := OpenMemory()
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}

	first := map[string][]map[string]any{
		"cats": {{"id": "cat-1", "name": "Miko", "sex": "male", "status": "alive",
			"created_at": "2026-07-01T00:00:00Z", "updated_at": "2026-07-01T00:00:00Z"}},
	}
	if _, err := s.PushRows(first); err != nil {
		t.Fatal(err)
	}
	older := map[string][]map[string]any{
		"cats": {{"id": "cat-1", "name": "STALE", "sex": "male", "status": "alive",
			"created_at": "2026-07-01T00:00:00Z", "updated_at": "2026-06-30T00:00:00Z"}},
	}
	if _, err := s.PushRows(older); err != nil {
		t.Fatal(err)
	}
	var name string
	if err := s.db.QueryRow(`SELECT name FROM cats WHERE id = 'cat-1'`).Scan(&name); err != nil {
		t.Fatal(err)
	}
	if name != "Miko" {
		t.Fatalf("got %q, want Miko (older push must lose)", name)
	}
}

func mustTime(t *testing.T, s string) time.Time {
	t.Helper()
	ts, err := time.Parse(time.RFC3339, s)
	if err != nil {
		t.Fatal(err)
	}
	return ts
}
