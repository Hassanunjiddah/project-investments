# RibhShare — PRD (living doc)

## Original problem statement
> "let me see the app"

Then the user described an end-to-end target flow (LM creates → CEO approves → Acceptance / invitations → Payment confirmation → Progress → profit updates → Project End with final payouts).

## Architecture
- **Runtime:** Expo SDK 54, Expo Router v6, React 19, react-native-web
- **State/Data:** Zustand + TanStack Query + react-hook-form + Zod
- **Backend:** Supabase (Auth, Postgres via PostgREST, Storage). Project: `jbwerfqgqavaxdyjxfra`
- **Web:** `expo start --web --port 3000 --host lan`, `web.output: 'single'` (SPA)
- **Supervisor:** `/etc/supervisor/conf.d/expo-web.conf` (`program:expo-web`)
- **Env:** `/app/.env` — `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Roles
CEO · Line Manager · Investor (types include ADMIN)

## What's implemented

### Session 1 (bootstrap)
- Fresh install, pinned `@supabase/supabase-js@2.108.1`, switched web output to `single`, wired supervisor + env, verified LM sign-in.

### Session 2 — Phase 3 (profit lifecycle), code-complete, awaiting DB migration
- Migration `20260119000000_profit_lifecycle.sql`: `profit_updates`, `investor_payouts`, `projects.realised_profit_minor / progress_started_at`, auto-transition ACCEPTANCE → PROGRESS, RPCs `post_profit_update`, `finalize_project_if_due`, `get_investor_profit_summary`, `get_manager_profit_summary`.
- Types: `profit.types.ts`
- Services: `profits.services.ts` (with graceful fallback for missing schema)
- Hooks: `hooks/profits/useProfits.ts`
- UI: LM **Profits** tab, Investor **Financials** tab, LM Home **Manager Earnings** card, Portfolio invested/projected/realised grid, lazy `finalize_project_if_due` on project detail load.

### Session 3 — Phase 2 (execution updates feed), code-complete, awaiting DB migration
- Migration `20260120000000_project_updates.sql`: `project_update_kind` enum (RISK / FUND_USE / ENGAGEMENT / MILESTONE / ANNOUNCEMENT), `project_updates` table, RPC `post_project_update`, RLS mirrors project_docs (LM/CEO/confirmed investors read; LM/CEO post).
- Types: `projectUpdate.types.ts`
- Services: `projectUpdates.services.ts` (graceful fallback)
- Hooks: `hooks/projectUpdates/useProjectUpdates.ts`
- UI:
  - New **Activity** tab on `ProjectDetailScreen` (LM sees post-update form + feed with kind chips; investors see feed read-only after CONFIRMED). Filter chips: All / Announcement / Milestone / Fund Use / Risk / Engagement. Fund-use updates require an amount.
  - Rebuilt **Documents** tab (`ProjectDocumentsTab`): LM can upload with kind picker (Project overview, Fund use, Risk / mitigation, Key decision), title, note, optional amount for Fund use. Existing storage bucket `project-documents` + `useUploadDocument` hook reused. Investors/CEO see read-only list with signed-URL open on tap.

### Design decisions (confirmed with user)
1. Investor sign-in: **email + one-time code → set password** (Phase 1, deferred)
2. Email provider: **Resend** (Phase 1, deferred — needs API key)
3. Invitation amount: **max cap** (current)
4. Auto-transitions: ACCEPTANCE → PROGRESS on target reached (trigger); PROGRESS → END on timeline elapsed (lazy RPC on load)
5. LM's profit share shown on Home + Manager Earnings card

## Blockers
- **Supabase service_role key not yet provided** — user will paste it later.
- Once provided, apply both migrations against `jbwerfqgqavaxdyjxfra`:
  - `supabase/migrations/20260119000000_profit_lifecycle.sql`
  - `supabase/migrations/20260120000000_project_updates.sql`
- Until migrations are applied, both Phase 3 and Phase 2 UIs render zeros/empty states (graceful fallback — nothing crashes).

## Next action items
1. Apply the two Phase 2 + Phase 3 migrations to Supabase.
2. Verify end-to-end: post activity updates + upload docs + post profit updates and confirm the investor sees them.
3. **Phase 1 — auth + email:** wire Resend, invitation email with unique first-time code, investor sign-in via code → set password.

## Backlog
- P2: Upgrade base image to Node 22 → latest `@supabase/supabase-js` + static export
- P2: Clean legacy `frontend` / `backend` FATAL supervisor programs
- P2: Silence bundle warnings (require cycle in `CreateProjectWizard`, deprecated `pointerEvents`/`shadow*` style props)
- P2: Pre-existing TS errors in `Mock*.tsx` screens (unrelated)
