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

	applied, err := s.Upsert("pets", map[string]any{
		"id":         "pet-1",
		"name":       "Miko",
		"species":    "cat",
		"sex":        "male",
		"status":     "alive",
		"created_at": "2026-08-01T00:00:00.000Z",
		"updated_at": "2026-08-01T00:00:00.000Z",
	})
	if err != nil {
		t.Fatal(err)
	}
	if !applied {
		t.Fatal("expected new row to be applied")
	}

	var name string
	if err := s.db.QueryRow(`SELECT name FROM pets WHERE id = 'pet-1'`).Scan(&name); err != nil {
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
			"id":         "pet-1",
			"name":       name,
			"species":    "cat",
			"sex":        "male",
			"status":     "alive",
			"created_at": "2026-08-01T00:00:00.000Z",
			"updated_at": updated,
		}
	}

	if _, err := s.Upsert("pets", mk("2026-08-01T01:00:00.000Z", "v1")); err != nil {
		t.Fatal(err)
	}

	// Older incoming row must NOT overwrite.
	applied, err := s.Upsert("pets", mk("2026-08-01T00:30:00.000Z", "older"))
	if err != nil {
		t.Fatal(err)
	}
	if applied {
		t.Fatal("older row should not have been applied")
	}

	// Newer incoming row must overwrite.
	applied, err = s.Upsert("pets", mk("2026-08-01T02:00:00.000Z", "newer"))
	if err != nil {
		t.Fatal(err)
	}
	if !applied {
		t.Fatal("newer row should have been applied")
	}

	var name string
	if err := s.db.QueryRow(`SELECT name FROM pets WHERE id = 'pet-1'`).Scan(&name); err != nil {
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

	if _, err := s.Upsert("nope", map[string]any{"id": "x", "updated_at": "2026-08-01T00:00:00.000Z"}); err == nil {
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

	if _, err := s.Upsert("pets", map[string]any{"updated_at": "2026-08-01T00:00:00.000Z"}); err == nil {
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

	_, err = s.Upsert("pets", map[string]any{
		"id":         "pet-1",
		"name":       "Miko",
		"created_at": "2026-08-01T00:00:00.000Z",
		"updated_at": "2026-08-01T00:00:00.000Z",
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

	if _, err := s.Upsert("pets", map[string]any{"id": "pet-1", "name": "Miko", "created_at": "2026-08-01T00:00:00.000Z"}); err == nil {
		t.Fatal("expected error for missing updated_at")
	}
}

func TestUpsertRejectsBadTimestampFormat(t *testing.T) {
	s, err := OpenMemory()
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}

	for _, up := range []string{
		"2026-07-01T00:00:00Z",      // second precision, no milliseconds
		"2026-07-01T00:00:00+07:00", // timezone offset instead of Z
		"2026-07-01T00:00:00.12Z",   // wrong fraction width
	} {
		_, err := s.Upsert("pets", map[string]any{
			"id": "pet-1", "name": "Miko", "species": "cat", "sex": "male", "status": "alive",
			"created_at": "2026-07-01T00:00:00.000Z", "updated_at": up,
		})
		if err == nil {
			t.Fatalf("expected error for updated_at %q", up)
		}
		if !strings.Contains(err.Error(), "invalid updated_at") {
			t.Fatalf("error %q should mention invalid updated_at for %q", err, up)
		}
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

	if _, err := s.Upsert("pets", map[string]any{
		"id":         "pet-1",
		"name":       "Miko",
		"created_at": "2026-08-01T00:00:00.000Z",
		"updated_at": "2026-08-01T00:00:00.000Z",
	}); err != nil {
		t.Fatal(err)
	}

	var birthEstimated, rescueEstimated int64
	var isNeutered, sex, status, species string
	if err := s.db.QueryRow(`SELECT birth_date_is_estimated, rescue_date_is_estimated, is_neutered, sex, status, species FROM pets WHERE id = 'pet-1'`).Scan(&birthEstimated, &rescueEstimated, &isNeutered, &sex, &status, &species); err != nil {
		t.Fatal(err)
	}
	if birthEstimated != 0 || rescueEstimated != 0 || isNeutered != "unknown" || sex != "unknown" || status != "alive" || species != "cat" {
		t.Fatalf("got defaults (%d, %d, %q, %q, %q, %q), want (0, 0, %q, %q, %q, %q)", birthEstimated, rescueEstimated, isNeutered, sex, status, species, "unknown", "unknown", "alive", "cat")
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
			"id": "pet-1", "name": name, "species": "cat", "sex": "male", "status": "alive",
			"birth_date_is_estimated": 0, "rescue_date_is_estimated": 0,
			"is_neutered": "unknown", "story": story,
			"created_at": "2026-08-01T00:00:00.000Z", "updated_at": updated,
		}
	}
	if _, err := s.Upsert("pets", full("Miko", "a", "2026-08-01T01:00:00.000Z")); err != nil {
		t.Fatal(err)
	}

	// Newer row without a story key: story must stay unchanged.
	applied, err := s.Upsert("pets", map[string]any{
		"id": "pet-1", "name": "Miko2", "species": "cat", "sex": "male", "status": "alive",
		"birth_date_is_estimated": 0, "rescue_date_is_estimated": 0,
		"is_neutered": "unknown",
		"created_at":  "2026-08-01T00:00:00.000Z", "updated_at": "2026-08-01T02:00:00.000Z",
	})
	if err != nil {
		t.Fatal(err)
	}
	if !applied {
		t.Fatal("newer row should have been applied")
	}

	var name, story string
	if err := s.db.QueryRow(`SELECT name, story FROM pets WHERE id = 'pet-1'`).Scan(&name, &story); err != nil {
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
			"id": "pet-1", "name": "Miko", "species": "cat", "sex": "male", "status": "alive",
			"birth_date_is_estimated": 0, "rescue_date_is_estimated": 0,
			"is_neutered": "unknown", "story": story,
			"created_at": "2026-08-01T00:00:00.000Z", "updated_at": updated,
		}
	}
	if _, err := s.Upsert("pets", full("a", "2026-08-01T01:00:00.000Z")); err != nil {
		t.Fatal(err)
	}

	applied, err := s.Upsert("pets", full(nil, "2026-08-01T02:00:00.000Z"))
	if err != nil {
		t.Fatal(err)
	}
	if !applied {
		t.Fatal("newer row should have been applied")
	}

	var story sql.NullString
	if err := s.db.QueryRow(`SELECT story FROM pets WHERE id = 'pet-1'`).Scan(&story); err != nil {
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
			"id": "pet-1", "name": name, "species": "cat", "sex": "male", "status": "alive",
			"birth_date_is_estimated": 0, "rescue_date_is_estimated": 0,
			"is_neutered": "unknown",
			"created_at":  "2026-08-01T00:00:00.000Z", "updated_at": updated,
		}
	}
	if _, err := s.Upsert("pets", mk("2026-08-01T01:00:00.000Z", "v1")); err != nil {
		t.Fatal(err)
	}

	// Same updated_at must NOT overwrite (strict < comparison).
	applied, err := s.Upsert("pets", mk("2026-08-01T01:00:00.000Z", "v2"))
	if err != nil {
		t.Fatal(err)
	}
	if applied {
		t.Fatal("tie should not have been applied")
	}

	var name string
	if err := s.db.QueryRow(`SELECT name FROM pets WHERE id = 'pet-1'`).Scan(&name); err != nil {
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

	_, err = s.Upsert("pets", map[string]any{
		"id": "pet-1", "species": "cat", "sex": "male", "status": "alive",
		"birth_date_is_estimated": 0, "rescue_date_is_estimated": 0,
		"is_neutered": "unknown",
		"created_at":  "2026-08-01T00:00:00.000Z", "updated_at": "2026-08-01T00:00:00.000Z",
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
		"id": "pet-1", "name": "Miko", "species": "cat", "sex": "male", "status": "alive",
		"created_at": "2026-07-01T00:00:00.000Z", "updated_at": "2026-07-01T00:00:00.000Z",
	}
	newer := map[string]any{
		"id": "pet-2", "name": "Bella", "species": "dog", "sex": "female", "status": "alive",
		"created_at": "2026-07-05T00:00:00.000Z", "updated_at": "2026-07-05T00:00:00.000Z",
	}
	for _, c := range []map[string]any{old, newer} {
		if _, err := s.Upsert("pets", c); err != nil {
			t.Fatal(err)
		}
	}

	// since = 2026-07-02 → only pet-2 comes back, with all columns.
	changes, err := s.PullChanges(mustTime(t, "2026-07-02T00:00:00.000Z"))
	if err != nil {
		t.Fatal(err)
	}
	rows := changes["pets"]
	if len(rows) != 1 {
		t.Fatalf("got %d rows, want 1", len(rows))
	}
	if rows[0]["id"] != "pet-2" {
		t.Fatalf("got id %v, want pet-2", rows[0]["id"])
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
		"id": "pet-1", "name": "Miko", "species": "cat", "sex": "male", "status": "alive",
		"created_at": "2026-07-01T00:00:00.000Z", "updated_at": "2026-07-01T00:00:00.000Z",
	}
	if _, err := s.Upsert("pets", row); err != nil {
		t.Fatal(err)
	}
	row["deleted_at"] = "2026-07-10T00:00:00.000Z"
	row["updated_at"] = "2026-07-10T00:00:00.000Z"
	if _, err := s.Upsert("pets", row); err != nil {
		t.Fatal(err)
	}

	changes, err := s.PullChanges(mustTime(t, "2026-07-02T00:00:00.000Z"))
	if err != nil {
		t.Fatal(err)
	}
	rows := changes["pets"]
	if len(rows) != 1 {
		t.Fatalf("got %d rows, want 1", len(rows))
	}
	if rows[0]["deleted_at"] != "2026-07-10T00:00:00.000Z" {
		t.Fatalf("expected deleted_at to be synced, got %v", rows[0]["deleted_at"])
	}
}

func TestPushRowsReferencesParentInSameBatch(t *testing.T) {
	s, err := OpenMemory()
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}

	// Child listed FIRST, parent second — only defer_foreign_keys makes
	// this pass; pushOrder alone cannot help within one table's slice.
	changes := map[string][]map[string]any{
		"events": {
			{"id": "e-1", "pet_id": "pet-1", "kind": "milestone", "title": "First walk",
				"occurred_at": "2026-07-20T00:00:00.000Z",
				"created_at":  "2026-07-20T00:00:00.000Z", "updated_at": "2026-07-20T00:00:00.000Z"},
		},
		"pets": {
			{"id": "pet-1", "name": "Miko", "species": "cat", "sex": "male", "status": "alive",
				"created_at": "2026-07-20T00:00:00.000Z", "updated_at": "2026-07-20T00:00:00.000Z"},
		},
	}
	applied, err := s.PushRows(changes)
	if err != nil {
		t.Fatal(err)
	}
	if applied != 2 {
		t.Fatalf("got %d applied, want 2", applied)
	}

	var petID string
	if err := s.db.QueryRow(`SELECT pet_id FROM events WHERE id = 'e-1'`).Scan(&petID); err != nil {
		t.Fatal(err)
	}
	if petID != "pet-1" {
		t.Fatalf("got pet_id %q, want pet-1", petID)
	}
}

func TestPushRowsOrphanedChildRollsBack(t *testing.T) {
	s, err := OpenMemory()
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}

	// Event references a pet that exists nowhere — the push must fail at
	// commit and roll back the whole batch, including the valid pet row.
	changes := map[string][]map[string]any{
		"pets": {{
			"id": "pet-1", "name": "Miko", "species": "cat", "sex": "male", "status": "alive",
			"created_at": "2026-07-20T00:00:00.000Z", "updated_at": "2026-07-20T00:00:00.000Z",
		}},
		"events": {{
			"id": "e-1", "pet_id": "pet-orphan", "kind": "milestone", "title": "First mouse",
			"occurred_at": "2026-07-20T00:00:00.000Z",
			"created_at":  "2026-07-20T00:00:00.000Z", "updated_at": "2026-07-20T00:00:00.000Z",
		}},
	}
	if _, err := s.PushRows(changes); err == nil {
		t.Fatal("expected FK failure at commit for orphaned event")
	}

	var pets, events int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM pets`).Scan(&pets); err != nil {
		t.Fatal(err)
	}
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM events`).Scan(&events); err != nil {
		t.Fatal(err)
	}
	if pets != 0 || events != 0 {
		t.Fatalf("push must roll back entirely, got pets=%d events=%d", pets, events)
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
		"pets": {{"id": "pet-1", "name": "Miko", "species": "cat", "sex": "male", "status": "alive",
			"created_at": "2026-07-01T00:00:00.000Z", "updated_at": "2026-07-01T00:00:00.000Z"}},
	}
	if _, err := s.PushRows(first); err != nil {
		t.Fatal(err)
	}
	older := map[string][]map[string]any{
		"pets": {{"id": "pet-1", "name": "STALE", "species": "cat", "sex": "male", "status": "alive",
			"created_at": "2026-07-01T00:00:00.000Z", "updated_at": "2026-06-30T00:00:00.000Z"}},
	}
	if _, err := s.PushRows(older); err != nil {
		t.Fatal(err)
	}
	var name string
	if err := s.db.QueryRow(`SELECT name FROM pets WHERE id = 'pet-1'`).Scan(&name); err != nil {
		t.Fatal(err)
	}
	if name != "Miko" {
		t.Fatalf("got %q, want Miko (older push must lose)", name)
	}
}

func TestPullChangesEmptyTablesAreEmptyArrays(t *testing.T) {
	s, err := OpenMemory()
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}

	changes, err := s.PullChanges(mustTime(t, "2026-01-01T00:00:00.000Z"))
	if err != nil {
		t.Fatal(err)
	}
	for _, tbl := range TableNames {
		rows, ok := changes[tbl]
		if !ok || rows == nil {
			t.Fatalf("table %s: want non-nil empty slice, got %v", tbl, rows)
		}
		if len(rows) != 0 {
			t.Fatalf("table %s: want 0 rows, got %d", tbl, len(rows))
		}
	}
}

func TestPushRowsRejectsUnknownTable(t *testing.T) {
	s, err := OpenMemory()
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}

	applied, err := s.PushRows(map[string][]map[string]any{
		"nope": {{"id": "x", "updated_at": "2026-01-01T00:00:00.000Z"}},
	})
	if err == nil {
		t.Fatal("want error for unknown table, got nil")
	}
	if applied != 0 {
		t.Fatalf("want applied 0, got %d", applied)
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
