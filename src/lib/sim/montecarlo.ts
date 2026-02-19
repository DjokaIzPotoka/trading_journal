import { makeRng } from "./prng";

export type SimulationParams = {
  startingBalance: number;
  days: number;
  simulations: number;
  tradesPerDay: number;
  winRate: number;
  riskPerTradePct: number;
  leverage: number;
  winRMin: number;
  winRMax: number;
  lossRMin: number;
  lossRMax: number;
  feeRatePerSidePct: number;
  extremesEnabled: boolean;
  extremeProbPct: number;
  extremeWinR: number;
  extremeLossR: number;
  ruinThresholdPct: number;
  useSeed: boolean;
  seedValue: number | string;
};

export type SimulationPath = {
  balances: number[];
  finalBalance: number;
  totalFees: number;
  maxDrawdownPct: number;
  ruined: boolean;
};

export type SimulationSummary = {
  meanFinalBalance: number;
  medianFinalBalance: number;
  p5FinalBalance: number;
  p95FinalBalance: number;
  meanMaxDrawdownPct: number;
  ruinProbabilityPct: number;
  bestFinalBalance: number;
  worstFinalBalance: number;
  totalTradesPerSim: number;
  avgFeePaid: number;
  avgPnL: number;
};

function uniform(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo]);
}

export function runMonteCarlo(params: SimulationParams): {
  paths: SimulationPath[];
  summary: SimulationSummary;
} {
  const {
    startingBalance,
    days,
    simulations,
    tradesPerDay,
    winRate,
    riskPerTradePct,
    leverage,
    winRMin,
    winRMax,
    lossRMin,
    lossRMax,
    feeRatePerSidePct,
    extremesEnabled,
    extremeProbPct,
    extremeWinR,
    extremeLossR,
    ruinThresholdPct,
    useSeed,
    seedValue,
  } = params;

  const totalTradesPerSim = days * tradesPerDay;
  const ruinThreshold = startingBalance * (ruinThresholdPct / 100);
  const riskPct = riskPerTradePct / 100;
  const feePct = feeRatePerSidePct / 100;
  const extremeProb = extremeProbPct / 100;

  const paths: SimulationPath[] = [];

  for (let sim = 0; sim < simulations; sim++) {
    const rng = useSeed
      ? makeRng(typeof seedValue === "number" ? seedValue + sim : `${seedValue}-${sim}`)
      : () => Math.random();

    let balance = startingBalance;
    const balances: number[] = [balance];
    let totalFees = 0;

    for (let t = 0; t < totalTradesPerSim; t++) {
      const riskAmount = balance * riskPct;
      const notional = riskAmount * leverage;
      const totalFeesPerTrade = 2 * notional * feePct;

      const isWin = rng() < winRate / 100;

      let R: number;
      if (extremesEnabled && rng() < extremeProb) {
        R = isWin ? extremeWinR : extremeLossR;
      } else {
        R = isWin
          ? uniform(rng, winRMin, winRMax)
          : uniform(rng, lossRMin, lossRMax);
      }

      const pnl = isWin ? riskAmount * R : -riskAmount * R;
      const pnlAfterFees = pnl - totalFeesPerTrade;
      totalFees += totalFeesPerTrade;
      balance += pnlAfterFees;
      balances.push(balance);

      if (balance <= ruinThreshold) {
        while (balances.length < totalTradesPerSim + 1) balances.push(balance);
        break;
      }
    }

    let maxDrawdownPct = 0;
    let runPeak = balances[0];
    for (let i = 0; i < balances.length; i++) {
      const b = balances[i];
      if (b > runPeak) runPeak = b;
      const dd = runPeak > 0 ? ((runPeak - b) / runPeak) * 100 : 0;
      if (dd > maxDrawdownPct) maxDrawdownPct = dd;
    }

    paths.push({
      balances,
      finalBalance: balance,
      totalFees,
      maxDrawdownPct,
      ruined: balance <= ruinThreshold,
    });
  }

  const finalBalances = paths.map((p) => p.finalBalance).sort((a, b) => a - b);
  const drawdowns = paths.map((p) => p.maxDrawdownPct);
  const ruinCount = paths.filter((p) => p.ruined).length;
  const totalFeesList = paths.map((p) => p.totalFees);
  const meanFinalBalance =
    finalBalances.reduce((a, b) => a + b, 0) / finalBalances.length;
  const meanDrawdown =
    drawdowns.reduce((a, b) => a + b, 0) / drawdowns.length;
  const meanFees =
    totalFeesList.reduce((a, b) => a + b, 0) / totalFeesList.length;

  const summary: SimulationSummary = {
    meanFinalBalance,
    medianFinalBalance: percentile(finalBalances, 50),
    p5FinalBalance: percentile(finalBalances, 5),
    p95FinalBalance: percentile(finalBalances, 95),
    meanMaxDrawdownPct: meanDrawdown,
    ruinProbabilityPct: (ruinCount / simulations) * 100,
    bestFinalBalance: finalBalances[finalBalances.length - 1] ?? 0,
    worstFinalBalance: finalBalances[0] ?? 0,
    totalTradesPerSim,
    avgFeePaid: meanFees,
    avgPnL: meanFinalBalance - startingBalance,
  };

  return { paths, summary };
}
