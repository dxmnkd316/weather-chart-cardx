import { describe, it, expect } from 'vitest';
import { convertWindSpeed, beaufortScale, convertPressure } from '../../src/utils/units';

describe('convertWindSpeed', () => {
  it('returns the rounded input when the source and target unit match', () => {
    expect(convertWindSpeed(10.4, 'km/h', 'km/h')).toBe(10);
    expect(convertWindSpeed(10.6, 'mph', 'mph')).toBe(11);
  });

  it('converts km/h to m/s and mph using the original direct constants', () => {
    // 36 km/h -> 10 m/s exactly (36 / 3.6)
    expect(convertWindSpeed(36, 'km/h', 'm/s')).toBe(10);
    // 10 km/h -> 6.2137 mph, matching the original's 1.60934 constant
    expect(convertWindSpeed(10, 'km/h', 'mph')).toBe(Math.round(10 / 1.60934));
  });

  it('converts mph to m/s using the original direct 0.44704 constant, not a km/h-derived one', () => {
    // If this ever used a pivot through km/h (1.60934 / 3.6), the result
    // would very occasionally round differently than the original.
    expect(convertWindSpeed(1, 'mph', 'm/s')).toBe(Math.round(1 * 0.44704));
  });

  it('converts m/s to km/h and mph', () => {
    expect(convertWindSpeed(10, 'm/s', 'km/h')).toBe(36);
    expect(convertWindSpeed(10, 'm/s', 'mph')).toBe(Math.round(10 / 0.44704));
  });

  it('converts to Beaufort by pivoting through km/h, matching the original calculateBeaufortScale', () => {
    expect(convertWindSpeed(20, 'km/h', 'Bft')).toBe(beaufortScale(20));
    expect(convertWindSpeed(10, 'mph', 'Bft')).toBe(beaufortScale(10 * 1.60934));
  });
});

describe('beaufortScale', () => {
  // Verifies every threshold boundary explicitly - off-by-one errors at a
  // boundary are the classic way this kind of lookup silently breaks.
  const cases: [number, number][] = [
    [0, 0], [0.9, 0], [1, 1], [5.9, 1], [6, 2], [11.9, 2], [12, 3],
    [19.9, 3], [20, 4], [28.9, 4], [29, 5], [38.9, 5], [39, 6],
    [49.9, 6], [50, 7], [61.9, 7], [62, 8], [74.9, 8], [75, 9],
    [88.9, 9], [89, 10], [102.9, 10], [103, 11], [117.9, 11], [118, 12],
    [200, 12],
  ];

  it.each(cases)('treats %f km/h as Beaufort %i', (kmh, expected) => {
    expect(beaufortScale(kmh)).toBe(expected);
  });
});

describe('convertPressure', () => {
  it('returns the rounded/precise input when the source and target unit match', () => {
    expect(convertPressure(1013.7, 'hPa', 'hPa')).toBe(1014);
    expect(convertPressure(760.4, 'mmHg', 'mmHg')).toBe(760);
    // Unlike the original (which left same-unit inHg unrounded), this
    // always normalizes inHg to 2 decimal places - a deliberate difference.
    expect(convertPressure(29.9212345, 'inHg', 'inHg')).toBe(29.92);
  });

  it('converts hPa to mmHg and inHg using the original direct constants', () => {
    expect(convertPressure(1000, 'hPa', 'mmHg')).toBe(Math.round(1000 * 0.75006));
    expect(convertPressure(1000, 'hPa', 'inHg')).toBe(Math.round((1000 / 33.8639) * 100) / 100);
  });

  it('converts mmHg to hPa and inHg', () => {
    expect(convertPressure(760, 'mmHg', 'hPa')).toBe(Math.round(760 / 0.75006));
    expect(convertPressure(760, 'mmHg', 'inHg')).toBe(Math.round((760 / 25.4) * 100) / 100);
  });

  it('converts inHg to hPa and mmHg using the original direct constants, not a pivoted one', () => {
    // If this pivoted through hPa, 29.92 inHg -> mmHg would come out very
    // slightly different than multiplying directly by 25.4.
    expect(convertPressure(29.92, 'inHg', 'mmHg')).toBe(Math.round(29.92 * 25.4));
    expect(convertPressure(29.92, 'inHg', 'hPa')).toBe(Math.round(29.92 * 33.8639));
  });

  it('always returns a number, never a string, unlike the original inHg branch', () => {
    const result = convertPressure(1013.25, 'hPa', 'inHg');
    expect(typeof result).toBe('number');
  });
});
