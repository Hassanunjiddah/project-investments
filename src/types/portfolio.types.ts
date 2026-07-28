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
};
