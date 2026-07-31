# Pawly Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Pawly home server — a single Go binary with SQLite that stores the family's cat data and syncs with the offline-first mobile app.

**Architecture:** `net/http` (no framework) with three internal packages: `store` (SQLite schema, migrations, typed sync operations), `photos` (photo files on disk), `api` (HTTP handlers). Sync is timestamp-based: every table has `id`, `created_at`, `updated_at`, `deleted_at`; the phone pulls rows changed since a timestamp and pushes its own rows; conflicts resolve by newest `updated_at` (last-write-wins). Push runs in a transaction with `foreign_keys=OFF` so rows can arrive in any order (e.g. a moment referencing a cat that arrives later in the same batch).

**Tech Stack:** Go 1.22+ (1.26.5 installed), `modernc.org/sqlite` (pure-Go driver, single static binary), `net/http` with Go 1.22 path patterns (`GET /photos/{id}`).

**Spec:** `docs/superpowers/specs/2026-08-01-pawly-design.md`

**Repo layout:**
```
server/
  go.mod
  cmd/pawly/main.go
  internal/store/store.go
  internal/store/store_test.go
  internal/photos/photos.go
  internal/photos/photos_test.go
  internal/api/api.go
  internal/api/api_test.go
  internal/api/integration_test.go
  deploy/com.rafif.pawly.plist
  README.md
```

---

### Task 1: Module scaffold and store foundation (open, migrate)

**Files:**
- Create: `server/go.mod`
- Create: `server/internal/store/store.go`
- Test: `server/internal/store/store_test.go`

- [ ] **Step 1: Scaffold the module**

```bash
mkdir -p server/cmd/pawly server/internal/store server/internal/photos server/internal/api server/deploy
cd server
go mod init pawly
go get modernc.org/sqlite@latest
```

Expected: `go.mod` created with module `pawly`, `go.sum` populated.

- [ ] **Step 2: Write the failing migration test**

Create `server/internal/store/store_test.go`:

```go
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd server && go test ./internal/store/ -run TestMigrate -v`
Expected: FAIL — package `store` has no Go files yet.

- [ ] **Step 4: Write the minimal store**

Create `server/internal/store/store.go`:

```go
package store

import (
	"database/sql"
	"fmt"
	"time"

	_ "modernc.org/sqlite"
)

// TableNames lists every synced table, in dependency order.
var TableNames = []string{"cats", "moments", "purchases", "reminders", "reminder_completions", "photos"}

// columnsByTable is the allow-list of columns per table. Unknown columns are
// rejected during upsert. Order matters: it defines insert/select column order.
var columnsByTable = map[string][]string{
	"cats":                 {"id", "name", "sex", "birth_date", "birth_date_is_estimated", "rescue_date", "rescue_date_is_estimated", "is_neutered", "story", "status", "passed_away_date", "mother_id", "father_id", "created_at", "updated_at", "deleted_at"},
	"moments":              {"id", "cat_id", "kind", "title", "text", "occurred_at", "next_due_at", "created_at", "updated_at", "deleted_at"},
	"photos":               {"id", "moment_id", "purchase_id", "taken_at", "content_type", "created_at", "updated_at", "deleted_at"},
	"reminders":            {"id", "title", "scope", "cat_id", "time", "days_of_week", "created_at", "updated_at", "deleted_at"},
	"reminder_completions": {"id", "reminder_id", "completed_at", "note", "created_at", "updated_at", "deleted_at"},
	"purchases":            {"id", "item", "price", "category", "date", "note", "cat_id", "created_at", "updated_at", "deleted_at"},
}

// pushOrder is the order rows are upserted in during a push.
var pushOrder = []string{"cats", "moments", "purchases", "reminders", "reminder_completions", "photos"}

// migrations are applied in order at startup. Each entry is one numbered migration.
var migrations = []string{
	// 1: initial schema
	`
CREATE TABLE cats (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	sex TEXT NOT NULL DEFAULT 'unknown',
	birth_date TEXT,
	birth_date_is_estimated INTEGER NOT NULL DEFAULT 0,
	rescue_date TEXT,
	rescue_date_is_estimated INTEGER NOT NULL DEFAULT 0,
	is_neutered TEXT NOT NULL DEFAULT 'unknown',
	story TEXT,
	status TEXT NOT NULL DEFAULT 'alive',
	passed_away_date TEXT,
	mother_id TEXT REFERENCES cats(id),
	father_id TEXT REFERENCES cats(id),
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	deleted_at TEXT
);
CREATE TABLE moments (
	id TEXT PRIMARY KEY,
	cat_id TEXT REFERENCES cats(id),
	kind TEXT NOT NULL,
	title TEXT,
	text TEXT,
	occurred_at TEXT NOT NULL,
	next_due_at TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	deleted_at TEXT
);
CREATE TABLE photos (
	id TEXT PRIMARY KEY,
	moment_id TEXT REFERENCES moments(id),
	purchase_id TEXT REFERENCES purchases(id),
	taken_at TEXT,
	content_type TEXT NOT NULL DEFAULT 'image/jpeg',
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	deleted_at TEXT
);
CREATE TABLE reminders (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL,
	scope TEXT NOT NULL DEFAULT 'household',
	cat_id TEXT REFERENCES cats(id),
	time TEXT NOT NULL,
	days_of_week TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	deleted_at TEXT
);
CREATE TABLE reminder_completions (
	id TEXT PRIMARY KEY,
	reminder_id TEXT REFERENCES reminders(id),
	completed_at TEXT NOT NULL,
	note TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	deleted_at TEXT
);
CREATE TABLE purchases (
	id TEXT PRIMARY KEY,
	item TEXT NOT NULL,
	price INTEGER NOT NULL,
	category TEXT NOT NULL DEFAULT 'other',
	date TEXT NOT NULL,
	note TEXT,
	cat_id TEXT REFERENCES cats(id),
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	deleted_at TEXT
);
CREATE INDEX idx_cats_updated ON cats(updated_at);
CREATE INDEX idx_moments_updated ON moments(updated_at);
CREATE INDEX idx_photos_updated ON photos(updated_at);
CREATE INDEX idx_reminders_updated ON reminders(updated_at);
CREATE INDEX idx_completions_updated ON reminder_completions(updated_at);
CREATE INDEX idx_purchases_updated ON purchases(updated_at);
`,
}

type Store struct {
	db *sql.DB
}

// Open opens (creating if needed) the SQLite database at path.
func Open(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	if err := configure(db); err != nil {
		db.Close()
		return nil, err
	}
	return &Store{db: db}, nil
}

// OpenMemory opens an in-memory database (for tests).
func OpenMemory() (*Store, error) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		return nil, err
	}
	if err := configure(db); err != nil {
		db.Close()
		return nil, err
	}
	return &Store{db: db}, nil
}

// configure sets connection pragmas. MaxOpenConns(1) keeps pragmas
// effective on the single shared connection.
func configure(db *sql.DB) error {
	db.SetMaxOpenConns(1)
	for _, pragma := range []string{
		`PRAGMA journal_mode=WAL;`,
		`PRAGMA foreign_keys=ON;`,
		`PRAGMA busy_timeout=5000;`,
	} {
		if _, err := db.Exec(pragma); err != nil {
			return fmt.Errorf("pragma %q: %w", pragma, err)
		}
	}
	return nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

// Migrate applies any pending migrations, tracked in schema_migrations.
func (s *Store) Migrate() error {
	if _, err := s.db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`); err != nil {
		return err
	}
	for i, m := range migrations {
		var count int
		if err := s.db.QueryRow(`SELECT COUNT(*) FROM schema_migrations WHERE version = ?`, i).Scan(&count); err != nil {
			return err
		}
		if count > 0 {
			continue
		}
		tx, err := s.db.Begin()
		if err != nil {
			return err
		}
		if _, err := tx.Exec(m); err != nil {
			tx.Rollback()
			return err
		}
		if _, err := tx.Exec(`INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)`, i, time.Now().UTC().Format(time.RFC3339)); err != nil {
			tx.Rollback()
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
	}
	return nil
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd server && go test ./internal/store/ -run TestMigrate -v`
Expected: PASS (both tests).

- [ ] **Step 6: Commit**

```bash
git add server/
git commit -m "feat(server): scaffold store with schema migrations"
```

---

### Task 2: Store upsert with last-write-wins

**Files:**
- Modify: `server/internal/store/store.go`
- Test: `server/internal/store/store_test.go`

- [ ] **Step 1: Write the failing tests**

Append to `server/internal/store/store_test.go`:

```go
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && go test ./internal/store/ -run TestUpsert -v`
Expected: FAIL — `s.Upsert` undefined.

- [ ] **Step 3: Implement upsert**

Append to `server/internal/store/store.go`:

```go
// execer is satisfied by both *sql.DB and *sql.Tx.
type execer interface {
	Exec(query string, args ...any) (sql.Result, error)
}

// Upsert inserts row into table, or updates the existing row when the
// incoming updated_at is newer (last-write-wins). Returns true when the
// row was applied.
func (s *Store) Upsert(table string, row map[string]any) (bool, error) {
	return upsert(s.db, table, row)
}

func upsert(exec execer, table string, row map[string]any) (bool, error) {
	cols, ok := columnsByTable[table]
	if !ok {
		return false, fmt.Errorf("unknown table %q", table)
	}
	id, ok := row["id"].(string)
	if !ok || id == "" {
		return false, fmt.Errorf("row in %q missing string id", table)
	}
	up, ok := row["updated_at"].(string)
	if !ok || up == "" {
		return false, fmt.Errorf("row %q in %q missing string updated_at", id, table)
	}

	insertCols := strings.Join(cols, ", ")
	placeholders := strings.Repeat("?,", len(cols)-1) + "?"

	set := make([]string, 0, len(cols)-1)
	args := make([]any, 0, len(cols))
	for _, c := range cols {
		if c == "id" {
			continue
		}
		set = append(set, c+" = ?")
		args = append(args, row[c]) // missing columns become nil (NULL)
	}
	args = append(args, id)

	query := fmt.Sprintf(
		`INSERT INTO %s (%s) VALUES (%s)
		 ON CONFLICT(id) DO UPDATE SET %s
		 WHERE %s.updated_at < excluded.updated_at`,
		table, insertCols, placeholders, strings.Join(set, ", "), table,
	)
	res, err := exec.Exec(query, args...)
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return false, err
	}
	return n > 0, nil
}
```

Add `"strings"` to the imports in `server/internal/store/store.go`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd server && go test ./internal/store/ -run TestUpsert -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add server/internal/store/
git commit -m "feat(server): last-write-wins upsert for synced rows"
```

---

### Task 3: Pull changes and ordered push

**Files:**
- Modify: `server/internal/store/store.go`
- Test: `server/internal/store/store_test.go`

- [ ] **Step 1: Write the failing tests**

Append to `server/internal/store/store_test.go`:

```go
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
```

Add `"time"` to the test file imports.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && go test ./internal/store/ -run TestPull -v && go test ./internal/store/ -run TestPush -v`
Expected: FAIL — `PullChanges`/`PushRows` undefined.

- [ ] **Step 3: Implement pull and push**

Append to `server/internal/store/store.go`:

```go
// PullChanges returns, per table, every row with updated_at newer than since.
func (s *Store) PullChanges(since time.Time) (map[string][]map[string]any, error) {
	out := make(map[string][]map[string]any, len(TableNames))
	for _, t := range TableNames {
		cols := columnsByTable[t]
		rows, err := s.db.Query(
			fmt.Sprintf(`SELECT %s FROM %s WHERE updated_at > ? ORDER BY updated_at`,
				strings.Join(cols, ", "), t),
			since.UTC().Format(time.RFC3339),
		)
		if err != nil {
			return nil, err
		}
		collected, err := scanRows(rows, cols)
		rows.Close()
		if err != nil {
			return nil, err
		}
		out[t] = collected
	}
	return out, nil
}

func scanRows(rows *sql.Rows, cols []string) ([]map[string]any, error) {
	var out []map[string]any
	for rows.Next() {
		dest := make([]any, len(cols))
		ptr := make([]any, len(cols))
		for i := range dest {
			ptr[i] = &dest[i]
		}
		if err := rows.Scan(ptr...); err != nil {
			return nil, err
		}
		row := make(map[string]any, len(cols))
		for i, c := range cols {
			row[c] = dest[i]
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

// PushRows upserts all rows in changes, applying tables in pushOrder.
// Runs in one transaction with foreign keys temporarily disabled so rows
// may reference rows arriving later in the same batch (e.g. a moment whose
// cat is in the same push). Returns the number of rows actually applied.
func (s *Store) PushRows(changes map[string][]map[string]any) (int, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`PRAGMA foreign_keys=OFF;`); err != nil {
		return 0, err
	}
	applied := 0
	for _, t := range pushOrder {
		for _, row := range changes[t] {
			ok, err := upsert(tx, t, row)
			if err != nil {
				return applied, fmt.Errorf("push %s: %w", t, err)
			}
			if ok {
				applied++
			}
		}
	}
	if _, err := tx.Exec(`PRAGMA foreign_keys=ON;`); err != nil {
		return 0, err
	}
	return applied, tx.Commit()
}

// PhotoMeta returns the content type of a photo row that exists and is not
// deleted. exists is false when the row is missing or deleted.
func (s *Store) PhotoMeta(id string) (contentType string, exists bool, err error) {
	var ct string
	err = s.db.QueryRow(`SELECT content_type FROM photos WHERE id = ? AND deleted_at IS NULL`, id).Scan(&ct)
	if err == sql.ErrNoRows {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return ct, true, nil
}

// SetPhotoContentType updates a photo's stored content type.
func (s *Store) SetPhotoContentType(id, ct string) error {
	_, err := s.db.Exec(`UPDATE photos SET content_type = ? WHERE id = ?`, ct, id)
	return err
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd server && go test ./internal/store/ -v`
Expected: PASS (all tests, including Task 1 and 2).

- [ ] **Step 5: Commit**

```bash
git add server/internal/store/
git commit -m "feat(server): pull changes since timestamp, ordered push transaction"
```

---

### Task 4: Photos on disk

**Files:**
- Create: `server/internal/photos/photos.go`
- Test: `server/internal/photos/photos_test.go`

- [ ] **Step 1: Write the failing test**

Create `server/internal/photos/photos_test.go`:

```go
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd server && go test ./internal/photos/ -v`
Expected: FAIL — package `photos` has no Go files.

- [ ] **Step 3: Implement the photos store**

Create `server/internal/photos/photos.go`:

```go
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd server && go test ./internal/photos/ -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add server/internal/photos/
git commit -m "feat(server): photo file storage with atomic writes"
```

---

### Task 5: API — health, pull, push

**Files:**
- Create: `server/internal/api/api.go`
- Test: `server/internal/api/api_test.go`

- [ ] **Step 1: Write the failing tests**

Create `server/internal/api/api_test.go`:

```go
package api

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"pawly/internal/photos"
	"pawly/internal/store"
)

func newTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	st, err := store.OpenMemory()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	if err := st.Migrate(); err != nil {
		t.Fatal(err)
	}
	srv := New(st, photos.New(t.TempDir()))
	ts := httptest.NewServer(srv.Handler())
	t.Cleanup(ts.Close)
	return ts
}

func getJSON(t *testing.T, url string) (int, map[string]any) {
	t.Helper()
	res, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	body, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	var out map[string]any
	if err := json.Unmarshal(body, &out); err != nil {
		t.Fatalf("bad JSON %q: %v", body, err)
	}
	return res.StatusCode, out
}

func postJSON(t *testing.T, url string, payload string) (int, map[string]any) {
	t.Helper()
	res, err := http.Post(url, "application/json", strings.NewReader(payload))
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	body, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	var out map[string]any
	if len(body) > 0 {
		if err := json.Unmarshal(body, &out); err != nil {
			t.Fatalf("bad JSON %q: %v", body, err)
		}
	}
	return res.StatusCode, out
}

func TestHealthz(t *testing.T) {
	ts := newTestServer(t)
	code, _ := getJSON(t, ts.URL+"/healthz")
	if code != http.StatusOK {
		t.Fatalf("got %d, want 200", code)
	}
}

func TestPullEmpty(t *testing.T) {
	ts := newTestServer(t)
	code, out := getJSON(t, ts.URL+"/sync/pull")
	if code != http.StatusOK {
		t.Fatalf("got %d, want 200", code)
	}
	changes, ok := out["changes"].(map[string]any)
	if !ok {
		t.Fatalf("missing changes: %v", out)
	}
	for _, tbl := range []string{"cats", "moments", "photos", "reminders", "reminder_completions", "purchases"} {
		rows, ok := changes[tbl].([]any)
		if !ok || len(rows) != 0 {
			t.Fatalf("table %s: want empty array, got %v", tbl, changes[tbl])
		}
	}
	if _, ok := out["server_time"].(string); !ok {
		t.Fatalf("missing server_time: %v", out)
	}
}

func TestPushThenPullRoundtrip(t *testing.T) {
	ts := newTestServer(t)

	push := `{
		"changes": {
			"cats": [{"id":"cat-1","name":"Miko","sex":"male","status":"alive",
				"created_at":"2026-07-01T00:00:00Z","updated_at":"2026-07-01T00:00:00Z"}],
			"purchases": [{"id":"p-1","item":"Whiskas 1.2kg","price":65000,"category":"food",
				"date":"2026-07-28","note":"","created_at":"2026-07-28T00:00:00Z","updated_at":"2026-07-28T00:00:00Z"}]
		}
	}`
	code, out := postJSON(t, ts.URL+"/sync/push", push)
	if code != http.StatusOK {
		t.Fatalf("push got %d: %v", code, out)
	}
	if out["status"] != "ok" || out["applied"] != float64(2) {
		t.Fatalf("unexpected push response: %v", out)
	}

	code, out = getJSON(t, ts.URL+"/sync/pull?since=2026-01-01T00:00:00Z")
	if code != http.StatusOK {
		t.Fatalf("pull got %d", code)
	}
	changes := out["changes"].(map[string]any)
	cats := changes["cats"].([]any)
	if len(cats) != 1 {
		t.Fatalf("want 1 cat, got %v", cats)
	}
	cat := cats[0].(map[string]any)
	if cat["name"] != "Miko" || cat["id"] != "cat-1" {
		t.Fatalf("unexpected cat row: %v", cat)
	}
	purchases := changes["purchases"].([]any)
	if len(purchases) != 1 {
		t.Fatalf("want 1 purchase, got %v", purchases)
	}
	pur := purchases[0].(map[string]any)
	if pur["price"] != float64(65000) || pur["category"] != "food" {
		t.Fatalf("unexpected purchase row: %v", pur)
	}
}

func TestPushRejectsUnknownTable(t *testing.T) {
	ts := newTestServer(t)
	code, _ := postJSON(t, ts.URL+"/sync/push", `{"changes":{"nope":[{"id":"x","updated_at":"2026-01-01T00:00:00Z"}]}}`)
	if code != http.StatusBadRequest {
		t.Fatalf("got %d, want 400", code)
	}
}

func TestPushRejectsBadSince(t *testing.T) {
	ts := newTestServer(t)
	code, _ := getJSON(t, ts.URL+"/sync/pull?since=not-a-time")
	if code != http.StatusBadRequest {
		t.Fatalf("got %d, want 400", code)
	}
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && go test ./internal/api/ -v`
Expected: FAIL — package `api` has no Go files.

- [ ] **Step 3: Implement the API server**

Create `server/internal/api/api.go`:

```go
// Package api exposes the Pawly sync API over HTTP.
package api

import (
	"encoding/json"
	"errors"
	"io"
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

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
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
		writeError(w, http.StatusInternalServerError, err.Error())
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.Changes == nil {
		writeError(w, http.StatusBadRequest, "missing changes")
		return
	}
	applied, err := s.store.PushRows(req.Changes)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "applied": applied})
}

func (s *Server) handlePutPhoto(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	_, exists, err := s.store.PhotoMeta(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if !exists {
		writeError(w, http.StatusNotFound, "photo row not found")
		return
	}
	data, err := io.ReadAll(io.LimitReader(r.Body, maxPhotoBytes))
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read body")
		return
	}
	if len(data) == 0 {
		writeError(w, http.StatusBadRequest, "empty body")
		return
	}
	if err := s.photos.Save(id, data); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if ct := r.Header.Get("Content-Type"); ct != "" {
		_ = s.store.SetPhotoContentType(id, ct)
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleGetPhoto(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	ct, exists, err := s.store.PhotoMeta(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
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
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.Header().Set("Content-Type", ct)
	w.Write(data)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd server && go test ./internal/api/ -v`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add server/internal/api/
git commit -m "feat(server): sync API endpoints (health, pull, push)"
```

---

### Task 6: Photo upload/download endpoints

**Files:**
- Modify: `server/internal/api/api.go`
- Test: `server/internal/api/api_test.go`

- [ ] **Step 1: Write the failing tests**

Append to `server/internal/api/api_test.go`:

```go
func TestPhotoPutGetRoundtrip(t *testing.T) {
	ts := newTestServer(t)

	// Register the photo row first (as the phone would after pushing it).
	push := `{
		"changes": {
			"moments": [{"id":"m-1","kind":"milestone","title":"First mouse",
				"occurred_at":"2026-07-20T00:00:00Z",
				"created_at":"2026-07-20T00:00:00Z","updated_at":"2026-07-20T00:00:00Z"}],
			"photos": [{"id":"ph-1","moment_id":"m-1","taken_at":"2026-07-20T00:00:00Z",
				"created_at":"2026-07-20T00:00:00Z","updated_at":"2026-07-20T00:00:00Z"}]
		}
	}`
	if code, _ := postJSON(t, ts.URL+"/sync/push", push); code != http.StatusOK {
		t.Fatalf("push got %d", code)
	}

	// Upload the binary.
	req, err := http.NewRequest(http.MethodPut, ts.URL+"/photos/ph-1", strings.NewReader("JPEGBYTES"))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "image/jpeg")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusNoContent {
		t.Fatalf("put got %d, want 204", res.StatusCode)
	}

	// Download it back.
	res, err = http.Get(ts.URL + "/photos/ph-1")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	body, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != http.StatusOK {
		t.Fatalf("get got %d, want 200", res.StatusCode)
	}
	if string(body) != "JPEGBYTES" {
		t.Fatalf("got %q, want JPEGBYTES", body)
	}
	if ct := res.Header.Get("Content-Type"); ct != "image/jpeg" {
		t.Fatalf("content type %q, want image/jpeg", ct)
	}
}

func TestPhotoPutUnknownID(t *testing.T) {
	ts := newTestServer(t)
	req, err := http.NewRequest(http.MethodPut, ts.URL+"/photos/ghost", strings.NewReader("x"))
	if err != nil {
		t.Fatal(err)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusNotFound {
		t.Fatalf("got %d, want 404", res.StatusCode)
	}
}

func TestPhotoGetMissingFile(t *testing.T) {
	ts := newTestServer(t)
	push := `{
		"changes": {
			"photos": [{"id":"ph-2","taken_at":"2026-07-20T00:00:00Z",
				"created_at":"2026-07-20T00:00:00Z","updated_at":"2026-07-20T00:00:00Z"}]
		}
	}`
	if code, _ := postJSON(t, ts.URL+"/sync/push", push); code != http.StatusOK {
		t.Fatalf("push got %d", code)
	}
	res, err := http.Get(ts.URL + "/photos/ph-2")
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusNotFound {
		t.Fatalf("got %d, want 404", res.StatusCode)
	}
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && go test ./internal/api/ -run TestPhoto -v`
Expected: FAIL — photo endpoints don't exist yet (404 from the mux).

- [ ] **Step 3: Confirm the handlers exist**

The photo handlers were already registered in Task 5's `New()` and implemented in `api.go`. Verify the route registration is present:

```bash
grep -n "photos/{id}" server/internal/api/api.go
```

Expected: two lines — `PUT /photos/{id}` and `GET /photos/{id}`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd server && go test ./internal/api/ -v`
Expected: PASS (9 tests total).

- [ ] **Step 5: Commit**

```bash
git add server/internal/api/
git commit -m "feat(server): photo upload and download endpoints"
```

---

### Task 7: Two-device sync integration test

**Files:**
- Create: `server/internal/api/integration_test.go`

- [ ] **Step 1: Write the integration test**

Create `server/internal/api/integration_test.go`:

```go
package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"pawly/internal/photos"
	"pawly/internal/store"
)

// Simulates two phones syncing through the server, converging on the same data.
func TestTwoDevicesConverge(t *testing.T) {
	st, err := store.OpenMemory()
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	if err := st.Migrate(); err != nil {
		t.Fatal(err)
	}
	ts := httptest.NewServer(New(st, photos.New(t.TempDir())).Handler())
	defer ts.Close()

	// Each phone keeps a local store (its working copy).
	phoneA, err := store.OpenMemory()
	if err != nil {
		t.Fatal(err)
	}
	defer phoneA.Close()
	phoneB, err := store.OpenMemory()
	if err != nil {
		t.Fatal(err)
	}
	defer phoneB.Close()

	// Phone A: offline edits — a cat and a milestone moment.
	phoneAEdits := map[string][]map[string]any{
		"cats": {{
			"id": "cat-1", "name": "Miko", "sex": "male", "status": "alive",
			"created_at": "2026-07-01T00:00:00Z", "updated_at": "2026-07-01T00:00:00Z",
		}},
		"moments": {{
			"id": "m-1", "cat_id": "cat-1", "kind": "milestone", "title": "First mouse",
			"occurred_at": "2026-07-20T00:00:00Z",
			"created_at": "2026-07-20T00:00:00Z", "updated_at": "2026-07-20T00:00:00Z",
		}},
	}
	if _, err := phoneA.PushRows(phoneAEdits); err != nil {
		t.Fatal(err)
	}

	// Phone A syncs: push to server, then pull whatever the server has.
	push(t, ts.URL, phoneAEdits)
	changes := pull(t, ts.URL, time.Time{})
	if _, err := phoneA.PushRows(changes); err != nil {
		t.Fatal(err)
	}

	// Phone B syncs for the first time: pulls everything.
	changes = pull(t, ts.URL, time.Time{})
	if _, err := phoneB.PushRows(changes); err != nil {
		t.Fatal(err)
	}

	// Phone B edits: renames the cat and adds a purchase.
	phoneBEdits := map[string][]map[string]any{
		"cats": {{
			"id": "cat-1", "name": "Miko (Bella)", "sex": "male", "status": "alive",
			"created_at": "2026-07-01T00:00:00Z", "updated_at": "2026-07-02T00:00:00Z",
		}},
		"purchases": {{
			"id": "p-1", "item": "Whiskas", "price": 65000, "category": "food",
			"date": "2026-07-28", "created_at": "2026-07-28T00:00:00Z", "updated_at": "2026-07-28T00:00:00Z",
		}},
	}
	if _, err := phoneB.PushRows(phoneBEdits); err != nil {
		t.Fatal(err)
	}
	push(t, ts.URL, phoneBEdits)

	// Phone A pulls the updates.
	changes = pull(t, ts.URL, time.Time{})
	if _, err := phoneA.PushRows(changes); err != nil {
		t.Fatal(err)
	}

	// Both phones must agree on the final state.
	want := map[string]int{"cats": 1, "moments": 1, "purchases": 1}
	for _, ph := range []*store.Store{phoneA, phoneB} {
		got, err := ph.PullChanges(time.Time{})
		if err != nil {
			t.Fatal(err)
		}
		for tbl, n := range want {
			if len(got[tbl]) != n {
				t.Fatalf("phone missing %d %s rows, got %d", n, tbl, len(got[tbl]))
			}
		}
		cat := got["cats"][0]
		if cat["name"] != "Miko (Bella)" {
			t.Fatalf("cat name %q, want Miko (Bella)", cat["name"])
		}
		if len(got["reminder_completions"]) != 0 {
			t.Fatalf("unexpected completions: %v", got["reminder_completions"])
		}
	}
}

func push(t *testing.T, base string, changes map[string][]map[string]any) {
	t.Helper()
	body, err := json.Marshal(map[string]any{"changes": changes})
	if err != nil {
		t.Fatal(err)
	}
	res, err := http.Post(base+"/sync/push", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("push got %d", res.StatusCode)
	}
}

func pull(t *testing.T, base string, since time.Time) map[string][]map[string]any {
	t.Helper()
	url := base + "/sync/pull"
	if !since.IsZero() {
		url += "?since=" + since.UTC().Format(time.RFC3339)
	}
	res, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var out struct {
		Changes map[string][]map[string]any `json:"changes"`
	}
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if out.Changes == nil {
		t.Fatal("missing changes in pull response")
	}
	return out.Changes
}
```

Add `"bytes"` to the imports.

- [ ] **Step 2: Run the test to verify it passes**

Run: `cd server && go test ./internal/api/ -run TestTwoDevicesConverge -v`
Expected: PASS — the full sync loop (phone A edits → push → phone B pulls → B edits → push → A pulls → converge).

- [ ] **Step 3: Run the full test suite**

Run: `cd server && go test ./... -v`
Expected: PASS — all store, photos, and api tests.

- [ ] **Step 4: Commit**

```bash
git add server/internal/api/integration_test.go
git commit -m "test(server): two-device sync convergence integration test"
```

---

### Task 8: Server binary, launchd service, README

**Files:**
- Create: `server/cmd/pawly/main.go`
- Create: `server/deploy/com.rafif.pawly.plist`
- Create: `server/README.md`

- [ ] **Step 1: Write the main binary**

Create `server/cmd/pawly/main.go`:

```go
// pawly is the Pawly home server: a single binary storing family cat data
// in SQLite and serving the sync API for the Pawly mobile app.
package main

import (
	"flag"
	"log"
	"net/http"
	"path/filepath"

	"pawly/internal/api"
	"pawly/internal/photos"
	"pawly/internal/store"
)

func main() {
	port := flag.String("port", "8080", "listen port")
	dataDir := flag.String("data-dir", "./data", "directory for SQLite DB and photos")
	flag.Parse()

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
```

- [ ] **Step 2: Build and smoke-test the binary**

```bash
cd server
go build -o /tmp/pawly ./cmd/pawly
/tmp/pawly -port 18080 -data-dir /tmp/pawly-data &
PID=$!
sleep 1
curl -s http://localhost:18080/healthz
kill $PID

Expected: `{"status":"ok"}` and a `pawly.db` file created in `/tmp/pawly-data`.

- [ ] **Step 3: Write the launchd service file**

Create `server/deploy/com.rafif.pawly.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.rafif.pawly</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/pawly</string>
        <string>-port</string>
        <string>8080</string>
        <string>-data-dir</string>
        <string>/Users/Shared/pawly</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/Shared/pawly/pawly.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/Shared/pawly/pawly.err.log</string>
</dict>
</plist>
```

- [ ] **Step 4: Write the server README**

Create `server/README.md`:

```markdown
# Pawly Server

Home server for the Pawly family pet-care app. Single Go binary + SQLite, no dependencies.

## Build & run

```bash
go build -o pawly ./cmd/pawly
./pawly -data-dir /Users/Shared/pawly
```

Server listens on port 8080. Data (SQLite DB + photos) lives in `-data-dir`.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/healthz` | Liveness check (the app pings this to detect the server) |
| GET | `/sync/pull?since=<RFC3339>` | All rows changed since a timestamp |
| POST | `/sync/push` | Batch of changed rows from the phone; last-write-wins |
| PUT | `/photos/{id}` | Upload a photo binary (row must exist first) |
| GET | `/photos/{id}` | Download a photo binary |

## Run as a service on macOS (launchd)

```bash
# build and install the binary
go build -o /usr/local/bin/pawly ./cmd/pawly

# install the launch agent
mkdir -p /Users/Shared/pawly
cp deploy/com.rafif.pawly.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.rafif.pawly.plist
```

The server auto-starts at login and restarts if it crashes. Logs: `/Users/Shared/pawly/pawly.log`.

## Backup

Stop worrying — copy two things:

- `/Users/Shared/pawly/pawly.db`
- `/Users/Shared/pawly/photos/`

Time Machine on the Mac Mini covers both.

## Tests

```bash
go test ./...
```
```

- [ ] **Step 5: Run the full test suite one final time**

Run: `cd server && go test ./... -v`
Expected: PASS — all tests.

- [ ] **Step 6: Commit**

```bash
git add server/cmd server/deploy server/README.md
git commit -m "feat(server): main binary, launchd service config, README"
```

---

## After this plan

The backend is complete and testable standalone (`go test ./...`). The mobile app plan (`docs/superpowers/plans/2026-08-01-pawly-mobile.md`) builds the Expo app against this API contract. The phone pushes rows with the same JSON shape `{id, created_at, updated_at, deleted_at, ...}`, pulls with `since=<last pull time>`, and uploads photo binaries via PUT after pushing photo rows.
