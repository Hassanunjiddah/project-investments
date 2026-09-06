import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/src/services/supabase';

type Params = {
  isInvestorRole: boolean;
  projectId: string;
  totalUnits?: number | null;
  inviteId?: string | null;
  inviteStatus?: string | null;
  minWaiverStatus?: string | null;
  unitsPledged?: number | null;
};

/**
 * Investor-side remaining units. LM views derive availability from the
 * invite register; investors often don't load that list, so we hit
 * `project_units_reserved` instead.
 */
export function useUnitsAvailability({
  isInvestorRole,
  projectId,
  totalUnits,
  inviteId,
  inviteStatus,
  minWaiverStatus,
  unitsPledged,
}: Params) {
  const [investorAvailable, setInvestorAvailable] = useState<number | null>(null);
  const [investorUnitsLoading, setInvestorUnitsLoading] = useState(false);

  const refreshInvestorUnits = useCallback(async () => {
    if (!isInvestorRole || !projectId || !totalUnits) {
      setInvestorAvailable(null);
      setInvestorUnitsLoading(false);
      return;
    }
    setInvestorUnitsLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)('project_units_reserved', {
        p_project_id: projectId,
        p_exclude_invite_id: inviteId ?? null,
      });
      if (error) {
        setInvestorAvailable(null);
        return;
      }
      const reserved = Number(data ?? 0);
      const avail = Math.round(Math.max(0, (totalUnits ?? 0) - reserved) * 1e6) / 1e6;
      setInvestorAvailable(avail);
    } catch {
      setInvestorAvailable(null);
    } finally {
      setInvestorUnitsLoading(false);
    }
  }, [isInvestorRole, projectId, totalUnits, inviteId]);

  useEffect(() => {
    void refreshInvestorUnits();
  }, [refreshInvestorUnits, inviteStatus, minWaiverStatus, unitsPledged]);

  return { investorAvailable, investorUnitsLoading, refreshInvestorUnits };
}
