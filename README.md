# Pawly

A pet life log for your whole household — cats, dogs, and everyone else. Log
the everyday (food, water, walks), the health stuff (weight, vaccines, meds,
vet visits, symptoms), and the moments (photos, milestones, gotcha day), and
walk into the vet with a 30-day report already written.

**Optimize for relationship.** Journal is the chronological truth; Memories is
the emotional destination — same data, two surfaces.

## Repo layout

```
app/       Expo (React Native) mobile app — 4 tabs, SQLite local-first,
           en/id i18n, vitest suite (sql.js in-memory DB, E2E vs real server)
backend/   Go home server — single binary, SQLite, last-write-wins sync,
           photo binaries, launchd service for macOS
.docs/     PLAN.md (build plan) · SPEC.md (product spec) · TEST_SCRIPT.md
data/      server SQLite DB + photos (gitignored)
```

## Run it

```bash
# server (optional; sync only — the app works fully offline without it)
cd backend && go build -o pawly ./cmd/pawly && ./pawly

# app
cd app && pnpm install && pnpm web        # web prototype at phone size
pnpm ios / pnpm android                   # native (Expo Go / simulator)
```

In the app, Settings → Server address → `192.168.1.50:8080` (your Mac's LAN IP).

## Verify

```bash
cd app && pnpm typecheck && pnpm test     # 8 files, 49 tests
cd backend && go test ./...               # 43 tests incl. two-device convergence
```

The E2E test needs a server binary first:

```bash
cd backend && go build -o /tmp/pawly-e2e ./cmd/pawly
```

## Sync contract (short version)

RFC3339 UTC millisecond timestamps; `updated_at` last-write-wins; soft
deletes (tombstones); dirty-row push → photo upload → cursor pull → photo
download. Full contract: `backend/README.md`.

## Data model (short version)

One unified **events** table is the source of truth (feed, walk, weight,
vaccine, visit, photo, milestone, check-in, …) with a JSON `data` payload per
kind; pets, photos, and reminder rules are the only other synced tables. See
`.docs/SPEC.md` §3.
