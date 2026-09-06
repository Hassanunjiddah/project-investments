/** Current capital remaining after raise fee and remitted drawdowns (kobo). */
export function currentCapitalMinor(project: {
  raisedMinor?: number;
  raiseFeeMinor?: number;
  drawnMinor?: number;
}): number {
  return Math.max(
    0,
    (project.raisedMinor ?? 0) - (project.raiseFeeMinor ?? 0) - (project.drawnMinor ?? 0),
  );
}

/** Round unit counts to 6 decimal places (matches DB numeric(18,6)). */
export function roundUnits(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
