# Pawly — Test Script

Walkthrough for the v2 fresh build. Run the app (`pnpm web` in `app/`) at phone
size; start the Go server first if you want sync (`go build -o pawly ./cmd/pawly
&& ./pawly` in `backend/`).

## 1. First run (onboarding)

1. Open the app → welcome hero with "Add your first pet".
2. Tap **Add a pet** → form. Add a photo, name "Miko", species Cat, sex Male,
   birth date, gotcha day. Save.
3. Land on Home → Miko's card shows name, species · sex, age badge, gotcha data.

## 2. Quick log + undo

1. Tap the **Water** circle → toast "Logged <time> · Water" with Undo.
2. Tap **Undo** → toast disappears and the entry vanishes from Today.
3. Log **Feed** twice and **Potty** once → checklist ticks to "3 of 5 done".

## 3. Combined-style entries

1. Tap **More** → type grid. Choose **Walk**, add a note, save → appears in Today.
2. Journal tab → entries grouped under "Today", newest first.

## 4. Journal features

1. Search "walk" → only walk entries.
2. Chips: **Care / Health** filter the stream.
3. Heart an entry → it appears under Memories → Favorites.
4. Tap an entry → edit modal; change the note, save; delete it → gone.

## 5. Health

1. Journal → More → **Weight**, enter 4.2 → Health shows latest + chart bar.
2. Log a second weight later (or via Health → Add weight).
3. **Vaccine**: entry-form → Vaccine, antigen "Rabies", dose "1 ml".
4. **Reminder**: Home → due card → Add → vaccine "Rabies booster", due date,
   repeat yearly → appears on Home when due (or overdue badge on Health).
5. **Med**: reminder-form kind Medication, due today, repeat daily → Health →
   Medications shows it with dose.
6. **Visit** + **Check-in**: log both; check-in with mood/appetite/concerns.

## 6. Vet prep report

1. Health → Vet prep report → 30-day summary renders weight, check-ins,
   symptoms, meds, vaccines.
2. Empty state shows "Log a few entries first" when nothing in range.

## 7. Memories

1. Memories tab → gotcha-day card with "came home on…" + age.
2. Heart a photo entry in Journal → shows in the favorites grid.
3. Photo entries: from entry-form kind Photo (or the photo field).

## 8. Second pet

1. Home pet switcher shows only Miko. Add pet via Home empty state is not
   shown (pets exist) → use Settings → Pets → Add, or header add.
2. Create "Bella" (Dog) → switcher now has two avatars; switching scopes
   Journal/Health/Memories per pet. Active pet persists across restarts.

## 9. Photos & sync (two devices)

1. Add a photo entry → uploads to the server on sync (status in Settings).
2. On another device (or fresh browser profile) → sync → photo appears.
3. Kill the server → sync shows "Server unreachable"; local logging still works;
   entries push when the server returns.

## 10. Export & settings

1. Settings → Export data (JSON) → downloads a full dump (web) or writes a file
   with the path (native).
2. Switch language to Bahasa Indonesia → every screen re-labels; back to English.
3. Delete a pet → confirm dialog explains cascade → pet and all its data vanish
   from every device after sync.

## 11. Accessibility & motion

1. Enable Reduce Motion (OS) → toast appears instantly, no slide.
2. Tab through with a keyboard (web) → focus rings on all buttons; icon-only
   buttons announce their label to screen readers.
3. Quick-log targets are ≥44px — verify no fat-finger overlap.

## 12. Edge cases

- Empty journal/search with no results → helpful empty states.
- Weight with 0 or negative → inline validation error.
- Reminder without title or date → validation error.
- Pet name empty → "Name is required".
