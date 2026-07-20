# RibhShare — PRD (living doc)

## Latest audit (2026-01-20) — findings + fixes

### Frontend fixes applied this session
- **CEO approval flow root-cause fix**: the `submit_project_for_review` RPC required a banner and a FUND_USE document that the wizard never produces — every project silently failed to submit. Patched the RPC to only require OVERVIEW/RISK/DECISION docs and no banner. Also patched `decide_project_approval` to auto-submit legacy orphaned rows so already-broken projects can be approved. Confirmed via network capture: `200 { stage: 'ACCEPTANCE' }`.
- **Banner made optional** in `CreateProjectStepBasics`, `CreateProjectWizard`, `createProject.services.ts` and `Review` step.
- **Pending count bug**: replaced `useRef` with `useState` in `ApprovalsListScreen` so the segment label re-renders.
- **`data-testid` propagation**: added explicit `testID` mapping in `Button.tsx` — RN-Web strips `data-testid` on Pressable, blocking automated tests.
- **"Add investor" → "Invite Investor"** copy fix.
- **CEO Dashboard** rewrite: `Capital Raised` now computed from `projects.raisedMinor` (was hard-coded to ₦0); added Active-projects card; removed meaningless `0%` change text.
- **Notifications tab** wired to the invitations RPC — investor now sees their pending invites there.
- **Project detail header**: added a `codeChip` (project code) beside the name so duplicate "My Project" rows are distinguishable.
- **Banner height**: enforced maxHeight on `ProjectHero.tsx` so the banner doesn't consume 40% of desktop viewport.

### Pending — user must run SQL
The audit confirmed that Phase 3 (profit lifecycle) and Phase 2 (project execution updates) migrations were **never applied** in the Supabase project. The consolidated SQL is in the chat and in these files:
- `/app/supabase/migrations/20260119000000_profit_lifecycle.sql`
- `/app/supabase/migrations/20260120000000_project_updates.sql`

Symptoms until this is applied: Activity tab shows "No updates" (404 on `project_updates`), Manager Earnings card shows ₦0 (404 on `get_manager_profit_summary`), Portfolio Realised = ₦0, `finalize_project_if_due` returns 404 on every project-detail load.

### Known remaining issues (post-audit)
- **`send-invitation` edge function** fails 400 for emails not yet in `auth.users`. Blocks the invite-a-new-investor flow (part of the "email + one-time code" auth Phase 1 that was deferred).
- **Require-cycle warning** in `CreateProjectWizard.tsx <-> CreateProjectStepDocuments.tsx` — extract `REQUIRED_SLOTS` to a shared constants file.
- **Duplicate seeding**: user has 3 "My Project" rows because the create-fail rollback couldn't delete (RLS). Consider a UNIQUE(name, created_by) constraint or a seed idempotency guard.
- **Sign-in**: no Forgot Password link (low priority).

## Architecture
Expo SDK 54 + React 19 + expo-router web SPA (port 3000, supervisor `expo-web`). Supabase `jbwerfqgqavaxdyjxfra`. React Query + Zustand. Hot reload disabled (Metro CI mode) — always `sudo supervisorctl restart expo-web` after code changes.

## Roles
CEO · Line Manager · Investor. Test accounts in `/app/memory/test_credentials.md`.

## Migrations pending in `/app/supabase/migrations`
- `20260119000000_profit_lifecycle.sql`
- `20260120000000_project_updates.sql`
- `20260120000001_approval_stage_hotfix.sql` ✅ applied
- `20260120000002_submit_and_approve_flow_fix.sql` ✅ applied

## Next action items (priority order)
1. Run the consolidated Phase 3 + Phase 2 SQL (paste in chat) in Supabase → SQL Editor.
2. Re-run the testing agent — expect Activity feed, Manager Earnings, Investor Realised profit to all light up.
3. Kick off **Phase 1** — Resend + one-time code auth. Fixes `send-invitation` for new emails and enables the full invite → set-password investor flow.

## Backlog
- Extract `REQUIRED_SLOTS` to break require-cycle warning
- Add UNIQUE(name, created_by) or wizard idempotency guard
- Rename "Add investor" (done) plus consider a modal instead of inline form
- Cap desktop banner further if needed
- Forgot Password link
