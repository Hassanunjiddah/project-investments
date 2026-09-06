import { nairaToKobo, koboToNaira, parseNairaInput } from './currency';
import { getFundingProgress } from './funding';
import { formatUnits, ownershipPct } from './units';
import { currentCapitalMinor, roundUnits } from './projectMath';
import { summarizeCostLines } from './costLineMath';
import { projectedProfitKobo } from './profit';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

export function runMoneyUtilTests() {
  assert(nairaToKobo(1) === 100, 'nairaToKobo 1');
  assert(nairaToKobo(48.5) === 4850, 'nairaToKobo 48.5');
  assert(koboToNaira(4850) === 48.5, 'koboToNaira');
  assert(parseNairaInput('₦1,200') === 1200, 'parseNairaInput');
  assert(parseNairaInput('') === 0, 'parse empty');

  assert(getFundingProgress({ targetMinor: 1000, raisedMinor: 250 }) === 25, 'funding 25%');
  assert(getFundingProgress({ targetMinor: 0, raisedMinor: 10 }) === 0, 'funding zero target');
  assert(getFundingProgress({ targetMinor: 100, raisedMinor: 200 }) === 100, 'funding cap 100');

  assert(formatUnits(1) === '1', 'formatUnits 1');
  assert(formatUnits(48.5) === '48.5', 'formatUnits 48.5');
  assert(ownershipPct(25, 100) === 25, 'ownershipPct');
  assert(ownershipPct(1, 0) === 0, 'ownershipPct zero total');

  assert(
    currentCapitalMinor({ raisedMinor: 1000, raiseFeeMinor: 25, drawnMinor: 100 }) === 875,
    'currentCapital',
  );
  assert(roundUnits(1.0000004) === 1, 'roundUnits');
  assert(roundUnits(1.0000006) === 1.000001, 'roundUnits up');

  const summary = summarizeCostLines([
    { class: 'CAPEX', nature: 'ONE_TIME', totalMinor: 48500 },
    { class: 'OPEX', nature: 'RECURRING', totalMinor: 9072 },
    { class: 'OPEX', nature: 'ONE_TIME', totalMinor: 1000 },
  ]);
  assert(summary.capexMinor === 48500, 'capex');
  assert(summary.opexMinor === 10072, 'opex');
  assert(summary.recurringOpexMinor === 9072, 'recurring opex');
  assert(summary.totalMinor === 58572, 'total');

  const profit = projectedProfitKobo(
    { targetKobo: 1_000_000, profitSplitInvestorBps: 7000 },
    100_000,
  );
  assert(profit === 14000, `projected profit ${profit}`);
}

runMoneyUtilTests();
console.log('money util tests passed');
