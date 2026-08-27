import type { WindSpeedUnit, PressureUnit } from '../models/config';

/**
 * The wind speed units a weather entity can actually report. Beaufort is
 * deliberately excluded here - it's never a source unit (HA has no
 * UnitOfSpeed value for it), only a display choice this card offers, so
 * `convertWindSpeed`'s `from` parameter is narrower than its `to`
 * parameter on purpose.
 */
export type SourceWindSpeedUnit = Exclude<WindSpeedUnit, 'Bft'>;

const KMH_PER_UNIT: Record<SourceWindSpeedUnit, number> = {
  'km/h': 1,
  'm/s': 3.6,
  'mph': 1.60934,
};

/**
 * Converts a wind speed value between units, including to the Beaufort
 * scale. Always returns a rounded whole number - matches every path
 * through the original conversion logic, which rounded regardless of
 * target unit (Beaufort is inherently a whole-number scale; km/h, m/s, and
 * mph were all explicitly Math.round()-ed).
 *
 * The three real-unit conversions use the original's exact direct pairwise
 * constants (0.44704, 1.60934, 3.6) rather than composing them through a
 * single pivot unit - those constants don't combine consistently with each
 * other (1.60934 / 3.6 is not quite 0.44704), and preserving the original's
 * exact numbers matters more here than a cleaner-looking implementation.
 * The Beaufort path *does* pivot through km/h, because that's how the
 * original calculateBeaufortScale() itself was written - not a change.
 */
export function convertWindSpeed(value: number, from: SourceWindSpeedUnit, to: WindSpeedUnit): number {
  if (to === 'Bft') {
    return beaufortScale(value * KMH_PER_UNIT[from]);
  }
  if (from === to) {
    return Math.round(value);
  }

  let converted: number;
  if (to === 'm/s') {
    converted = from === 'km/h' ? value / 3.6 : value * 0.44704; // from === 'mph'
  } else if (to === 'km/h') {
    converted = from === 'm/s' ? value * 3.6 : value * 1.60934; // from === 'mph'
  } else {
    // to === 'mph'
    converted = from === 'm/s' ? value / 0.44704 : value / 1.60934; // from === 'km/h'
  }
  return Math.round(converted);
}

/** Converts a km/h wind speed into its Beaufort scale number (0-12). */
export function beaufortScale(windSpeedKmh: number): number {
  if (windSpeedKmh < 1) return 0;
  if (windSpeedKmh < 6) return 1;
  if (windSpeedKmh < 12) return 2;
  if (windSpeedKmh < 20) return 3;
  if (windSpeedKmh < 29) return 4;
  if (windSpeedKmh < 39) return 5;
  if (windSpeedKmh < 50) return 6;
  if (windSpeedKmh < 62) return 7;
  if (windSpeedKmh < 75) return 8;
  if (windSpeedKmh < 89) return 9;
  if (windSpeedKmh < 103) return 10;
  if (windSpeedKmh < 118) return 11;
  return 12;
}

/**
 * Converts a pressure value between units, using the original's exact
 * direct pairwise constants (0.75006, 25.4, 33.8639) for the same reason as
 * wind speed above - no pivot, no composed/derived constants.
 *
 * hPa and mmHg targets round to a whole number; inHg rounds to 2 decimal
 * places, since inHg values are small enough (~29.92) that whole-number
 * rounding would lose the precision that actually matters for that unit.
 *
 * Two deliberate differences from the original, both flagged rather than
 * silently carried over:
 * - The original's inHg branch used `.toFixed(2)`, which returns a
 *   *string* - every other branch returned a number. Never caused a
 *   visible bug (interpolated into a template either way), but this
 *   function always returns a number, rounding inHg arithmetically instead.
 * - The original only rounded in the "same unit" case when the target was
 *   hPa or mmHg, leaving inHg unrounded (arbitrary float precision) when
 *   source and target already matched. This function rounds inHg to 2
 *   decimals unconditionally, for the same reason as above - consistent
 *   precision regardless of whether a conversion actually happened.
 */
export function convertPressure(value: number, from: PressureUnit, to: PressureUnit): number {
  let converted: number;
  if (from === to) {
    converted = value;
  } else if (to === 'mmHg') {
    converted = from === 'hPa' ? value * 0.75006 : value * 25.4; // from === 'inHg'
  } else if (to === 'hPa') {
    converted = from === 'mmHg' ? value / 0.75006 : value * 33.8639; // from === 'inHg'
  } else {
    // to === 'inHg'
    converted = from === 'mmHg' ? value / 25.4 : value / 33.8639; // from === 'hPa'
  }
  return to === 'inHg' ? Math.round(converted * 100) / 100 : Math.round(converted);
}
