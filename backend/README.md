# Pawly Server

Home server for the Pawly family pet-care app. Single Go binary + SQLite, no dependencies.

## Synced tables (v2 schema)

| Table | Purpose |
|---|---|
| `pets` | name, species (cat/dog/other), sex, birth_date, rescue_date (gotcha), is_neutered, story, status, vet_clinic |
| `events` | the unified journal: kind (feed, water, walk, potty, mood, checkin, symptom, med_given, vaccine, visit, weight, photo, milestone, task, vet_bill), title, text, occurred_at, next_due_at, `data` (opaque JSON payload, synced verbatim), favorite |
| `photos` | metadata rows; binaries live on disk under the data dir (`data/photos/<id>`), served via `GET/PUT /photos/{id}` |
| `reminder_rules` | title, kind, due, repeat (once/daily/weekly/monthly), dose, note; completions are `task` events referencing the rule id in their `data` |

Soft deletes (tombstones) sync like any other row. The server treats the
`data` column as an opaque string — schema evolution happens on the client.

## Build & run

```bash
go build -o pawly ./cmd
./pawly
```

Server listens on port 8080. Data (SQLite DB + photos) lives in `./data` by default.

## Configuration

Settings are read from `./.env` (see `.env.example`) or environment variables; real environment variables override `.env`, and CLI flags (`-port`, `-data-dir`) override everything.

| Variable | Default | Purpose |
|---|---|---|
| `PAWLY_PORT` | `8080` | Listen port |
| `PAWLY_DATA_DIR` | `./data` | Directory for the SQLite DB and photo binaries |

```bash
# copy the example and edit
cp .env.example .env
./pawly
```

## Run with Docker

```bash
docker build -t pawly ./backend
docker run -d --name pawly -p 8080:8080 -v pawly-data:/data pawly
```

Data lives in the `pawly-data` volume (back it up alongside your photos).

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
go build -o /usr/local/bin/pawly ./cmd

# install the launch agent
mkdir -p /Users/Shared/pawly
cp deploy/com.rafif.pawly.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.rafif.pawly.plist
```

The server auto-starts at login and restarts if it crashes. Logs: `/Users/Shared/pawly/pawly.log`.

## Backup

Three options, easiest first:

1. **Time Machine** (recommended) — the Mac Mini's Time Machine snapshots the whole disk, so `pawly.db`, WAL files, and photos are all covered consistently.
2. **Copy while the server is stopped** — copy `pawly.db`, `pawly.db-wal`, `pawly.db-shm` (if present) and the `photos/` folder.
3. **Copy live** — `sqlite3 pawly.db "VACUUM INTO '/tmp/backup.db'"` for a crash-safe DB snapshot, plus the `photos/` folder.

## Sync contract for client developers

- **Timestamps** are RFC3339 UTC with millisecond precision — `2006-01-02T15:04:05.000Z`, exactly what JS `Date.toISOString()` emits. The server rejects pushes with any other format (e.g. second precision or timezone offsets).
- **Clock skew:** the server clamps stale `updated_at` values to server time on push, so a clock-behind device's rows never fall behind another device's pull cursor. Your phone's own timestamps are unchanged locally.
- **Pull's `since`** is exclusive and accepts any RFC3339 value (any precision, with or without offset). Empty means a full re-pull. Use your own last-seen `updated_at` as the next `since`.
- **On any push error response, keep your local rows and retry later — never discard them.** A 400 means the payload is malformed; a 500 means the server had a problem. Either way, nothing in the failed batch was applied.
- **Photo rows** sync like any other row via pull (metadata plus `deleted_at` tombstones); the binaries are fetched separately with `GET /photos/{id}` and uploaded with `PUT /photos/{id}`. Binaries for tombstoned photo rows are swept from disk automatically (at startup, then hourly) — the row itself stays for sync.

## Tests

```bash
go test ./...
```
