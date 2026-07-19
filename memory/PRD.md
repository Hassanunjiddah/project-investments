# RibhShare — PRD (living doc)

## Original problem statement
> "let me see the app"

User wanted to preview an existing Expo (React Native + Web) app named **RibhShare** — a Shariah-compliant project investment platform backed by Supabase.

## Architecture
- **Runtime:** Expo SDK 54, Expo Router v6, React 19, React Native 0.81, react-native-web
- **State/Data:** Zustand stores, TanStack Query, react-hook-form + Zod
- **Backend:** Supabase (Auth, Postgres via PostgREST, Storage). Project: `jbwerfqgqavaxdyjxfra`
- **Web serving:** `expo start --web --port 3000 --host lan`, output mode `single` (SPA — SSR disabled because Node 20 lacks native WebSocket that supabase-js ≥2.110 requires)
- **Supervisor program:** `/etc/supervisor/conf.d/expo-web.conf` (`program:expo-web`)
- **Env file:** `/app/.env` — `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Roles
CEO · Line Manager · Investor (see `/app/docs/*-role.md` and `/app/src/constants/roles.ts`)

## What's implemented (Jan 19, 2026)
- Fresh install of node_modules via `yarn install --ignore-engines`
- Pinned `@supabase/supabase-js@2.108.1` (v2.110+ needs Node 22)
- Switched `app.config.ts` web output from `static` → `single` to avoid SSR crash
- Wired Supabase env vars into `/app/.env`
- Added supervisor program `expo-web` and stopped the (unused) `frontend` / `backend` legacy programs
- Verified end-to-end: sign-in as Line Manager → `/home` dashboard renders with real Supabase data (4 projects, ₦5K raised, 3 investors, "Mine" project banner from Supabase Storage)

## Next action items
- User will preview app end-to-end. No feature work requested yet.
- If user wants Line Manager role screens (Projects, Approvals, Tasks) tested next → drive via existing tabs.

## Backlog / open items
- P2: Upgrade base image to Node 22 so we can move back to latest `@supabase/supabase-js` and re-enable static web output.
- P2: Reconcile supervisor conf — the read-only `supervisord.conf` still references `/app/backend` and `/app/frontend`. Currently those programs are in FATAL but harmless.
- P2: Web bundle warnings — require cycle in `CreateProjectWizard`, deprecated `pointerEvents`/`shadow*` styles.
