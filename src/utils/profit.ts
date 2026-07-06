import type { Project } from '@/src/types/project.types';

export function projectedProfitKobo(
  project: Pick<Project, 'targetKobo' | 'profitSplitInvestorBps'>,
  investKobo: number,
): number {
  const effectiveProfit = Math.round(project.targetKobo * 0.2);
  if (project.targetKobo <= 0) return 0;
  return Math.round(
    effectiveProfit * (investKobo / project.targetKobo) * (project.profitSplitInvestorBps / 10000),
  );
}
