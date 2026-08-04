/** Format unit counts for display (supports fractional pledges). */
export function formatUnits(units: number): string {
  if (!Number.isFinite(units)) return '0';
  const rounded = Math.round(units * 1e6) / 1e6;
  if (Number.isInteger(rounded)) return String(rounded);
  // Max 2 decimal places for UI; trim trailing zeros (e.g. 48.50 → 48.5).
  return rounded.toLocaleString('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function formatUnitsLabel(units: number): string {
  const text = formatUnits(units);
  const n = Math.round(units * 1e6) / 1e6;
  return `${text} unit${n === 1 ? '' : 's'}`;
}

/** Ownership of the unit pool as a percentage (0–100). */
export function ownershipPct(unitsHeld: number, totalUnits: number): number {
  if (!totalUnits || totalUnits <= 0 || !unitsHeld) return 0;
  return (unitsHeld / totalUnits) * 100;
}
