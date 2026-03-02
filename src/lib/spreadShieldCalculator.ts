/**
 * SpreadShield: two-leg Long/Short calculator.
 * Reuses app fee logic: round-trip fee = notional * feeRate * (2 + movePct/100)
 * (entry + exit side; exit/entry = 1 + movePct/100 for the move).
 */

import { CRYPTO_FEE_RATE } from "@/app/lib/calculations";

/** Stocks: default 0.1% per side (match typical broker). */
export const STOCKS_FEE_RATE = 0.001;

export type AccountMode = "crypto" | "stocks";
export type MarginMode = "fixed" | "percent";
export type LegDirection = "long" | "short";

const LEVERAGE_MIN = 1;
const LEVERAGE_MAX_CRYPTO = 125;
const LEVERAGE_MAX_STOCKS = 20;

export function getLeverageMax(accountMode: AccountMode): number {
  return accountMode === "crypto" ? LEVERAGE_MAX_CRYPTO : LEVERAGE_MAX_STOCKS;
}

export function getFeeRate(accountMode: AccountMode): number {
  return accountMode === "crypto" ? CRYPTO_FEE_RATE : STOCKS_FEE_RATE;
}

/**
 * Fee for one leg (round-trip): notional * feeRate * (2 + movePct/100).
 * Matches app logic: entry * qty_coin * feeRate + exit * qty_coin * feeRate with exit/entry = 1 + movePct/100.
 */
export function feeForLeg(
  notional: number,
  movePct: number,
  feeRate: number
): number {
  if (notional <= 0) return 0;
  return notional * feeRate * (2 + movePct / 100);
}

/**
 * Gross PnL from percent move: margin_value * leverage * (movePct / 100).
 * Sign: positive = profit (TP), negative = loss (SL).
 */
export function grossPnLFromMove(
  marginValue: number,
  leverage: number,
  movePct: number
): number {
  return marginValue * leverage * (movePct / 100);
}

export type MarginTotalMode = "total" | "perLeg";
export type LeverageMode = "shared" | "perLeg";
export type TpSlMode = "shared" | "perLeg";
export type PairMode = "spread" | "directional";

export type SpreadShieldInputs = {
  accountMode: AccountMode;
  marginMode: MarginMode;
  marginFixed: number;
  marginPercent: number;
  balance: number;
  leverage: number;
  tpPct: number;
  slPct: number;
};

export type LegResult = {
  margin: number;
  leverage: number;
  notional: number;
  profitAtTp: number;
  lossAtSl: number;
  feesAtTp: number;
  feesAtSl: number;
  netTp: number;
  netSl: number;
};

export type SpreadShieldResult = {
  marginValue: number;
  balance: number;
  balanceMissing: boolean;
  feeRate: number;
  legA: LegResult;
  legB: LegResult;
  totalProfitAtTp: number;
  totalLossAtSl: number;
  totalFeesAtTp: number;
  totalFeesAtSl: number;
  totalFees: number;
  spreadOutcome1: number;
  spreadOutcome2: number;
  directionalBothTp: number;
  directionalBothSl: number;
  spreadOutcome1Pct: number;
  spreadOutcome2Pct: number;
  directionalBothTpPct: number;
  directionalBothSlPct: number;
};

/** Resolve margin for one leg (fixed or % of balance). */
function resolveMargin(
  mode: MarginMode,
  fixed: number,
  percent: number,
  balance: number
): number {
  if (mode === "fixed") return Math.max(0, fixed);
  return Math.max(0, (balance * Math.min(100, Math.max(0, percent))) / 100);
}

/** Compute one leg: notional, gross TP/SL, fees, net TP/SL. */
function computeLeg(
  marginLeg: number,
  leverageLeg: number,
  tpPctLeg: number,
  slPctLeg: number,
  feeRate: number,
  leverageMax: number
): LegResult {
  const lev = Math.max(LEVERAGE_MIN, Math.min(leverageLeg, leverageMax));
  const notional = marginLeg * lev;
  const grossTp = notional * (tpPctLeg / 100);
  const grossSl = notional * (slPctLeg / 100);
  const feesTp = feeForLeg(notional, tpPctLeg, feeRate);
  const feesSl = feeForLeg(notional, slPctLeg, feeRate);
  const netTp = Math.round((grossTp - feesTp) * 100) / 100;
  const netSl = Math.round(-(grossSl + feesSl) * 100) / 100;
  return {
    margin: marginLeg,
    leverage: lev,
    notional,
    profitAtTp: netTp,
    lossAtSl: netSl,
    feesAtTp: Math.round(feesTp * 100) / 100,
    feesAtSl: Math.round(feesSl * 100) / 100,
    netTp,
    netSl,
  };
}

export type SpreadShieldExtendedInputs = {
  accountMode: AccountMode;
  balance: number;
  marginTotalMode: MarginTotalMode;
  marginMode: MarginMode;
  marginFixed: number;
  marginPercent: number;
  splitA: number;
  marginAMode: MarginMode;
  marginAFixed: number;
  marginAPercent: number;
  marginBMode: MarginMode;
  marginBFixed: number;
  marginBPercent: number;
  leverageMode: LeverageMode;
  leverage: number;
  leverageA: number;
  leverageB: number;
  tpSlMode: TpSlMode;
  tpPct: number;
  slPct: number;
  tpA: number;
  slA: number;
  tpB: number;
  slB: number;
};

export function computeSpreadShield(inputs: SpreadShieldInputs): SpreadShieldResult {
  const balanceSafe = Math.max(0, inputs.balance);
  const marginValue = resolveMargin(
    inputs.marginMode,
    inputs.marginFixed,
    inputs.marginPercent,
    balanceSafe
  );
  const levMax = getLeverageMax(inputs.accountMode);
  const feeRate = getFeeRate(inputs.accountMode);
  const leg = computeLeg(
    marginValue,
    inputs.leverage,
    inputs.tpPct,
    inputs.slPct,
    feeRate,
    levMax
  );
  const balanceMissing =
    balanceSafe <= 0 &&
    (inputs.marginMode === "percent");
  const totalFees = leg.feesAtTp + leg.feesAtSl;
  const spread1 = leg.netTp + leg.netSl;
  const spread2 = leg.netSl + leg.netTp;
  const bothTp = leg.netTp * 2;
  const bothSl = leg.netSl * 2;
  const pct = (v: number) => (balanceSafe > 0 ? (v / balanceSafe) * 100 : 0);
  return {
    marginValue,
    balance: balanceSafe,
    balanceMissing,
    feeRate,
    legA: leg,
    legB: { ...leg },
    totalProfitAtTp: bothTp,
    totalLossAtSl: bothSl,
    totalFeesAtTp: leg.feesAtTp * 2,
    totalFeesAtSl: leg.feesAtSl * 2,
    totalFees: totalFees * 2,
    spreadOutcome1: spread1,
    spreadOutcome2: spread2,
    directionalBothTp: bothTp,
    directionalBothSl: bothSl,
    spreadOutcome1Pct: pct(spread1),
    spreadOutcome2Pct: pct(spread2),
    directionalBothTpPct: pct(bothTp),
    directionalBothSlPct: pct(bothSl),
  };
}

export function computeSpreadShieldExtended(
  inputs: SpreadShieldExtendedInputs
): SpreadShieldResult {
  const balanceSafe = Math.max(0, inputs.balance);
  const levMax = getLeverageMax(inputs.accountMode);
  const feeRate = getFeeRate(inputs.accountMode);

  let marginA: number;
  let marginB: number;
  if (inputs.marginTotalMode === "total") {
    const totalMargin = resolveMargin(
      inputs.marginMode,
      inputs.marginFixed,
      inputs.marginPercent,
      balanceSafe
    );
    const split = Math.max(0, Math.min(100, inputs.splitA)) / 100;
    marginA = totalMargin * split;
    marginB = totalMargin * (1 - split);
  } else {
    marginA = resolveMargin(
      inputs.marginAMode,
      inputs.marginAFixed,
      inputs.marginAPercent,
      balanceSafe
    );
    marginB = resolveMargin(
      inputs.marginBMode,
      inputs.marginBFixed,
      inputs.marginBPercent,
      balanceSafe
    );
  }

  const levA =
    inputs.leverageMode === "shared"
      ? inputs.leverage
      : inputs.leverageA;
  const levB =
    inputs.leverageMode === "shared"
      ? inputs.leverage
      : inputs.leverageB;
  const tpA = inputs.tpSlMode === "shared" ? inputs.tpPct : inputs.tpA;
  const slA = inputs.tpSlMode === "shared" ? inputs.slPct : inputs.slA;
  const tpB = inputs.tpSlMode === "shared" ? inputs.tpPct : inputs.tpB;
  const slB = inputs.tpSlMode === "shared" ? inputs.slPct : inputs.slB;

  const legA = computeLeg(marginA, levA, tpA, slA, feeRate, levMax);
  const legB = computeLeg(marginB, levB, tpB, slB, feeRate, levMax);

  const balanceMissing =
    balanceSafe <= 0 &&
    (inputs.marginTotalMode === "total"
      ? inputs.marginMode === "percent"
      : inputs.marginAMode === "percent" || inputs.marginBMode === "percent");

  const totalFees = legA.feesAtTp + legA.feesAtSl + legB.feesAtTp + legB.feesAtSl;
  const spreadOutcome1 = Math.round((legA.netTp + legB.netSl) * 100) / 100;
  const spreadOutcome2 = Math.round((legA.netSl + legB.netTp) * 100) / 100;
  const directionalBothTp = Math.round((legA.netTp + legB.netTp) * 100) / 100;
  const directionalBothSl = Math.round((legA.netSl + legB.netSl) * 100) / 100;

  const pct = (v: number) => (balanceSafe > 0 ? Math.round((v / balanceSafe) * 10000) / 100 : 0);

  return {
    marginValue: marginA + marginB,
    balance: balanceSafe,
    balanceMissing,
    feeRate,
    legA,
    legB,
    totalProfitAtTp: directionalBothTp,
    totalLossAtSl: directionalBothSl,
    totalFeesAtTp: legA.feesAtTp + legB.feesAtTp,
    totalFeesAtSl: legA.feesAtSl + legB.feesAtSl,
    totalFees: Math.round(totalFees * 100) / 100,
    spreadOutcome1,
    spreadOutcome2,
    directionalBothTp,
    directionalBothSl,
    spreadOutcome1Pct: pct(spreadOutcome1),
    spreadOutcome2Pct: pct(spreadOutcome2),
    directionalBothTpPct: pct(directionalBothTp),
    directionalBothSlPct: pct(directionalBothSl),
  };
}
