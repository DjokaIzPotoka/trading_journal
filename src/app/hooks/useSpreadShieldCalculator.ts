"use client";

import * as React from "react";
import { getStartingBalanceCrypto, getStartingBalanceStocks } from "@/app/lib/settings";
import {
  computeSpreadShield,
  computeSpreadShieldExtended,
  getLeverageMax,
  type AccountMode,
  type MarginMode,
  type SpreadShieldResult,
  type MarginTotalMode,
  type LeverageMode,
  type TpSlMode,
} from "@/lib/spreadShieldCalculator";

export type UseSpreadShieldCalculatorParams = {
  accountMode: AccountMode;
  marginMode: MarginMode;
  marginFixed: number;
  marginPercent: number;
  leverage: number;
  tpPct: number;
  slPct: number;
};

export type UseSpreadShieldCalculatorExtendedParams = {
  accountMode: AccountMode;
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

export function useSpreadShieldCalculator(
  params: UseSpreadShieldCalculatorParams
): SpreadShieldResult & { balance: number; leverageMax: number } {
  const balance =
    params.accountMode === "crypto"
      ? getStartingBalanceCrypto()
      : getStartingBalanceStocks();

  const result = React.useMemo(
    () =>
      computeSpreadShield({
        ...params,
        balance,
      }),
    [
      params.accountMode,
      params.marginMode,
      params.marginFixed,
      params.marginPercent,
      params.leverage,
      params.tpPct,
      params.slPct,
      balance,
    ]
  );

  const leverageMax = getLeverageMax(params.accountMode);

  return {
    ...result,
    balance,
    leverageMax,
  };
}

export function useSpreadShieldCalculatorExtended(
  params: UseSpreadShieldCalculatorExtendedParams
): SpreadShieldResult & { balance: number; leverageMax: number } {
  const balance =
    params.accountMode === "crypto"
      ? getStartingBalanceCrypto()
      : getStartingBalanceStocks();

  const result = React.useMemo(
    () =>
      computeSpreadShieldExtended({
        ...params,
        balance,
      }),
    [
      params.accountMode,
      params.marginTotalMode,
      params.marginMode,
      params.marginFixed,
      params.marginPercent,
      params.splitA,
      params.marginAMode,
      params.marginAFixed,
      params.marginAPercent,
      params.marginBMode,
      params.marginBFixed,
      params.marginBPercent,
      params.leverageMode,
      params.leverage,
      params.leverageA,
      params.leverageB,
      params.tpSlMode,
      params.tpPct,
      params.slPct,
      params.tpA,
      params.slA,
      params.tpB,
      params.slB,
      balance,
    ]
  );

  const leverageMax = getLeverageMax(params.accountMode);

  return {
    ...result,
    balance,
    leverageMax,
  };
}
