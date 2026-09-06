import { AppError } from '@/src/helpers/supabaseError';
import { formatNaira } from '@/src/utils/currency';

/** Stable RPC message — DETAIL carries available kobo. */
export const WITHDRAWAL_EXCEEDS_AVAILABLE = 'WITHDRAWAL_EXCEEDS_AVAILABLE';

export function messageForWithdrawalError(err: unknown, fallback = 'Withdrawal failed'): string {
  if (err instanceof AppError && err.message === WITHDRAWAL_EXCEEDS_AVAILABLE) {
    const kobo = Number(err.details);
    if (Number.isFinite(kobo) && kobo >= 0) {
      return `Maximum available is ${formatNaira(kobo, false)}.`;
    }
  }
  return err instanceof Error ? err.message : fallback;
}
