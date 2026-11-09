/** CNPJ has 14 digits; anything beyond that is a typing mistake. */
const MAX_CNPJ_DIGITS = 14;

/** Digits only, capped at the 14 CNPJ positions. */
export function cnpjDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, MAX_CNPJ_DIGITS);
}

/**
 * Progressive mask: 12.345.678/9012-34.
 * Separators only appear while there are digits after them, so the field never
 * shows a dangling "." "/" or "-".
 */
export function formatCNPJ(value: string): string {
  const d = cnpjDigits(value);
  let out = d.slice(0, 2);
  if (d.length > 2) out += "." + d.slice(2, 5);
  if (d.length > 5) out += "." + d.slice(5, 8);
  if (d.length > 8) out += "/" + d.slice(8, 12);
  if (d.length > 12) out += "-" + d.slice(12, 14);
  return out;
}

/**
 * Mask a typed value against the value it replaced.
 * Backspacing over a separator would otherwise re-insert it immediately, so the
 * digit before it is dropped instead.
 */
export function maskCNPJ(next: string, previous = ""): string {
  let digits = cnpjDigits(next);
  const hadSameDigits = digits.length === cnpjDigits(previous).length;
  if (hadSameDigits && next.length < previous.length && digits.length > 0) {
    digits = digits.slice(0, -1);
  }
  return formatCNPJ(digits);
}

/** Caret position in the masked text, right after the nth digit. */
export function caretAfterDigits(masked: string, digitsBefore: number): number {
  if (digitsBefore <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < masked.length; i += 1) {
    if (/\d/.test(masked[i])) {
      seen += 1;
      if (seen === digitsBefore) return i + 1;
    }
  }
  return masked.length;
}
