import Decimal from "decimal.js";

/**
 * Duration Units are a frozen enumeration. Canonical storage for every
 * Duration Variable value is seconds as a canonical decimal string; the
 * declared Duration Unit only decides how Reader entries and presentations
 * convert to and from that canonical form. Conversions are exact decimal
 * multiplications, never floating point (see ADR 0014).
 */
export const DURATION_UNITS = ["second", "minute", "hour", "day"] as const;

export type DurationUnit = (typeof DURATION_UNITS)[number];

/**
 * Duration Unit symbols are language-independent; surrounding prose is
 * bilingual and lives in the locale dictionaries.
 */
export const DURATION_UNIT_SYMBOLS: Record<DurationUnit, string> = {
  second: "s",
  minute: "min",
  hour: "h",
  day: "d",
};

const DurationDecimal = Decimal.clone({
  precision: 120,
  rounding: Decimal.ROUND_HALF_EVEN,
  toExpNeg: -1_000_000_000,
  toExpPos: 1_000_000_000,
});

export function isDurationUnit(value: string): value is DurationUnit {
  return (DURATION_UNITS as readonly string[]).includes(value);
}

/**
 * Exact seconds per Duration Unit as canonical decimal strings. The ratio is
 * exported so the formula engine can convert between declared units and
 * canonical seconds with its own Decimal clone without mixing clones.
 */
export function durationUnitSecondsRatio(unit: DurationUnit): string {
  switch (unit) {
    case "second":
      return "1";
    case "minute":
      return "60";
    case "hour":
      return "3600";
    case "day":
      return "86400";
  }
}

function durationUnitSeconds(unit: DurationUnit): Decimal {
  return new DurationDecimal(durationUnitSecondsRatio(unit));
}

function canonicalDurationDecimal(decimal: Decimal): string {
  if (!decimal.isFinite()) {
    throw new Error("Duration values must be finite decimals");
  }
  return decimal.isZero() ? "0" : decimal.toFixed();
}

/**
 * Converts an entry expressed in the declared Duration Unit into canonical
 * seconds. Throws when the entry is not a finite decimal or the unit is
 * unknown, so callers never persist a non-canonical value.
 */
export function durationEntryToSeconds(
  entry: string,
  unit: DurationUnit,
): string {
  const decimal = new DurationDecimal(entry);
  if (!decimal.isFinite()) {
    throw new Error("Duration entries must be finite decimals");
  }
  return canonicalDurationDecimal(decimal.times(durationUnitSeconds(unit)));
}

/**
 * Converts canonical seconds back into the declared Duration Unit for
 * presentation. Throws when the seconds value is not a finite decimal.
 */
export function durationSecondsToUnit(
  seconds: string,
  unit: DurationUnit,
): string {
  const decimal = new DurationDecimal(seconds);
  if (!decimal.isFinite()) {
    throw new Error("Duration values must be finite decimals");
  }
  return canonicalDurationDecimal(decimal.dividedBy(durationUnitSeconds(unit)));
}

/**
 * The single display formatter for Duration Variable values: renders
 * canonical seconds as a plain decimal in the declared Duration Unit
 * followed by its language-independent symbol, e.g. `1.5 h` or `90 min`.
 * Reader step-text interpolation, the Author Preview, and the Completion
 * Summary all render through this function, so no surface can invent its
 * own rendering and a displayed value always equals the stored value
 * converted exactly (no rounding beyond the exact decimal conversion, no
 * exponent notation). Deterministic for every representable value.
 */
export function formatDurationValue(
  seconds: string,
  unit: DurationUnit,
): string {
  return `${durationSecondsToUnit(seconds, unit)} ${DURATION_UNIT_SYMBOLS[unit]}`;
}

/**
 * The language-independent symbol for a Duration Unit (for example `min`),
 * or the raw string when the unit is not a valid Duration Unit. This is the
 * unit-label counterpart of `formatDurationValue`: every surface that shows
 * a declared Duration Unit beside an entry or a value renders through this
 * helper instead of re-deriving the symbol locally.
 */
export function durationSymbol(unit: string): string {
  return isDurationUnit(unit) ? DURATION_UNIT_SYMBOLS[unit] : unit;
}
