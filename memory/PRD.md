# Prism Capital — PRD (living doc)

## What's implemented + verified end-to-end (2026-07-27 · Phase D — LM/CEO desktop surfaces + live-signal polish)

### Live-signal pulse dot on Activity pill
- **`useLiveActivity` upgraded** to track Supabase realtime subscription status. Both `distribution_notices` and `invites` channels report their SUBSCRIBED state; a `live: boolean` derived flag surfaces from the hook.
- **`ActionPillGroup` extended** with an optional `dot: { color, pulse }` per pill — renders a 10px indicator on the bottom-right of the tile, animated via a shared CSS keyframe `pill-live-pulse` (defined once in `+html.tsx`) so multiple pills can pulse cheaply.
- **`InvestorHomeScreen` wiring**: mint-green pulse when both realtime channels are subscribed; muted grey (no pulse) when the socket disconnects. Confirmed live in DOM (`animationName: 'pill-live-pulse'`, `backgroundColor: rgb(15, 91, 45)`).

### LM Earnings screen (rewrite)
- Retired the hardcoded green hero (`#166534 → #14532D`) that had been ignoring the palette.
- New layout: editorial-serif "Earnings" title + subtitle, `Card` with `HeroBalance` "YOUR TOTAL EARNINGS", a two-column `SparklineTile` grid ("REALISED PROFIT · LAST 8" success-toned + "AVG PER EARNING PROJECT" brand-toned), per-project breakdown, and refreshed profit-update tiles as `Card` elements.
- Sparklines computed from the last 8 profit updates (line trend) and the top 8 project realisation values.
- `heroDelta` uses the most-recent update's manager cut as a delta signal.

### CEO Dashboard refresh
- Replaced the 4-cell `StatGrid` with a **`HeroBalance` "CAPITAL RAISED · ALL PROJECTS"** + a two-tile `SparklineTile` grid ("ACTIVE PROJECTS" brand · "PENDING APPROVALS" warning tone).
- Copy updated `RibhShare` → `SITE_NAME` (`Prism Capital`) — surfaced in the greeting subtitle.
- Preserved: Trial Balance CSV export card, Pending Approvals list, Recently Active Projects list.

### Left-rail navigation (deferred to Phase D+)
- Prototyped a `ResponsiveTabBar` for a Ramp/Linear-style left rail on ≥ 960px viewports. Removed from this pass because Expo Tabs' bottom-rail structural constraints make a left-rail impl non-trivial without a broader shell refactor. Deferred to a dedicated pass alongside Create Project wizard + Project Detail split-panel.

### Visual QA snapshot
- ✅ LM Earnings (desktop): editorial title, hero card, sparkline pair with correct tones, empty per-project + profit-update sections.
- ✅ CEO Dashboard (desktop): Prism Capital header + tetrahedron, hero card with "CAPITAL RAISED · ALL PROJECTS", sparkline pair, Trial Balance export, Pending Approvals list (hassanu · agric · ₦50M · INITIATION chip).
- ✅ Investor Home (mobile): 4-pill ActionPillGroup with **green live-signal dot pulsing** on the Activity tile (DOM verified).
- ✅ No TS errors, no runtime errors.

### Roadmap after Phase D
- **Phase D+ (deferred)**: Full desktop shell refactor — left-rail nav, Project Detail right-side context panel, Create Project wizard.
- **Phase E — CEO desktop surfaces**: Approvals inbox layout, Users management grid.
- **Testing sweep**: run `testing_agent_v3_fork` across Phases A/B/C/C+/D for regressions.

## What's implemented + verified end-to-end (2026-07-27 · Phase C+ — Live activity drawer)

### Real-time activity feed
- **`useLiveActivity` hook** (`/app/src/hooks/activity/useLiveActivity.ts`): normalises multiple Supabase source tables into a single `ActivityEvent[]` stream. Seeds from the last 15 distribution notices + 10 invites (silent-fail on errors — activity feed is best-effort, never blocks UI). Subscribes to two Supabase realtime channels filtered by `investor_id`:
  - `INSERT distribution_notices` → "New distribution posted · REF"
  - `UPDATE invites` (status-change) → "Invitation ready to pledge / Payment recorded / Investment confirmed / Invitation closed"
  Rolling 30-event window with de-dup by id, unread counter, `markAllRead()` on drawer open.

- **`ActivityDrawer` component** (`/app/src/components/investor/ActivityDrawer.tsx`): bottom sheet Modal with:
  - Slide-in animation (260ms cubic ease-out) + fade backdrop (200ms) — respects reduce-motion via Modal.
  - Navy-tinted backdrop (`rgba(6, 79, 146, 0.35)`) — dismissable via tap.
  - Editorial-serif "Activity" title, subtitle, circular close btn.
  - Grouped by "Today" / "Earlier" (start-of-day boundary).
  - Each row: colored icon tile (semantic tone — success for distributions, info for invites, warning for pending payments, danger for closed) + title + subtitle + chevron.
  - Empty state: "Nothing new yet".
  - Row taps close the drawer and route to the linked screen after the exit anim.

- **`InvestorHomeScreen` wiring**: The `Activity` pill in `ActionPillGroup` now opens the drawer (instead of routing to /notifications). Unread count badges into the label ("Activity · 3"). The radio-tower icon reinforces the "live signal" metaphor. `activityOpen` state, `useLiveActivity()` for events + unread + markAllRead.

### Visual QA snapshot
- ✅ Investor Home shows the 4-pill ActionPillGroup with the new `radio` icon on the Activity pill.
- ✅ Tapping "Activity" fires up the bottom sheet: navy backdrop dims the home, drawer slides up, editorial "Activity" title + subtitle + close btn render cleanly, EmptyState "Nothing new yet" copy is present.
- ✅ Modal DOM inspection confirms `aria-modal="true"` region exists — screen-reader friendly.
- ✅ No TS errors, no runtime errors.

### Testing status
- Realtime subscriptions established but not observed to fire in the test env (no live distributions/invite updates during smoke test). Structure is validated; behavior needs a real event to fire (either manual DB insert or LM/CEO seeding a distribution).

## What's implemented + verified end-to-end (2026-07-27 · Phase C — Investor mobile surfaces)

### Investor surface refresh
- **PortfolioCard** (rewrite): Retired the RibhShare hardcoded `#1B6B3A` green. Now uses palette navy gradient (web-only radial highlight + linear diagonal), editorial-serif value with CountUp on mount, navy-tinted shadow. Backwards-compatible with all call-sites (home + portfolio variants).
- **InvestorHomeScreen**: Removed the tired StatGrid ("Active / Withdraw / ROI"). Replaced with **ActionPillGroup** — 4 pills (Portfolio raised primary · Invites · Statements · Activity) that route to the correct tabs. PortfolioCard sits between the greeting and the actions.
- **InvestorPortfolioScreen**: Swapped SegmentedControl for **ChipRow** — chips now show count badges (Active `4`, Completed `2`, Invitations `1`) and use the new navy fill on active + light-lavender idle. Screen title upgraded to Instrument Serif 32pt.
- **StatementsScreen** (rewrite): Full institutional layout with:
  - Editorial-serif "Statements" title (32pt Instrument Serif)
  - Aggregated hero: **HeroBalance** "TOTAL RECEIVED" with subtitle "N notices across your projects" (only shown when notices > 0)
  - Each notice as a **DistributionNoticeCard** (navy accent bar, mono ref, period chip, PDF affordance)
  - Below each notice: the waterfall detail card (Card `tone="default"` + palette-monospace) unchanged in behavior, refreshed in style
  - Final-distribution capital-returned card upgraded to `Card tone="brand"` (was custom `capitalNote`)

### Visual QA snapshot (mobile 390×844)
- ✅ Investor Home: Prism header + tetrahedron, greeting, deep-navy PortfolioCard with editorial-serif "₦ 0" hero, ActionPillGroup with raised "Portfolio" primary + 3 soft actions, Pending Actions and Recent Updates sections.
- ✅ Portfolio: title in Instrument Serif, navy PortfolioCard with eye-toggle affordance, ChipRow with count badges (Active 0 / Completed 0 / Invitations 0), empty state.
- ✅ Statements: title, subtitle, centered EmptyState (no notices in test env), Statements tab active in bottom nav.
- ✅ All hot-reloaded correctly after expo restart; no runtime errors.

### Design blueprint referenced
- `/app/design_guidelines.json` — Phase C mapped to sections "Investor Home", "Portfolio", "Statements" of the blueprint.

### Roadmap (post-Phase C)
- **Phase D — LM desktop surfaces**: Left-rail nav (Ramp/Linear-inspired), Earnings screen with SparklineTile grid, Project Detail with right-side context panel, Create Project wizard.
- **Phase E — CEO desktop surfaces**: Approvals inbox, KPI dashboard tiles, Users management.

## What's implemented + verified end-to-end (2026-07-27 · Phase B — Shared components refresh)

### New primitives shipped
- **Button** — Phase B refresh: added `soft` (tinted brand-blue fill w/ navy text), `ghost` (chrome-less), and `pill` shape (999 radius). Left/right icon slots, hover-lift on primary, springy press-scale. Backwards compatible with all existing call-sites.
- **Card** — Phase B refresh: navy-tinted shadows (`shadowColor #0A1F3D` instead of raw `#000`), `tone` prop for `default | brand | success | warning | danger` tonal accents, `flush` prop for edge-to-edge content. Hover-lift + soft shadow expand on web.
- **HeroBalance** (new) — Editorial serif marquee number with tabular-nums, currency prefix, CountUp animation (respects reduce-motion), optional delta chip and subtitle. Sizes: md/lg/xl.
- **ChipRow** (new) — Segmented filter pills with count badges. Web renders as `<div role="radiogroup">` with `<button role="radio">` for keyboard nav; native falls back to Pressable. Scrolls horizontally on overflow, or stretches evenly.
- **ActionPillGroup** (new) — Circular icon+label group (Cash App / Robinhood pattern). Optional `primary: true` action renders slightly larger with brand-navy shadow lift.
- **SparklineTile** (new) — Compact card with big value + delta chip + inline SVG sparkline (linear gradient area fill + terminal dot). `tone` prop drives line color. Native fallback uses "sparkbars".
- **DistributionNoticeCard** (new) — Institutional statement tile with mono ref code, big serif amount, period chip, navy left-accent bar, PDF download / "Saved" indicator.
- **PrismLoader** (new · bonus enhancement) — Signature rotating tetrahedron using the four brand-blue facets. CSS keyframes on web, Animated.loop on native, respects reduce-motion. Available in `sm | md | lg`.

### Component preview page
- Added `/phase-b-preview` route (auth-guarded) that demonstrates every Phase B primitive on one canvas. Handy for design QA and cross-role review.

### Visual QA snapshot
- ✅ Sign-in still renders cleanly (tetrahedron top-left, navy CTA, editorial serif).
- ✅ LM home unchanged (backwards-compatible Card/Button).
- ✅ Preview page shows every new primitive rendering correctly: HeroBalance CountUp lands on ₦2,450,000 with mint delta chip, all 7 Button variants render, ChipRow shows active navy pill + count badges, ActionPillGroup shows raised primary Browse, SparklineTiles show growth (green) and decline (navy) lines with delta chips, DistributionNoticeCards show mono refs + navy accent bar + PDF/Saved affordance, 5 Card tones (default/brand/success/warning/danger), and 3 PrismLoaders rotating continuously.
- ✅ No runtime errors; hot-reload works across all new primitives.

### Design blueprint referenced
- `/app/design_guidelines.json` (from `design_agent_full_stack`) — the tokens/motion matrix/screen blueprints created in Phase A are guiding Phase B and will guide Phases C–E.

### Roadmap (post-Phase B)
- **Phase C — Investor mobile surfaces**: refactor Portfolio Home + Statements + Project Financials to use HeroBalance, SparklineTile, DistributionNoticeCard, ActionPillGroup.
- **Phase D — LM desktop surfaces**: left-rail nav, Earnings screen with SparklineTile grid, Project Detail right-panel context.
- **Phase E — CEO desktop surfaces**: Approvals inbox, KPI dashboard, Users management.

## What's implemented + verified end-to-end (2026-07-27 · Phase A — Blue rebrand foundation)

### The rebrand
- Retired the RibhShare green palette. Prism Capital now runs on the user-specified four-blue institutional palette:
  - `#064F92` primary navy · `#6E82B4` dusty mid · `#B9C0DB` soft lavender · `#9A9B9D` warm grey
- Adopted the user-provided tetrahedron logo (four palette-blue facets) as the official Prism Capital mark. Assets processed to transparent PNG (`/app/public/images/prism-logo{,.-512}.png`, `/app/assets/images/prism-logo-512.png`), plus `apple-touch-icon.png` and `favicon.png`.
- Site name flipped from "RibhShare" → "Prism Capital" throughout (`site.ts`, `manifest.json`, `app.config.ts`, sign-in wordmark, home header, PDF footers still say Prism which is aligned).

### Design token overhaul (`src/constants/colors.ts`)
- Full rewrite: 10-step `brand` ramp (light + dark) anchored at #064F92, 11-step warm-grey `ink` ramp, `accent2` (dusty blue #6E82B4), semantic pairs verified AA in both themes, `focusRing`, `gold` alias kept as legacy shim (points at accent2 so any old `palette.gold` reference still renders in blue).
- Legacy keys preserved (`primary`, `text`, `border`, `success`, `warning`, `danger`, `info`, `muted`, `errorLight`, etc.) so existing screens keep compiling.

### Typography (`src/constants/typography.ts` + `+html.tsx`)
- Display face shifted from Fraunces → **Instrument Serif** (editorial serif) with Fraunces retained as a graceful fallback so nothing breaks mid-rollout.
- Loaded Instrument Serif via Google Fonts alongside Inter and JetBrains Mono.

### Chrome + branded assets
- `AppHeader` mark: leaf icon → tetrahedron `<img>` in a light-blue chip (Platform.OS==='web' branch to avoid RN-Web `Image` sizing quirks).
- `BrandCanvas` (sign-in split-screen): diamond placeholder → tetrahedron `<img>` alongside the "Prism Capital" wordmark.
- `theme-color` meta and PWA manifest updated to `#064F92`.

### Visual QA snapshot
- ✅ Sign-in desktop: deep-navy gradient canvas, tetrahedron top-left, blue "Sign in" CTA, "WELCOME BACK" navy accent.
- ✅ Sign-in mobile: hero collapses cleanly, form stack looks premium.
- ✅ LM home: header shows the Prism tetrahedron + wordmark, stat cards use the new light-blue iconography tiles, "View all" link in navy.
- ✅ Project detail (LM): tabs and underlines rendered in navy, bottom nav "Home" active in navy.
- ✅ Zero runtime errors, zero visual regressions beyond the intended color/font shifts.

### Design blueprint saved
- `/app/design_guidelines.json` (from design_agent_full_stack) — tokens, motion matrix, screen blueprints, competitive references. Guides Phases B–E.

### Roadmap (post-Phase A)
- Phase B: shared components refresh (Button, Card, Chip, StatCard, ActionPillGroup, SparklineTile, HeroBalance) + refreshed Sign-in polish.
- Phase C: Investor mobile surfaces (Home, Portfolio, Project Detail Financials, Statements list, Notifications).
- Phase D: LM desktop surfaces (Home, Earnings, Project Detail full pipeline, Create Project wizard, Invite Investor).
- Phase E: CEO desktop surfaces (Dashboard, Approvals queue, Users management) + admin polish.

## What's implemented + verified end-to-end (2026-07-25 · Section 4 — Accessibility & Performance floor)

### Section 4 of the Final Enhancement pass — code shipped + testing-agent verified (iteration_13)
- **RN-Web 0.21 ARIA forwarding fix**: Discovered that raw `role`/`aria-*` props on `Animated.View`/`Pressable`/`View`/`ScrollView` do NOT reach the DOM in RN-Web 0.21. Introduced a `Platform.OS === 'web'` native-DOM branch pattern across the components that carry a11y semantics.
- **Toast / ToastProvider**: On web, wrapped in a native `<div role="region" aria-label="Notifications">` and each toast is a native `<div role="alert"|"status" aria-live="assertive"|"polite" aria-atomic="true">`. Errors are announced assertively, success/info politely.
- **TabBar**: On web, renders a native `<div role="tablist">` containing `<button role="tab" aria-selected>` children with `tabIndex={active?0:-1}`. Every tab is ≥ 44px tall. Native (RN) fallback preserved.
- **ProjectDetail back button**: On web, renders a native `<button aria-label="Go back">` sized 44×44. Native fallback preserved.
- **UnitSpectrumBar**: On web, renders an off-screen `<span aria-label="Unit register. X of Y units taken, per-investor breakdown…">` so screen readers get the same info as the coloured bar.
- **AuthErrorBanner** (sign-in inline error): upgraded from `aria-live="polite"` to `role="alert" aria-live="assertive" aria-atomic="true"` for consistency with Toast policy.
- **Heavy-table memoization**: `ProjectAuditTab`, `ProjectLedgerTab`, and `ProjectReconciliationTab` now wrapped in `React.memo(...)` so parent re-renders don't rebuild the tables. Non-critical queries are naturally deferred by the conditional tab render (only the active tab mounts).
- **Semantic-token contrast fix (dark mode)**: Replaced hardcoded `#DC2626`/`#16A34A`/`#F59E0B` in Ledger and Reconciliation tabs with `palette.semantic.danger.fg` / `palette.semantic.success.fg` / `palette.semantic.warning.fg`. Audit tab event colours were tightened to AA-verified hexes.
- **EarningsScreen fix**: The `backgroundImage` on the hero moved from a static StyleSheet entry to an inline `Platform.OS === 'web'` conditional that consumes `palette.primary`/`palette.primaryHover`. No more "background shorthand" console warning.

### Section 4 acceptance criteria (iteration_13)
- ✅ `<div role="region" aria-label="Notifications">` present on every page.
- ✅ Sign-in error banner is `role="alert" aria-live="assertive"`.
- ✅ CEO/LM/Investor sign-ins all succeed.
- ✅ ProjectDetail back button is native `<button aria-label="Go back">` at 44×44.
- ✅ Inner TabBar is `<div role="tablist">` with 5 `<button role="tab" aria-selected>` at 44px each.
- ✅ Bottom nav still emits `role="tab"` (regression clean).
- ✅ Toast is a child of the notifications region (`region.contains(toast) === true`).
- ✅ Tab switching (Overview/Documents/Risks/Timeline/Investors + Profits/Reconciliation/Audit/Ledger) — no console errors, memoization holds.
- ✅ UnitSpectrumBar SR summary reaches the DOM even for a 0-committed project.
- ⏭️ Dark-mode DR/CR semantic tokens — code path in place, no seed ledger rows so partially verified.
- ⏭️ Investor CONFIRMED-invite deep-link regression — pre-existing 5cafd920 "Invite not found" persists; out of Section-4 scope.
- ✅ Earnings hero renders with 0 background-shorthand warnings.

## What's implemented + verified end-to-end (2026-07-24 · P1 leftovers)

### P1 UI leftovers — all three shipped
- **Copy invite link quick-share**: on LM's Investors tab, unredeemed invites now show a "Copy invite link" pill button. Copies to clipboard as `You've been invited to invest via Prism Capital... Email: X · One-time sign-in code: Y · Sign in here: <origin>/first-signin?email=X&code=Y`. Deep link works both on preview and ribhshare.com since it uses `window.location.origin`. Button hides once `first_signin_code_redeemed_at` is set.
- **SetPasswordScreen redirect fix**: after password set, redirect priority is now (1) explicit `?projectId=` param → project detail, (2) investor with any ACCEPTED/COMMITTED/PROOF_SUBMITTED invite → most-recent project detail directly, (3) fallback `/invitations` for investors, (4) role default tab. No more investors landing on `/home` and getting lost.
- **`useAuthStore.setSession` cleanup**: removed the hard-coded `role: 'INVESTOR'` fabrication. Now on session set, if it's the same auth user we preserve state; otherwise we clear user+role and let the profile loader set the real role. This fixes the foot-gun where LM/CEO logins were briefly treated as INVESTOR between session-hydrate and profile-fetch.
- `expo-clipboard` installed as a dependency.

## What's implemented + verified end-to-end (2026-07-24 · P4)

### P4 — Institutional foundation: double-entry ledger + PDF statements — code shipped, migration pending
- **`ledger_entries` table**: append-only double-entry rows (id, transaction_ref, sequence, project_id, account_code, party_id, direction DR/CR, amount_minor, actor_id, ref_type/ref_id, memo). Balance-enforcing statement-level trigger `enforce_ledger_balance` throws on any imbalanced transaction. RLS: CEO/admin sees all, LM sees their projects, investor sees their own party rows.
- **`post_ledger(ref, project, ref_type, ref_id, actor, lines)`**: helper RPC that inserts a JSONB array of lines in a single transaction. Called by triggers below.
- **Auto-posting triggers**:
  - `ledger_on_invite_confirm`: on invite → CONFIRMED, posts `DR project_bank / CR investor_capital[party]` for the amount.
  - `ledger_on_declaration_approve`: on declaration → APPROVED, posts full waterfall (`DR project_realised_pnl (net)`, `CR platform_fee_payable`, `CR manager_payable[LM]`, `CR investor_payable[party]` × N investors, plus `rounding_reserve` for per-unit floor residue). If FINAL, additionally posts capital-return leg (`DR investor_capital[party]` × N, `CR project_bank total`).
  - Both triggers idempotent — re-fire on same event is a no-op.
- **View `ledger_project_balances`** + RPC `list_project_ledger(project, limit)` — trial-balance style rollup + entry list.
- **New Ledger tab on Project Detail**: renders account balances at top + every transaction as an expandable card (transaction ref, timestamp, DR=CR total, one row per line with DR/CR tag + account label + amount + memo). Ordered latest-first.
- **PDF statement export**: Statements screen now has "Download PDF" button per notice. Client-side jsPDF renders a Prism-branded A4 with reference/date, project name, investor name, hero "Your share" ₦ block, full waterfall table, and immutable-notice footer. Filename: `Statement_<PRSM-NOT-ref>.pdf`.
- **jsPDF installed** as a dependency (`yarn add jspdf`).

### Action needed on user side
- Run `20260128000000_p4_ledger.sql` in Supabase → SQL Editor (SQL block in chat).

## What's implemented + verified end-to-end (2026-07-24 · P3)

### P3 — Institutional transparency layer — code shipped, migration pending
- **`distribution_notices` table**: one immutable row per (approved declaration × confirmed investor). Fields: units_held, per_unit_minor, profit_minor, capital_returned_minor (>0 only for FINAL), reference `PRSM-<code>-NOTxxx`, is_final. RLS: investor sees own; LM/CEO sees all on their projects.
- **`audit_events` table + triggers**: append-only log of every meaningful action — project created / stage_changed / approval_status_changed, invite created / accepted / pledged / payment_claimed / verified_and_allotted / declined, declaration declared / approved / rejected. Triggers on `projects`, `invites`, `profit_declarations` fire automatically. RLS: investors see events on projects they're confirmed on.
- **`approve_profit_declaration` extended**: on approve, also mints one distribution notice per confirmed investor with reference `PRSM-<code>-NOTxxx`. Idempotent — no double insert.
- **New RPCs**: `list_investor_notices()` (returns notices for auth user with full declaration context), `list_project_audit(project, limit)`, `project_reconciliation(project)` (expected inflow vs claimed per invite, flags variance for Finance).
- **Statements tab (investors)**: new bottom-nav route. Each notice = full waterfall card showing gross → net → Prism fee → investor pool → per-unit → their share. FINAL notices show "Capital returned" in a highlighted secondary block with total credit.
- **Audit tab (LM/CEO Project Detail)**: colour-coded event stream with humanized labels + CSV export button (works on web).
- **Reconciliation tab (LM/CEO Project Detail)**: summary (expected total / claimed / net variance / flagged count) + per-invite rows showing units, expected ₦, claimed ₦, variance (red border if non-zero). Bank + narration + verifier name inlined for match against actual statement.

### Action needed on user side
- Run `20260126000000_p3_transparency.sql` in Supabase → SQL Editor (SQL contents below in chat).

## What's implemented + verified end-to-end (2026-07-24 · P2)

### P2 — Maker-checker profit declarations + waterfall — code shipped, migration pending
- New `profit_declarations` table (id, project_id, reference `PRSM-<code>-DECL<seq>`, label, is_final, gross/costs/net/prism_fee/distributable/investor_pool/manager_share/per_unit, status PENDING/APPROVED/REJECTED, declared_by/at, approved_by/at, rejected_by/at, rejection_note). Immutable post-approval; RLS locks reads to project owner + confirmed investors + CEO/admin.
- **RPCs**:
  - `declare_profit(project, gross, costs, label, is_final)` — LM/CEO creates PENDING. Waterfall pre-computed & stored. Validates project stage=PROGRESS unless final, permissions, positivity, cost ≤ gross.
  - `approve_profit_declaration(id)` — CEO/admin only. Rejects self-approval (four-eyes). On approve: bumps `projects.realised_profit_minor` and, if `is_final=true`, generates `investor_payouts` rows pro-rata by allotted units + sets stage=END.
  - `reject_profit_declaration(id, note)` — CEO/admin, adds audit trail.
  - `list_pending_declarations()` — CEO/admin queue helper.
- **`ProjectProfitsTab.tsx`** rebuilt: LM sees a live waterfall preview (Gross → Costs → Net → Prism fee → Distributable → Investor pool → Manager share → Per unit) that updates as they type; two submit buttons — "Submit for approval" (regular) and red "Submit as final (end project)" with confirmation. Below the form, every past declaration renders as an immutable card with reference, status chip (PENDING / APPROVED / REJECTED / FINAL), full waterfall breakdown, and Approve/Reject buttons for CEO (only if they didn't submit it — four-eyes principle enforced client-side too).
- **`ApprovalsListScreen.tsx`** rewritten: top toggle **Declarations | Projects (n)**, Declarations shows the pending queue with reference/label/gross/net/investor pool/per-unit summary. Tapping a row deep-links to that project's Profits tab.
- **Old `end_project_now` and `post_profit_update` deprecated** in the UI — the P2 pipeline replaces them (still callable, but no longer surfaced). Old ProjectProfitsTab hook `useEndProject` remains for backwards-compat but nothing calls it.
- **Verified**: TypeScript compiles clean; Approvals screen renders with correct empty state and toggle; declaration form + waterfall preview code compiles and lint-passes.
- **Action needed on user side**: run `20260125000000_p2_profit_declarations.sql` migration in Supabase → SQL Editor.

### P1 — Unit-based subscription model — shipped & verified live
- Verified via test project **PRJ-114 "hassanu"** created through the wizard, DB confirms: `total_units=50`, `min_units_per_investor=1`, `platform_fee_bps=750`.
- New columns on `projects`: `total_units`, `min_units_per_investor`, `platform_fee_bps` (default 750 = 7.5%), `pledge_expiry_hours` (default 72).
- New columns on `invites`: `units_pledged`, `units_allotted`, `payment_reference` (unique, `PRSM-<code>-INV<seq>`), `pledged_at`, `pledge_expires_at`, `verified_at`, `verified_by`, `payment_claim_amount_minor/bank/date/narration`.
- New RPCs: `pledge_units(invite, units)`, `expire_stale_pledges(project)`, `project_units_committed(project)`.
- Trigger `set_units_allotted_on_confirm`: when LM confirms payment, `units_allotted := units_pledged` + stamps `verified_at`/`verified_by` automatically.
- **Create Project wizard, Basics step**: new fields Total Units · Minimum units per investor · Prism Capital fee (%) with live `1 unit = ₦X` pill.
- **Edge function `create-project`**: accepts + validates `totalUnits`, `minUnitsPerInvestor`, `platformFeeBps`; rejects target not divisible by units.
- **Project Detail (LM/CEO)**: FinancialOverview swaps "Projected Profit" → "Unit Price" when project is unitized; shows `X / Y units subscribed · Z available`.
- **Project Detail (Investor payment tab)**: "How many units?" input (whole numbers), live total pledge preview, min-units hint; falls back to ₦ amount for legacy projects.
- **Payment reference card**: after pledge, big monospaced `PRSM-CODE-INV001` in highlighted card for investor to copy into transfer narration.
- **LM Investors tab**: each investor row shows `10 units · ₦10M · ref · PRSM-...` for bank reconciliation.
- **Lazy pledge-expiry sweep**: on every Project Detail load, `expire_stale_pledges(project)` releases 72h-stale pledges.
- Pre-P1 projects (2 dead ones without unit fields) will be deleted via `cleanup_pre_p1.sql`.

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
