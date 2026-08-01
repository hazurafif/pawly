# Mobile (Expo / React Native)

## Package manager

Use **pnpm** for everything. Never use npm or yarn.

- Install deps: `pnpm add <pkg>` / `pnpm add -D <pkg>`
- Run scripts: `pnpm start`, `pnpm test`, `pnpm typecheck`, `pnpm ios`, `pnpm android`
- The lockfile is `pnpm-lock.yaml` — do not regenerate it with npm.

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Verification

Before finishing work, run:

```
pnpm typecheck
pnpm test
```
