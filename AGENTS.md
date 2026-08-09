# Pawly — Agent Guide

Monorepo: Go backend (`backend/`) + Expo/React Native mobile & web app (`app/`).
See `app/AGENTS.md` for mobile-specific rules (pnpm, Expo SDK 57 docs, verification).

## Auto-commit & push policy

Commit and push **after every completed unit of work** — do not wait for the
user to ask, and do not batch unrelated work into one commit.

1. **Verify before committing.** Run the checks for everything you touched:
   - Backend: `cd backend && go test ./... && go vet ./...`
   - App: `cd app && pnpm typecheck && pnpm test`
   If a check fails, fix it before committing.
2. **Stage only what belongs to the change.** Use `git add <files>` explicitly.
   Never `git add -A` / `git add .` unless the change is repo-wide and you have
   confirmed nothing unrelated is dirty.
3. **Commit with a conventional message**, scoped per side of the monorepo:
   - `feat(app): ...` / `fix(backend): ...` / `test(app): ...` / `docs: ...` / `chore: ...`
   - Root-level changes (docker-compose, README, AGENTS.md) use no scope.
   - Imperative mood, lowercase subject, no trailing period. Reference the
     issue/context in the body only when it adds value.
   - Example: `fix(app): push parent rows with dirty children so FK checks pass`
4. **Push immediately after the commit:** `git push origin main`.
5. If the push is rejected (remote moved), `git pull --rebase` then push again —
   resolve conflicts by keeping both sides' intent, and rerun verification.
6. If a commit is found wrong after pushing, fix forward with a new commit —
   never rewrite pushed history.

## Repo layout

- `backend/` — Go server (cmd/main.go, internal/api, internal/store, internal/photos).
  SQLite via modernc (no CGO), data dir via `PAWLY_DATA_DIR` (default `./data`).
  Run locally: `go run ./cmd`; containers via `podman compose up -d` (docker-compose.yml).
- `app/` — Expo SDK 57 + expo-router app. `pnpm` only. See `app/AGENTS.md`.
- `scripts/` — helper tooling (screenshots, test scripts).

## Conventions

- **Sync protocol** lives in `backend/internal/store` (Go) and `app/src/sync`
  (TS). They mirror each other — schema columns, push order
  (pets → events → photos → reminder_rules), and FK relationships must stay
  in lockstep. Changing one side without the other breaks sync.
- **i18n:** `app/src/i18n/{en,id}.json` must have identical key trees
  (enforced by tests). Default language is English.
- **Migration discipline (backend):** append-only migrations; never reorder or
  edit existing entries.
- **No secrets in code or commits.** `.env*` files are local-only.

## Definition of done

- Verification commands pass.
- Changes committed with a scoped conventional message.
- Pushed to `origin/main`.
