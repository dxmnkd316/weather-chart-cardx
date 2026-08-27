import type { WeatherCondition } from '../const';
import type { Forecast } from './forecast';

/**
 * The two non-condition states any HA entity can report. Kept as their own
 * type (rather than folded into WeatherCondition) so code that reads
 * `weather.state` is forced to handle "the entity has no real reading right
 * now" separately from "here is an actual weather condition".
 */
export type EntityUnavailableState = 'unavailable' | 'unknown';

export interface WeatherEntityAttributes {
  temperature?: number;
  temperature_unit?: string;
  apparent_temperature?: number;
  dew_point?: number;
  humidity?: number;
  pressure?: number;
  pressure_unit?: string;
  wind_bearing?: number | string;
  wind_speed?: number;
  wind_speed_unit?: string;
  wind_gust_speed?: number;
  visibility?: number;
  visibility_unit?: string;
  precipitation_unit?: string;
  uv_index?: number;
  ozone?: number;
  cloud_coverage?: number;
  supported_features?: number;
  description?: string;
  /**
   * Weather entities can carry additional attributes beyond the ones this
   * card reads today (different integrations expose different extras).
   * `unknown` still forces a type check/narrowing before use, unlike `any`.
   */
  [key: string]: unknown;
}

export interface WeatherEntity {
  entity_id: string;
  state: WeatherCondition | EntityUnavailableState;
  attributes: WeatherEntityAttributes;
  last_changed: string;
}

export type ForecastType = 'daily' | 'hourly';

/** The outgoing "weather/subscribe_forecast" websocket command. */
export interface ForecastSubscriptionRequest {
  type: 'weather/subscribe_forecast';
  forecast_type: ForecastType;
  entity_id: string;
}

/** The event payload delivered to the subscription callback. */
export interface ForecastSubscriptionEvent {
  forecast: Forecast[];
}
