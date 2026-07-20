# RibhShare — PRD (living doc)

## Original problem statement
> "let me see the app"

Then, on the second turn, the user described a target end-to-end flow (LM creates → CEO approves → Acceptance / invitations → Payment confirmation → Progress → profit updates → Project End with final payouts) and requested modifications.

## Architecture
- **Runtime:** Expo SDK 54, Expo Router v6, React 19, react-native-web
- **State/Data:** Zustand + TanStack Query + react-hook-form + Zod
- **Backend:** Supabase (Auth, Postgres via PostgREST, Storage). Project: `jbwerfqgqavaxdyjxfra`
- **Web:** `expo start --web --port 3000 --host lan`, `web.output: 'single'` (SPA)
- **Supervisor:** `/etc/supervisor/conf.d/expo-web.conf` (`program:expo-web`)
- **Env:** `/app/.env` — `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Roles
CEO · Line Manager · Investor (types include ADMIN)

## What's implemented (Jan 19–20, 2026)

### Session 1 (bootstrap)
- Fresh install (`yarn install --ignore-engines`)
- Pinned `@supabase/supabase-js@2.108.1` (Node 20 compat)
- Switched web output `static` → `single` (SSR crash fix)
- Wired Supabase creds; supervisor `expo-web` on port 3000
- Verified LM sign-in → dashboard renders live Supabase data

### Session 2 (Phase 3 — profit lifecycle) — CODE-COMPLETE, awaiting DB migration
Frontend + DB blueprint for the full profit lifecycle:

- **Migration** `/app/supabase/migrations/20260119000000_profit_lifecycle.sql`:
  - `projects.realised_profit_minor`, `projects.progress_started_at` columns
  - `profit_updates` table (LM appends deltas)
  - `investor_payouts` table (final END-stage snapshot)
  - Trigger auto-transitions `ACCEPTANCE → PROGRESS` when `raised_minor >= target_minor`
  - RPC `post_profit_update(project_id, amount_minor, note)`
  - RPC `finalize_project_if_due(project_id)` — moves to END and creates payouts once duration elapses
  - RPCs `get_investor_profit_summary` + `get_manager_profit_summary` for dashboards
  - RLS policies on new tables (project owner, CEO/admin, confirmed investors)
- **Types:** `/app/src/types/profit.types.ts`
- **Services:** `/app/src/services/profits.services.ts` (graceful fallback if migration not yet applied — never crashes UI)
- **Hooks:** `/app/src/hooks/profits/useProfits.ts`
- **UI:**
  - Line Manager `ProjectDetailScreen` — new **Profits** tab (post-profit-update form + updates feed + investor/manager pool breakdown)
  - Investor `ProjectDetailScreen` — new **Financials** tab (their capital, projected profit, realised share, per-update contribution, final payout when project ends)
  - `ManagerHomeScreen` — new **Manager Earnings** card (share, realised, project count)
  - `PortfolioScreen` — invested/projected/realised stat grid + realised return per holding
  - `finalizeProjectIfDue` is called on every project detail load (idempotent) so END transition happens lazily without a cron job
  - `portfolio.services.ts` — realised profit rolled up per project via the new RPC

Formulas:
- Investor share of a profit update = `update.amount × investor_bps/10000 × invite.amount / project.raised`
- Manager share of a profit update = `update.amount × (1 − investor_bps/10000)`

### Design decisions confirmed with user (Session 2)
1. Investor sign-in flow will eventually be **email + one-time code → set password** (Phase 1, deferred)
2. Email provider: **Resend** (Phase 1, deferred — needs API key)
3. Invitation amount: **max cap** (current behavior — no change)
4. Auto-transitions: **Acceptance → PROGRESS** when raised == target (auto), **PROGRESS → END** when timeline elapses (auto)
5. LM's profit share is shown in the app (Home + Manager Earnings section)

## Blockers
- **Supabase service_role key not yet provided.** User will paste it later.
- Once provided, run migration `20260119000000_profit_lifecycle.sql` against `jbwerfqgqavaxdyjxfra` OR paste it manually into Supabase → SQL Editor.
- Until migration is applied, the new Phase 3 UI shows zeros/empty states (graceful fallback — nothing is broken).

## Next action items (priority order)
1. Apply Phase 3 migration to Supabase (needs service_role key or manual paste)
2. Verify Phase 3 end-to-end with a test project reaching PROGRESS
3. **Phase 2 — project execution feed:** updates for risks, fund usage, engagement, documents module for LM, real-time updates for investors
4. **Phase 1 — auth + email:** wire Resend, invitation email with unique first-time code, investor sign-in via code → set password, per-investor invitation amount tweak (if user changes mind)

## Backlog
- P2: Upgrade base image to Node 22 → move back to latest `@supabase/supabase-js` + static export
- P2: Remove/clean legacy `frontend` / `backend` FATAL supervisor programs (harmless)
- P2: Silence bundle warnings (require cycle in `CreateProjectWizard`, deprecated `pointerEvents`/`shadow*`)
- P2: Pre-existing TS errors in mock screens (`Mock*.tsx`) unrelated to Phase 3
