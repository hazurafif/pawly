# Pawly — Product Specification (v2)

Status: implemented (fresh build, `.docs/PLAN.md` tracks the build plan).

## 1. Positioning

Pawly is a pet life log that optimizes for **relationship**, not record keeping.
Two jobs, two surfaces:

| Surface | Job | UX posture |
|---|---|---|
| **Journal** | Chronological truth — "when did X happen?" | Owner-driven, complete, logging happens here |
| **Memories** | Emotional destination — "feel something" | App-driven, curated, read-only |

The utility that justifies daily logging: **the vet-prep report** — a 30-day
summary (weight trend, check-ins, symptoms, meds, vaccines) the owner can take
to the vet.

## 2. Information architecture

```
Home · Journal · Health · Memories   (4 tabs; settings via header avatar)

Home       pet switcher · pet card (photo, species, sex, age, neutered, latest
           weight) · quick-log (Food/Water/Walk/Potty + More) · today's care
           checklist (gentle) · due reminders (mark done) · today's entries ·
           memory teaser strip
Journal    unified event stream · chips (All / Care / Health) · search ·
           favorite hearts · photo thumbnails · type-driven FAB
Health     weight card + bar chart + loss alert · vaccines (+ overdue badge) ·
           med schedules · vet visits · daily check-ins · meds given ·
           pet profile shortcut · Vet prep report
Memories   gotcha-day card · favorite photos grid · favorite entries
Avatar     settings: pets (add/edit/delete), sync + server URL, export JSON,
           language, about
Pushed     pet-form (add/edit) · entry-form (add/edit, type-driven) ·
           reminder-form · vet-report
```

## 3. Unified data model

Everything an owner records is an **Event**; everything else is computed.

```
pets             id, name, species('cat'|'dog'|'other'), sex, birth_date,
                 birth_date_is_estimated, rescue_date (gotcha day),
                 rescue_date_is_estimated, is_neutered, story, status, vet_clinic,
                 created_at, updated_at, deleted_at
events           id, pet_id, kind, title, text, occurred_at, next_due_at,
                 data (JSON: weight{kg}, med{dose}, vaccine, symptom{severity},
                 checkin{score,appetite,concerns}, mood{score}, task{rule_id}),
                 favorite, created_at, updated_at, deleted_at
                 kinds: feed|water|walk|potty|mood|checkin|symptom|med_given|
                 vaccine|visit|weight|photo|milestone|task|vet_bill
photos           id, event_id, taken_at, content_type, created_at, updated_at,
                 deleted_at   (binary in photo_cache locally, PUT/GET /photos/{id})
reminder_rules   id, pet_id (nullable = household), title, kind
                 (vaccine|med|groom|flea|other), due, repeat (once|daily|weekly|
                 monthly), dose, note, created_at, updated_at, deleted_at
```

Rules: RFC3339 UTC millisecond timestamps; LWW sync on `updated_at`; soft
delete (tombstones) everywhere; deleting a pet cascades to its events, photos,
and rules; `data` is an opaque JSON blob to the server (synced verbatim).

## 4. Sync

Go home server (SQLite) + expo client. Dirty-row push → photo upload →
cursor pull → photo download. Contract in `backend/README.md`.

## 5. Motion & accessibility

- 300ms fade + gentle slide for the quick-log toast; icon press scale 0.95;
  `AccessibilityInfo.isReduceMotionEnabled` → opacity-only (Toast skips
  animation entirely)
- All press targets ≥ 44px; icon buttons carry `accessibilityLabel`;
  toast is a live region (`accessibilityLiveRegion="polite"`); tabs expose
  selected state; chips expose `accessibilityState`
- Typography 16px+ for body; color never sole meaning (icons + labels);
  warm cream palette, 4.5:1 text contrast

## 6. MVP vs roadmap

**Shipped now**: onboarding pet form (photo, name, species, sex, DOB, gotcha,
neutered, story, clinic), 4-tab shell, multi-pet switcher, quick-log + undo,
care checklist, unified journal + search + filters + favorites, photos
(compressed picker → sync), weight chart + trend alert, vaccines, meds, visits,
daily check-in, reminders with mark-done, vet-prep report, JSON export, en/id
i18n, full sync with Go server.

**v1.1**: Memories full suite (On This Day, Best Photos, Growth timeline,
Monthly recap — premium), memory share cards, gentle streaks, calendar export,
dark mode.

**Roadmap**: cloud sync + family sharing, pet passport/QR, senior-pet care
track, tele-vet, insurance affiliate, AI (vet-visit pre-summary via LLM,
natural-language logging, auto memory cards).

## 7. Premium opportunities

1. Cloud sync + multi-device
2. Family sharing (2+ owners)
3. Monthly recap / memory prints (photobooks)
4. Senior-pet care kit
5. Unlimited pets (free tier caps at 2)
