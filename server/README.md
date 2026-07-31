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
