# Pawly — Family Pet Care App (Design Spec)

Date: 2026-08-01
Status: Approved

## Purpose

A pet-care app for one household (the user's family, primarily his mother) to document and care for rescued cats. Cats have been rescued from the street, raised, and many have died without being documented or noted. Pawly is a lasting family archive: cat profiles, photo moments, family tree, daily care reminders, health records, and cost tracking.

## Product Decisions (from brainstorming)

- **Users:** one household, no login/accounts. Single shared instance.
- **Mobile:** React Native via Expo. Android first; iOS later (Expo keeps both cheap). UI language: Indonesian, with i18n set up from the start so English can be added later.
- **Backend:** Go, no framework (`net/http`), SQLite. Runs as a single binary on an always-on Mac Mini on the home network.
- **Offline:** Must work fully offline. The phone's local SQLite DB is the working copy; syncs to the server when reachable. Custom lightweight sync (researched alternatives — PowerSync requires Postgres/Docker, ElectricSQL is Postgres-only, RxDB's good native driver is paid premium, WatermelonDB handles photos/attachments poorly; all target scales far beyond one household).
- **Photos:** stored on the home server disk; phone keeps compressed cached copies.
- **Dates:** birth and rescue dates may be marked "estimated"; birthdays celebrated regardless.
- **Death records:** full record — a cat can have a "passed away" date and stays in the family tree and timeline with an in-memory marker.
- **Reminders:** household-wide schedules with per-cat overrides; reminders are checked off with a history log (care timeline).
- **Costs:** everything is a purchase log with categories (food / litter / vet / medicine / toy / other); weekly/monthly summaries.

## Architecture

```
Android phone (Expo RN)            Mac Mini (home server)
┌──────────────────────────┐      ┌──────────────────────────┐
│ Local SQLite = working   │ ⇄    │ Go binary (net/http,     │
│ copy; fully offline.     │ sync │ no framework)             │
│ Photos compressed+cached │      │ SQLite = source of truth │
│ Reminders fire locally   │      │ Photos on disk           │
│ (expo-notifications)     │      │ Sync API (pull/push)     │
└──────────────────────────┘      └──────────────────────────┘
                                          │
                                    Backups: copy SQLite
                                    file + photos folder
                                    (Time Machine / USB)
```

- Sync trigger: app open, WiFi reconnection, pull-to-refresh. Background-silent.
- Sync model: server is the source of truth; a fresh/reinstalled phone re-pulls everything.

## Data Model

Every synced table has: `id` (UUID v4, generated on the phone), `created_at`, `updated_at`, `deleted_at` (soft delete), all ISO-8601 UTC.

### cats
| field | notes |
|---|---|
| name | text |
| sex | male / female / unknown |
| birth_date, birth_date_is_estimated | nullable |
| rescue_date, rescue_date_is_estimated | nullable |
| is_neutered | boolean or unknown |
| story | free text |
| status | alive / in-memory |
| passed_away_date | nullable |
| mother_id, father_id | nullable self-references → cats.id (family tree) |

### moments (unified timeline)
| field | notes |
|---|---|
| cat_id | nullable → cats.id (household-wide moments allowed) |
| kind | note / sick / vet / milestone |
| title, text | free text |
| occurred_at | when it happened |
| next_due_at | nullable; set on vet/vaccine moments; drives future vaccine reminders |

### photos
| field | notes |
|---|---|
| moment_id | nullable → moments.id |
| purchase_id | nullable → purchases.id (receipt photos; exactly one of the two set) |
| taken_at | user-supplied date |
| server path | file on server disk |

### reminders
| field | notes |
|---|---|
| title | e.g. "Kasih makan", "Bersihkan litter" |
| scope | household / per-cat |
| cat_id | nullable → cats.id |
| time | HH:MM |
| days_of_week | recurrence |

### reminder_completions
| field | notes |
|---|---|
| reminder_id | → reminders.id |
| completed_at | timestamp |
| note | optional free text |

### purchases
| field | notes |
|---|---|
| item | text |
| price | integer, IDR (no floats) |
| category | food / litter / vet / medicine / toy / other |
| date | purchase date |
| note | optional |
| cat_id | nullable → cats.id (e.g. vet bills for a specific cat) |

### Phone-only tables (never synced)
- `sync_state` (last pull timestamp)
- photo cache registry (local thumbnails)
- notification registry (local scheduled notifications)

## App Screens (Indonesian UI, 5 bottom tabs)

1. **Beranda** — today's reminders with "Beres" (done) check-off, recent moments grid, quick vaccine info. Settings gear (server address, language).
2. **Kucing** — cat list → detail: profile (sex, neutered, estimated age, rescue date, story), quick actions (family tree view, vaccines, add moment), timeline of moments with photos.
3. **Riwayat** — global photo timeline across all cats.
4. **Biaya (Costs)** — week/month summary cards, category breakdown, purchase list, add-purchase form (item, price, category, date, note, optional receipt photo).
5. **Pengingat** — manage schedules (household + per-cat), toggle days, completion history.

Family tree: rendered per-cat from mother_id/father_id (simple parent links; unknown parents left blank).

## Sync Protocol

- **Pull:** `GET /sync/pull?since=<timestamp>` → all changed rows across all tables in one response. Photo metadata included; binaries fetched lazily via `GET /photos/<id>`.
- **Push:** `POST /sync/push` → batch of changed rows from all tables; server upserts; conflicts resolve by newest `updated_at` silently (rare in a single household).
- **Photo upload:** `PUT /photos/<id>` after its owning row is pushed; stored on server disk.
- **Deletes:** soft delete (`deleted_at`) syncs both ways.
- Clock skew between devices: accepted minor risk (last-write-wins; phones use auto time).

## Backend Structure (Go)

- Single module, packages: `internal/store` (schema, migrations), `internal/api` (routes), `internal/photos` (disk storage).
- `modernc.org/sqlite` (pure Go, single static binary). WAL mode, foreign keys on.
- Migrations: numbered SQL files applied at startup.
- Config: env/flags `PORT`, `DATA_DIR`.
- Runs on the Mac Mini via a launchd plist (auto-start at boot).

## Edge Cases & Error Handling

- Server unreachable → banner "Menunggu server…"; app fully functional locally; syncs later.
- Photo upload failure → auto-retry next sync; placeholder thumbnail until downloaded.
- App reinstall → full re-pull from server (source of truth).
- Backup → copy SQLite file + photos folder.

## Verification Approach

- Backend: Go unit tests (store + sync handlers via httptest); integration test simulating two phones pulling/pushing against a real SQLite file.
- Sync client: vitest unit tests for change tracking and retry queue.
- Mobile: tests for date/IDR formatting helpers; feature verification on a real Android device against the real server on the home network.

## Out of Scope (v1)

- Medication schedules, weight tracking
- Login/auth, multi-household
- Cloud sync, real-time sync
- iOS (later, via Expo)
