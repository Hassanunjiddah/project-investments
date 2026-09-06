import type { InvestorNotice } from '@/src/services/transparency.services';

export type CumulativeSummary = {
  totalDistributionsMinor: number;
  distributionsCount: number;
  investedMinor?: number;
};

export function computeCumulative(
  allNotices: InvestorNotice[],
  currentNotice: InvestorNotice,
  investedMinor?: number,
): CumulativeSummary {
  const onProject = allNotices.filter((n) => n.projectId === currentNotice.projectId);
  const upToNow = onProject.filter((n) => n.createdAt <= currentNotice.createdAt);
  const totalDistributionsMinor = upToNow.reduce(
    (sum, n) => sum + n.profitMinor + (n.isFinal ? n.capitalReturnedMinor : 0),
    0,
  );
  return {
    totalDistributionsMinor,
    distributionsCount: upToNow.length,
    investedMinor,
  };
}
