# Pawly — Feature Plan

Research date: 2026-08. Compared against 11Pets, PetDesk, PetHealth+, Vet
Record, PetNoter, FLUTO, Omelo.

## Current state (strong foundation)

- Journal with 15 event kinds, search, filter chips; quick log on Home.
- Health tab: weight chart + alert, vaccines with next-due, meds, visits,
  daily check-in, reminder rules.
- Memories: favorites, milestones, gotcha day.
- Vet report (30-day, in-app only).
- Dark mode, i18n (en/id), JSON export, local-first LWW sync via Go server.

## Gaps vs competitors

Competitors all ship: OS notifications for reminders, complete pet profiles
(breed/microchip/allergies/photo), report export/share, medical document
attachments, calendar view, hygiene logs (teeth/nails/ears), home-screen
widgets. Pawly has none of those yet.

## Phases

### Phase 1 — Complete the core value ✅ done

| # | Feature | Problem | Solution | Scope | Effort |
|---|---------|---------|----------|-------|--------|
| 1 | Reminder notifications | `reminder_rules` exist but are silent — never remind anyone | `expo-notifications`: schedule triggers from due+repeat; tap → app; due-today card completes into a `task` event | App-only | M |
| 2 | Vet report export/share | 30-day report only viewable in-app — "walk into the vet with the report" is unfinished | Build markdown report, share via `expo-sharing` (native) / clipboard (web) | App-only | S–M |
| 3 | Full pet profile + avatar | Competitors require breed, microchip, allergies, profile photo | New `pets` columns + `photos.pet_id` for avatar; schema migration on both sides (app migration + backend append-only migration, allow-lists in lockstep) | App + Backend | M |

### Phase 2 — Strengthen health & memories ✅ done

| # | Feature | Notes | Effort |
|---|---------|-------|--------|
| 4 | Medical attachments | Multi-photo per event; repo already has `photosForEvent`; add attach UI to visit/vaccine/med forms | M |
| 5 | Monthly calendar view | Schedule & history summary; standard in every pet app | M |
| 6 | Hygiene log | Teeth/nails/ears/grooming; `RULE_KINDS` already has `groom` | S |
| 7 | Global search | Currently journal-only; extend to all pets + memories | S |
| 8 | Expense recap | `vet_bill` is logged but never aggregated | S |

### Phase 2.5 — Reach & polish

- First-run onboarding (log → sync → vet report) — S
- Optional lightweight auth token for the LAN server — S
- Scheduled server backups (SQLite + photos) — S

### Phase 3 — Future (some conflict with local-first)

- Home-screen widgets (iOS/Android) — heavy, needs config plugin
- AI summary for the vet (FLUTO/Omelo trend) — needs cloud; opt-in only
- Import from other apps (CSV/JSON) and pet-sitter share links

## Recommendation

Phase 1 in order: (1) notifications → (2) vet report export → (3) pet
profile. #1 and #2 are app-only (low risk); #3 touches the sync protocol
and must keep app/backend schema, columns allow-lists, and push order in
lockstep.
