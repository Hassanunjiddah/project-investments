/** Format unit counts for display (supports fractional pledges). */
export function formatUnits(units: number): string {
  if (!Number.isFinite(units)) return '0';
  const rounded = Math.round(units * 1e6) / 1e6;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
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
