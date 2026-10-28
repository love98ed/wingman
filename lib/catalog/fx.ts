/**
 * Fixed rates to SGD (1 unit of currency = N SGD). Approximate mid-market rates,
 * last set 2026-10-28; refresh before the demo. Fixed rates keep tiers stable
 * between catalog refreshes.
 */
export const SGD_PER: Record<string, number> = {
  SGD: 1,
  USD: 1.3,
  EUR: 1.45,
  GBP: 1.72,
  AUD: 0.86,
  NZD: 0.78,
  CAD: 0.95,
  HKD: 0.167,
  MYR: 0.3,
  IDR: 0.000082,
  THB: 0.039,
  JPY: 0.0088,
  KRW: 0.00095,
  CNY: 0.18,
};

export class UnknownCurrencyError extends Error {}

export function toSgd(amount: number, currency: string): number {
  const rate = SGD_PER[currency.toUpperCase()];
  if (rate === undefined) throw new UnknownCurrencyError(`No SGD rate for ${currency}`);
  return Math.round(amount * rate * 100) / 100;
}
