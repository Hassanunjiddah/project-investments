export type InvestmentStatus = 'active' | 'completed' | 'withdrawal';

export type PortfolioEntry = {
  id: string;
  projectId: string;
  investorId: string;
  amountKobo: number;
  projectedProfitKobo: number;
  realisedProfitKobo?: number;
  progressPct: number;
  estimatedCompletion?: string;
  status: InvestmentStatus;
};
