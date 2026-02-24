const TEN = 10n;

export function parseMoneyToMinor(
  value: string | number,
  decimals: number,
): bigint {
  const raw = typeof value === "number" ? value.toString() : value.trim();
  if (!/^\d+(\.\d+)?$/.test(raw)) {
    throw new Error(`Invalid money value: ${value}`);
  }

  const [intPartRaw, fracPart = ""] = raw.split(".");
  const intPart = intPartRaw ?? "0";
  const normalizedFrac = fracPart.padEnd(decimals, "0").slice(0, decimals);
  const base = BigInt(intPart) * TEN ** BigInt(decimals);
  const frac = normalizedFrac.length > 0 ? BigInt(normalizedFrac) : 0n;

  return base + frac;
}

export function formatMinorToMoney(minor: bigint, decimals: number): string {
  const factor = TEN ** BigInt(decimals);
  const sign = minor < 0n ? "-" : "";
  const absolute = minor < 0n ? -minor : minor;
  const whole = absolute / factor;
  const frac = absolute % factor;

  if (decimals === 0) {
    return `${sign}${whole.toString()}`;
  }

  return `${sign}${whole.toString()}.${frac.toString().padStart(decimals, "0")}`;
}

export function percentOf(valueMinor: bigint, percent: number): bigint {
  if (percent <= 0) {
    return 0n;
  }

  return (valueMinor * BigInt(Math.round(percent * 100))) / 10000n;
}

export function clampMoney(valueMinor: bigint): bigint {
  return valueMinor < 0n ? 0n : valueMinor;
}
