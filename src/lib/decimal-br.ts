/** Decimal input without thousands separators; empty input remains optional. */
export function isDecimalBRInput(value: string): boolean {
  return /^\d*[,.]?\d{0,2}$/.test(value);
}

/** Invalid nonempty input yields NaN so the saving schema rejects it. */
export function parseDecimalBR(value: string): number | null {
  if (value === "") return null;
  if (!isDecimalBRInput(value) || !/\d/.test(value)) return NaN;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : NaN;
}