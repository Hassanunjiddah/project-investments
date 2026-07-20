# RibhShare — PRD (living doc)

## What's implemented + verified end-to-end (2026-01-20)

### Full investment lifecycle — all 9 steps green
Verified by testing agent iterations 4, 5, and 6:
1. **LM creates project** (banner optional, 3 required docs) — ✅ wizard advances via on-click validation (`trigger()`) instead of the flaky `formState.isValid` gate.
2. **CEO approves** — RPC returns 200, stage flips INITIATION → ACCEPTANCE.
3. **LM invites investor** — via edge function, appears in Investors tab as INVITED.
4. **Investor accepts + commits + uploads proof** — attach-proof upload now works on web (fix in iteration_6). Status flips to PROOF_SUBMITTED.
5. **LM confirms payment** — bumps raised_minor; trigger `projects_progress_transition` auto-flips ACCEPTANCE → PROGRESS when target reached.
6. **LM posts profit update** — Total realised ₦500, Investor pool ₦350, Manager share ₦150 (70/30 split verified).
7. **LM posts Activity updates** — Announcement + FUND_USE with amount, both render with correct kind chips.
8. **Investor sees Activity + Financials tabs** — capital, projected profit, realised share, ownership %, per-update contribution.
9. **Portfolio + stat grid** — Invested / Projected / Realised aggregate correctly.

### Bug fixes shipped this session
- **`submit_project_for_review` RPC**: relaxed banner + FUND_USE requirements to align with the wizard's 3 required docs.
- **`decide_project_approval` RPC**: auto-submits legacy orphaned rows and moves INITIATION → ACCEPTANCE.
- **Wizard Continue button gate**: replaced `formState.isValid` (which was flaky with `z.coerce.number()` + Controller) with on-click `trigger()`.
- **CEO Dashboard "Capital Raised"**: computed live from `projects.raisedMinor` (was hard-coded to ₦0).
- **Notifications tab**: wired to `useFetchInvitations`.
- **`data-testid` propagation** on `Button.tsx` (RN-Web strips it otherwise).
- **`Add investor` → `Invite Investor`** copy.
- **Approvals segment `Pending (N)` count**: `useState` instead of `useRef`.
- **ProjectHero banner max-height clamp**.
- **Project code chip** in detail header (distinguishes duplicate names).
- **Duration-unit chip validation**: passes `{ shouldValidate: true }` to setValue.
- **Web payment-proof upload**: uses real File/Blob for FormData; RN branch preserved.
- **Uncontrolled → controlled** warning on Max investment input.
- **Disabled Button styling** — grey background + text so users see it isn't clickable.

### Migrations applied to Supabase (`jbwerfqgqavaxdyjxfra`)
- `20260119000000_profit_lifecycle.sql`
- `20260120000000_project_updates.sql`
- `20260120000001_approval_stage_hotfix.sql`
- `20260120000002_submit_and_approve_flow_fix.sql`

## Roles
CEO · Line Manager · Investor. Test accounts in `/app/memory/test_credentials.md`.

## Architecture
Expo SDK 54 + React 19 + expo-router web SPA (port 3000, supervisor `expo-web`). Supabase Auth + Postgres + Edge Functions. React Query + Zustand. Metro CI mode — restart via `sudo supervisorctl restart expo-web` after any code change.

## Deferred
- **Phase 1** (Resend + one-time code auth) — needs Resend API key + sender-email choice + service_role key. Also fixes the `send-invitation` 400 for brand-new emails.
- Duplicate "My Project" seed rows cleanup.
- Wizard require-cycle warning (extract `REQUIRED_SLOTS` to shared file).
- Forgot Password link on sign-in.
- Per-holding realised profit on Portfolio card (small UX polish).

## Next action items
1. Kick off Phase 1 (Resend + one-time code investor auth) — the final chunk of the original vision.
2. Optional: bulk-delete leftover "My Project" test rows.
