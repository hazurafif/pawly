package store

import (
	"database/sql"
	"fmt"
	"strings"
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
// version = array index; never reorder or insert — append only
var migrations = []string{
	// 0: initial schema
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
			return fmt.Errorf("migration %d: %w", i, err)
		}
		if _, err := tx.Exec(`INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)`, i, time.Now().UTC().Format(time.RFC3339)); err != nil {
			tx.Rollback()
			return fmt.Errorf("migration %d: %w", i, err)
		}
		if err := tx.Commit(); err != nil {
			return err
		}
	}
	return nil
}

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

	// Only columns present in the row are written; absent columns fall back
	// to schema defaults (or stay unchanged on update) instead of NULL, so
	// NOT NULL DEFAULT columns never violate. Explicit NULLs pass through.
	present := make([]string, 0, len(cols))
	vals := make([]any, 0, len(cols))
	for _, c := range cols {
		v, ok := row[c]
		if !ok {
			continue
		}
		present = append(present, c)
		vals = append(vals, v)
	}

	insertCols := strings.Join(present, ", ")
	placeholders := strings.Repeat("?,", len(present)-1) + "?"

	set := make([]string, 0, len(present)-1)
	for _, c := range present {
		if c == "id" {
			continue
		}
		set = append(set, c+" = ?")
	}
	// args bind to all placeholders in statement order: first the VALUES
	// placeholders, then the SET placeholders (same values, minus id).
	args := make([]any, 0, len(vals)*2-1)
	args = append(args, vals...)
	args = append(args, vals[1:]...)

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
