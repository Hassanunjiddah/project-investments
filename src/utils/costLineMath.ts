export type CostLineClass = 'CAPEX' | 'OPEX';
export type CostLineNature = 'ONE_TIME' | 'RECURRING';

export function summarizeCostLines(
  lines: { class: CostLineClass; nature: CostLineNature; totalMinor: number }[],
) {
  let capex = 0;
  let opex = 0;
  let recurringOpex = 0;
  for (const line of lines) {
    if (line.class === 'CAPEX') capex += line.totalMinor;
    else opex += line.totalMinor;
    if (line.class === 'OPEX' && line.nature === 'RECURRING') {
      recurringOpex += line.totalMinor;
    }
  }
  return {
    totalMinor: capex + opex,
    capexMinor: capex,
    opexMinor: opex,
    recurringOpexMinor: recurringOpex,
    count: lines.length,
  };
}
