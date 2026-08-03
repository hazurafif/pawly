# Pawly v2 — Fresh Build Plan

Status: **built** · Verification: typecheck clean, 49 vitest tests, 43 Go tests, web export + dev server OK.

## Context & decisions

- **Rewrite `app/` in place** (git history preserved; old screens/schema discarded)
- **Fresh schema, old DBs wiped** (`data/pawly.db` removed)
- **Go backend kept and updated** (same sync contract: RFC3339 ms UTC, LWW on `updated_at`, dirty-tracking, photo binary endpoints)
- **Species generalized**: `cats` → `pets` (cat/dog/other)
- **New IA**: Home · Journal · Health · Memories (4 tabs) + header-avatar settings
- **Dropped from fresh**: `purchases` tab and tables (spec: expenses out of v1; `vet_bill` reserved as event kind), `mother_id`/`father_id`, old time/day-of-week reminders
- i18n stays **en + id**, warm cream/primary theme stays

## 1. Fresh data model (mirrored app + server)

```
pets             id, name, species('cat'|'dog'|'other'), sex, birth_date,
                 birth_date_is_estimated, rescue_date (gotcha day), rescue_date_is_estimated,
                 is_neutered, story, status('alive'|'passed'), passed_away_date,
                 vet_clinic, created_at, updated_at, deleted_at

events           id, pet_id, kind, title, text, occurred_at, next_due_at,
                 data (JSON TEXT — weight{kg}, med{dose,freq}, vaccine{antigen}, etc.),
                 favorite INTEGER, created_at, updated_at, deleted_at
                 kinds: feed|water|walk|potty|mood|checkin|symptom|med_given|vaccine|
                 visit|weight|photo|milestone|task|vet_bill

photos           id, event_id, taken_at, content_type, created_at, updated_at, deleted_at

reminder_rules   id, pet_id (nullable = household), title, kind, due, repeat
                 ('once'|'daily'|'weekly'|'monthly'), dose, note, created_at, updated_at,
                 deleted_at
                 — completion = event kind 'task' with data {rule_id}; schedule is computed
```

`data` is an opaque TEXT column to the server (allow-listed, synced verbatim) — the Go store stays generic; only table/column names change. All LWW/sync machinery (`upsert`, `PushRows`, `PullChanges`, photo sweep) is reused as-is.

## 2. Backend changes (`backend/internal/store/store.go` + tests)

- Replace `TableNames`, `columnsByTable`, `pushOrder` with new tables/columns
- Replace migration[0] with fresh schema (delete `data/pawly.db*` so it applies cleanly)
- `photos` FK moves to `events`; `PhotoMeta`/`SetPhotoContentType`/`TombstonedPhotoIDs` unchanged
- Update `store_test.go`, `api_test.go`, `integration_test.go` to new tables
- No endpoint changes — sync contract documented in `backend/README.md` stays valid

## 3. App structure (expo-router, fresh)

```
app/_layout.tsx             providers (repo, sync, i18n) + theme + splash
app/(tabs)/_layout.tsx      4 tabs + header avatar → /settings
app/(tabs)/index.tsx        Home: pet switcher · care checklist · quick-log
                            (Food/Water/Walk/Potty + multi "+") · due reminders ·
                            today's stream · memory teaser strip
app/(tabs)/journal.tsx      unified stream · chips (All/Care/Health) · search ·
                            FAB → /entry-form · photo thumbnails · favorite hearts
app/(tabs)/health.tsx       weight card + trend alert · vaccines next-due ·
                            meds · visits · check-in history · pet profile shortcut ·
                            [Vet prep report]
app/(tabs)/memories.tsx     MVP: gotcha-day card · favorites photo grid (v1.1: On
                            This Day, Best Photos, Growth timeline, Monthly recap)
app/pet-form.tsx            onboarding + add/edit pet (progressive disclosure:
                            photo/name/species first, clinical fields optional)
app/pet/[id].tsx            pet profile: full details, edit, delete (cascade warning)
app/entry-form.tsx          type-driven entry: weight, vaccine, med, visit, feed,
                            walk, potty, symptom, check-in, photo, milestone
app/reminder-form.tsx       reminder rule CRUD (due + repeat + dose)
app/vet-report.tsx          generated 30-day summary (template) → share/print
app/settings.tsx            server URL · language · sync · backup/export (JSON) · about
src/db/                     schema.ts (MIGRATION_1 fresh) · types.ts · repository.ts
                            (allPets, eventsForPet, weightHistory, todayEvents,
                            favorites, upcomingRules…) · expoAdapter · testDb (sql.js)
src/sync/                   client · transport · useSync (new tables, photo flow)
src/lib/                    catalog (kind icons/labels) · format · theme · id
src/i18n/                   en.json + id.json (full new key set)
src/components/             ui (Card/EmptyState/Sheet/Badge) · PetSwitcher · QuickLog ·
                            ChecklistCard · WeightChart (hand-rolled Views, zero-dep)
```

New dep: `expo-image-picker` (photos; `quality` for compression). Everything else from the existing lockfile (expo-sqlite, sql.js for tests, reanimated, i18next, vitest).

## 4. Motion + accessibility (applied in the UI pass)

- 300ms fade + 8–12px slide; quick-log icon pulse + toast with **Undo (5s)**
- `AccessibilityInfo.isReduceMotionEnabled` → opacity-only transitions
- ≥44px targets, `accessibilityLabel` on icon buttons, live regions for toasts, focus-trapped/Escape-dismissible sheets, forms with visible labels + error text, contrast 4.5:1, color never sole meaning

## 5. md files to generate

| File | Contents |
|---|---|
| `README.md` (repo root) | What Pawly v2 is, run app + server, structure, verification |
| `.docs/SPEC.md` | Full product spec: IA, screen inventory + states, data model, motion, a11y, MVP/roadmap |
| `.docs/TEST_SCRIPT.md` | ~12 walkthrough scenarios (onboarding, quick-log + undo, combined event, weight → alert, vaccine → due on Home, vet report share, favorites → Memories, second pet switch, search, empty states, reduced motion, sync across two devices) |
| `backend/README.md` (update) | New schema summary; sync contract unchanged |

## 6. Build order

1. Strip old code; reset backend schema + tests; drop old DBs
2. App foundation: db layer + schema tests (sql.js)
3. Tabs shell + theme + i18n keys
4. Pet form (onboarding) → Home with quick-log, checklist, switcher
5. Journal + entry-form + search + favorites
6. Health: weight/chart/alert, vaccines, meds, visits, check-in, vet report
7. Memories (gotcha + favorites grid)
8. Settings + backup/export + sync wiring (photos)
9. Motion + a11y pass, empty states, doc files
10. Verify: `pnpm typecheck`, `pnpm test`, `go test ./...`, `pnpm web` manual run

**Risks**: full wipe of old app code (sanctioned; git history retained) · server schema rewrite means old devices can't sync with the new server (fine — dev stage) · hand-rolled chart must be tested on both web and native.
