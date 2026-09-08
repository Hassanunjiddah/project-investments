import type { ProjectStage } from '@/src/types/project.types';

export type PortfolioHoldingStatus = 'active' | 'completed';

export type PortfolioEntry = {
  id: string;
  projectId: string;
  projectName: string;
  projectSector?: string;
  projectBannerUrl?: string | null;
  projectStage: ProjectStage;
  capitalKobo: number;
  projectedReturnKobo: number;
  realisedReturnKobo?: number;
  estimatedRoiBps: number;
  progressPct: number;
  status: PortfolioHoldingStatus;
  /** Units this investor holds (from invites.units_allotted). */
  unitsHeld: number;
  /** Project total units (for ownership %). */
  totalUnits?: number;
  /** Ownership of the unit pool (0–100). */
  ownershipPct?: number;
  /** Project investor pool split of distributable profit (0–100), e.g. 70. */
  profitSplitInvestorPct?: number;
  /**
   * Total project capital (target_minor). Grows when a CEO-approved funding
   * round mints additional units, which is what dilutes ownershipPct.
   */
  projectTargetMinor?: number;
  /** Entry price per unit for the project (target / total_units). */
  unitPriceMinor: number;
  /**
   * Current NET NAV per unit — reflects declared + approved investor profit
   * distributed across all units. Formula:
   *   navPerUnit = unitPrice + (project's cumulative investor pool / totalUnits)
   * Investors see this as "1 unit = ₦X" and it auto-updates when a
   * declaration is approved (via TanStack Query realtime invalidation).
   */
  navPerUnitMinor: number;
  /** Market value of the investor's position (unitsHeld × navPerUnit). */
  positionValueMinor: number;
  /** Realised P&L for the position (positionValue - capital). */
  pnlMinor: number;
  /** Realised P&L in basis-points of capital (bps of cost basis). */
  pnlBps: number;
};

export type PortfolioStats = {
  portfolioValueKobo: number;
  investedKobo: number;
  projectedProfitKobo: number;
  realisedProfitKobo: number;
  /** Overall P&L in basis-points of invested capital. */
  pnlBps: number;
  /** Sum of units held across confirmed positions. */
  totalUnitsHeld: number;
  /**
   * The investor's effective share of declared profit (0–100), units-weighted
   * across positions: (unitsHeld / totalUnits) × investor pool split.
   * E.g. 56 when the investor holds 80% of the units and the investor pool
   * is 70%. Shrinks when an approved raise mints new units.
   */
  effectiveProfitSharePct?: number;
  /**
   * Investors' collective share of distributable profit (0–100),
   * units-weighted across positions — 70 for a 70/30 investors/project-owner
   * split, applied after Prism's fees. Rendered as "70/30", never as a
   * bare "share" %.
   */
  investorPoolPct?: number;
  /** Sum of total project capital (target) across held projects. */
  totalProjectCapitalKobo: number;
};
