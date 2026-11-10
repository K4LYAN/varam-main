const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatINR(value: number): string {
  return inr.format(roundMoney(value));
}

/** Round to whole paise to avoid floating point drift. */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** unit price × quantity, computed in paise for accuracy. */
export function lineTotal(unitPrice: number, quantity: number): number {
  return (Math.round(unitPrice * 100) * quantity) / 100;
}

export function sumMoney(values: number[]): number {
  return values.reduce((acc, v) => acc + Math.round(v * 100), 0) / 100;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function priceRange(prices: number[]): { min: number; max: number } | null {
  if (!prices.length) return null;
  return { min: Math.min(...prices), max: Math.max(...prices) };
}
