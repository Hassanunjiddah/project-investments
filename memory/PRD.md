# RibhShare — PRD (living doc)

## What's implemented + verified end-to-end (2026-07-22)

### Line-Manager Earnings tab — shipped
- New "Earnings" tab in the bottom nav (LM only; hidden via `href: null` for CEO / Investor).
- Screen at `/(tabs)/earnings/index.tsx` → `src/screens/earnings/EarningsScreen.tsx`.
- Hero card with green gradient showing total manager share across all projects + earning-project count.
- Stat grid: total realised (all projects) + average per earning project.
- Per-project breakdown (reuses `ManagerProfitBreakdown`) — each project + LM's cut.
- Cross-project recent-profit-updates timeline (new `fetchAllProfitUpdates` service + `useAllProfitUpdates` hook) — each row shows project name, raw realised, LM's cut, note, date. Tapping a row navigates to the project detail.
- 15-second polling on the new hook (matches existing profit queries).
- Verified visually on preview URL: hero ₦15,150 / 1 project, timeline shows both profit posts with correct 30% cuts (₦15K + ₦150).

### Profit sharing, realisation & interface communication — shipped
- **Create-project wizard**: replaced the raw `profitSplitInvestorBps` bps input (hidden behind advanced toggle) with a first-class **"Manager profit share (%)"** input. Default 30%, bounded 0–50 (Zod), converted to bps at submit. Helper text explains why 50 is the cap ("investors must always keep the majority share").
- **LM home**: added a **"Profit Sources"** section below Manager Earnings that lists every project the LM owns with realised_profit > 0, sorted by their cut descending. Each row shows total realised, split %, and the manager's cut in green. Empty state when none.
- **Investor project → Financials tab**: added **Project target** row and a new **Your profit share** cell (ownership × investor split) so investors see their effective claim on the project's realised profit.
- **Polling (real-time-lite)**: `refetchInterval: 15000` added on all profit queries (`useProfitUpdates`, `useProjectProfitMeta`, `useInvestorProfitSummary`, `useManagerProfitSummary`, `useInvestorPayoutForInvite`), on `useFetchProjects`, and on `useFetchStats`. When any actor posts a profit update, all peer dashboards refetch on the next tick (≤15s) with no page reload needed. Verified by iter_11 network trace: `/rest/v1/projects` and `/rest/v1/rpc/get_manager_profit_summary` fire every ~15.1s while idle on LM home.
- **Backend already in place**: `projects.profit_split_investor_bps` (default 7000) + `post_profit_update` + `get_manager_profit_summary` / `get_investor_profit_summary` all respect per-project split — no schema changes needed.
- **Projects list now includes `realised_profit_minor`** in the SELECT (was previously only on `fetchProject` byId) so client-side per-project computations work.

Testing iteration 11 verified all 5 flows PASS (wizard input, LM profit sources, polling network trace, investor financials, theme-toggle regression).

## What's implemented + verified end-to-end (2026-07-21)

### UI/UX refresh — shipped
- Design blueprint written to `/app/design_guidelines.json` and implemented across the design tokens + top interactive components.
- Design tokens refreshed:
  - `colors.ts` — Tailwind-grade `#166534` primary, deep tinted-black `#080C0A` dark bg, `success/warning/info/error` semantics with matching `xxxLight` tints.
  - `typography.ts` — 32px hero (`xxl`), tighter letter-spacing, dedicated line-height + letterSpacing scales.
  - `spacing.ts` — added `radii` (sm/md/lg/xl/full) and `elevation` (sm/md/lg) tokens.
- Components refreshed: `Button` (rounded-xl + springy press), `TextInput` (48px, focus ring, uppercase labels), `Badge` (soft pill + dot), `Card` (subtle shadow + hover-lift), `Spinner` (rotating ring in primary), `Toast` (icon tile + slide-in), `StatCard` (icon tile + optional hero variant), `AppHeader` (leaf logo, frosted glass on web).
- **Theme toggle moved to Profile → Appearance ONLY**. Removed from AppHeader and ScreenLayout — resolves the collision with New Project action + declutters the header.
- Verified via screenshot on both light + dark mode: sign-in, LM home, profile, error toast — all look premium.

### Theme toggle (light / dark) — shipped
- Floating sun/moon `ThemeToggle` in `ScreenLayout` (top-right of every screen; auto-hidden on Profile).
- Profile → Appearance card with segmented Light / Dark buttons (testids `theme-option-light`, `theme-option-dark`).
- Choice persisted to `localStorage['ribhshare.theme']` — survives reloads.
- First-visit default falls back to `prefers-color-scheme` media query, then to `light`.
- All existing screens already read `useUiStore((s) => s.theme)` and pull from `colors[scheme]`, so recolor is automatic across the app.

### Phase 1 — Investor first-signin via 8-char code — 100% E2E green
Verified by testing agent iteration 10:
1. LM invites investor → `send-invitation` edge fn creates invite row + generates 8-char code via `generate_invite_signin_code` RPC (needs `pgcrypto` in `extensions`).
2. Email delivery via Resend (falls back to returning `signinCode` in response if `RESEND_API_KEY` unset — LM sees code inline in UI so they can share manually).
3. Investor visits `/first-signin` → enters email + code → `redeem-invite-code` edge fn validates + returns magiclink `tokenHash`.
4. Client calls `supabase.auth.verifyOtp({token_hash, type:'magiclink'})` — **must NOT pass `email`** (Supabase 400s otherwise).
5. Navigates to `/set-password` where investor sets password → `mark_password_set` RPC flips `profiles.password_set_at`.
6. Investor can now sign in normally at `/sign-in` with email + password.
7. Code is single-use — subsequent redemption attempts return "This code has already been used."
8. Rate-limited (8/email + 30/IP per 10min rolling window) with 300ms delay on failures for timing-attack resistance.

### Critical fixes this session
- **AuthGuard race** in `app/_layout.tsx`: introduced `mustSetPassword` flag in `useAuthStore`. FirstSigninScreen sets it TRUE before `verifyMagicToken`; AuthGuard short-circuits while true; SetPasswordScreen clears it on save. Without this, guard beat FirstSigninScreen's `router.replace('/set-password?...')` and dumped investor on `/home`.
- **`verifyOtp` API misuse**: `inviteAuth.services.ts::verifyMagicToken` no longer passes `email` alongside `token_hash`.
- **`gen_random_bytes()` missing**: added `create extension if not exists pgcrypto with schema extensions` and set RPC search_path to include `extensions`.
- **`TextInput` dropping `data-testid`**: fixed to forward `data-testid` → `testID` explicitly (RN-Web only auto-maps in one direction).
- **`FormSubmitButton` not forwarding `data-testid`**: added prop-passthrough.
- **SignInScreen data-testids**: added `signin-email-input`, `signin-password-input`, `signin-submit-btn`.

### Edge functions deployed (fully inlined, no `_shared/` imports)
- `send-invitation` (Verify JWT: ON) — LM/ADMIN only; creates invite, generates code, sends email via Resend or returns code inline as fallback.
- `redeem-invite-code` (Verify JWT: OFF) — public endpoint; validates code, atomically marks redeemed, returns magiclink tokenHash. Includes in-memory rate-limiting.

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

### Bug fixes shipped in prior sessions
- **`submit_project_for_review` RPC**: relaxed banner + FUND_USE requirements to align with the wizard's 3 required docs.
- **`decide_project_approval` RPC**: auto-submits legacy orphaned rows and moves INITIATION → ACCEPTANCE.
- **Wizard Continue button gate**: replaced `formState.isValid` with on-click `trigger()`.
- **CEO Dashboard "Capital Raised"**: computed live from `projects.raisedMinor`.
- **Notifications tab**: wired to `useFetchInvitations`.
- **`data-testid` propagation** on `Button.tsx`.
- **`Add investor` → `Invite Investor`** copy.
- **Approvals segment `Pending (N)` count**: `useState` instead of `useRef`.
- **ProjectHero banner max-height clamp**.
- **Project code chip** in detail header.
- **Duration-unit chip validation**: passes `{ shouldValidate: true }` to setValue.
- **Web payment-proof upload**: uses real File/Blob for FormData.
- **Uncontrolled → controlled** warning on Max investment input.
- **Disabled Button styling** — grey background + text.

### Migrations applied to Supabase (`jbwerfqgqavaxdyjxfra`)
- `20260119000000_profit_lifecycle.sql`
- `20260120000000_project_updates.sql`
- `20260120000001_approval_stage_hotfix.sql`
- `20260120000002_submit_and_approve_flow_fix.sql`
- `20260121000000_investor_first_signin.sql` (+ manual patch to enable `pgcrypto` + update `generate_invite_signin_code` search_path)

## Roles
CEO · Line Manager · Investor. Test accounts in `/app/memory/test_credentials.md`.

## Architecture
Expo SDK 54 + React 19 + expo-router web SPA (port 3000, supervisor `expo-web`). Supabase Auth + Postgres + Edge Functions. React Query + Zustand. Metro CI mode — **`sudo supervisorctl restart expo-web` after zustand-store-shape changes** (Metro cache can serve stale bundle).

## Deferred / P1 backlog
- **Set `RESEND_API_KEY` + `SENDER_EMAIL` + `APP_URL` secrets** in Supabase → Edge Functions → Secrets so invite emails auto-deliver (currently falling back to inline code).
- **Verify sender domain in Resend** (else email delivery only works to Resend-verified addresses).
- **SetPasswordScreen redirect**: currently sends investor to `/(tabs)/projects/{projectId}` which resolves to `/home` for investors. Should redirect to `/(tabs)/portfolio/projects/{projectId}` or invitation review screen.
- **`useAuthStore.setSession`** hard-codes `user.role = 'INVESTOR'` — foot-gun for LM/CEO first login until profile fetch resolves. Should use `null` and populate from `fetchProfile`.
- **`mustSetPassword` watchdog**: add a timeout so a stale flag can't lock the guard indefinitely if `verifyOtp` fails silently.
- Duplicate "My Project" seed rows cleanup.
- Wizard require-cycle warning (extract `REQUIRED_SLOTS` to shared file).
- Forgot Password link on sign-in.
- Per-holding realised profit on Portfolio card.
- Expose Explore / Messages / Tasks tabs (currently `href: null`).

## Next action items
1. User to add Resend secrets in Supabase Dashboard so investors receive the code by email automatically.
2. Fix SetPasswordScreen redirect target for investor role.
3. Optional: bulk-delete leftover "My Project" test rows.
