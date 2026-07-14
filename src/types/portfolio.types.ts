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
};

export type PortfolioStats = {
  portfolioValueKobo: number;
  investedKobo: number;
  projectedProfitKobo: number;
  realisedProfitKobo: number;
};
