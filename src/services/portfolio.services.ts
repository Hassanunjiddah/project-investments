import type { PortfolioEntry } from '@/src/types/portfolio.types';
import { supabase } from '@/src/services/supabase';
import { normalizeError } from '@/src/helpers/supabaseError';

const MOCK_PORTFOLIO: PortfolioEntry[] = [
  {
    projectId: 'PRJ-104',
    projectName: 'Kano Solar Cold-Chain',
    capitalKobo: 50000000,
    projectedReturnKobo: 7000000,
  },
];

function isTableMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === '42P01'
  );
}

export async function fetchPortfolio(userId: string): Promise<PortfolioEntry[]> {
  const { data, error } = await supabase
    .from('invites')
    .select('amount_kobo, projected_profit_kobo, project_id, projects(name)')
    .eq('investor_id', userId)
    .eq('status', 'CONFIRMED');

  if (error) {
    if (isTableMissing(error)) return MOCK_PORTFOLIO;
    throw normalizeError(error);
  }

  return (data ?? []).map((row) => {
    const typed = row as {
      amount_kobo: number;
      projected_profit_kobo: number;
      project_id: string;
      projects: { name: string } | null;
    };
    return {
      projectId: typed.project_id,
      projectName: typed.projects?.name ?? 'Unknown Project',
      capitalKobo: typed.amount_kobo,
      projectedReturnKobo: typed.projected_profit_kobo,
    };
  });
}
