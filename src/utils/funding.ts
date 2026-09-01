/** Funding progress as 0–100 from target vs raised (minor units / kobo). */
export function getFundingProgress(project: {
  targetMinor?: number;
  raisedMinor?: number;
  /** @deprecated legacy mock field */
  targetKobo?: number;
  /** @deprecated legacy mock field */
  raisedKobo?: number;
}): number {
  const target = project.targetMinor ?? project.targetKobo ?? 0;
  const raised = project.raisedMinor ?? project.raisedKobo ?? 0;
  if (target <= 0) return 0;
  return Math.min(100, Math.round((raised / target) * 100));
}

export function getDaysLeft(deadline?: string): number | null {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
