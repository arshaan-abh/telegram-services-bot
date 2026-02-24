import { env } from "../config/env.js";
import { formatMinorToMoney, parseMoneyToMinor } from "./money.js";

export function dbMoneyToMinor(value: string): bigint {
  return parseMoneyToMinor(value, env.PRICE_DECIMALS);
}

export function minorToDbMoney(value: bigint): string {
  return formatMinorToMoney(value, env.PRICE_DECIMALS);
}
