import type { WeatherCondition } from '../const';

/**
 * One forecast data point, as delivered by HA's "weather/subscribe_forecast"
 * websocket command after server-side unit conversion (confirmed against HA
 * core's WeatherEntity._convert_forecast during the Phase 1 audit).
 *
 * Every field except `datetime` is genuinely optional: which fields a given
 * integration populates varies, and - confirmed the hard way - hourly
 * forecasts routinely omit `templow` entirely, since an "overnight low"
 * isn't a meaningful per-hour value. Modeling everything as optional isn't
 * a hedge, it's what forced the array-index-misalignment bug to surface and
 * get fixed instead of silently reappearing here.
 */
export interface Forecast {
  datetime: string;
  condition?: WeatherCondition;
  temperature?: number;
  templow?: number;
  apparent_temperature?: number;
  dew_point?: number;
  humidity?: number;
  precipitation?: number;
  precipitation_probability?: number;
  pressure?: number;
  wind_bearing?: number | string;
  wind_gust_speed?: number;
  wind_speed?: number;
  uv_index?: number;
  is_daytime?: boolean;
  cloud_coverage?: number;
}

/**
 * The chart-ready shape produced by computeForecastData(): one parallel
 * array per series, always positionally aligned with `dateTime` (a `null`
 * entry means "no value for this point", not "array ends here" - see the
 * forecast array-alignment fix). `minHrs`/`maxHrs` list every index tied for
 * a day's temperature extreme (used for the hourly line-highlighting
 * feature); `dailyLowIndex`/`dailyHighIndex` list exactly one index per day
 * (used to gate the sparse-label display option) - the two pairs exist
 * separately on purpose, see the "one label per day" fix.
 */
export interface ComputedForecastData {
  forecast: Forecast[];
  dateTime: string[];
  tempHigh: number[];
  tempLow: (number | null)[];
  dewPoint: (number | null)[];
  precip: (number | undefined)[];
  minHrs: number[];
  maxHrs: number[];
  dailyLowIndex: number[];
  dailyHighIndex: number[];
}
