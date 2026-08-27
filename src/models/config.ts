/**
 * The current-conditions attribute row (rendered above the forecast chart)
 * as a registry, per Spec.md §6, instead of a fixed set of `show_X` booleans
 * scattered through render logic. This step only adds the data - render
 * logic still branches on the individual `show_X` config fields until
 * main.ts converts and actually iterates this registry instead.
 *
 * `unit` names a category to resolve the displayed unit dynamically (e.g.
 * "speed" -> whichever of km/h, m/s, mph, Bft the card is currently
 * configured/converted to show), not a literal fixed unit string.
 */
export interface ForecastFieldDefinition {
  key: string;
  label: string;
  unit?: 'temperature' | 'pressure' | 'speed' | 'percentage' | 'distance';
  defaultVisible: boolean;
}

export const WEATHER_ATTRIBUTE_FIELDS: ForecastFieldDefinition[] = [
  { key: 'humidity', label: 'Humidity', unit: 'percentage', defaultVisible: true },
  { key: 'pressure', label: 'Pressure', unit: 'pressure', defaultVisible: true },
  { key: 'wind_direction', label: 'Wind Direction', defaultVisible: true },
  { key: 'wind_speed', label: 'Wind Speed', unit: 'speed', defaultVisible: true },
  { key: 'sun', label: 'Sun', defaultVisible: true },
  { key: 'uv_index', label: 'UV Index', defaultVisible: true },
  { key: 'feels_like', label: 'Feels Like', unit: 'temperature', defaultVisible: false },
  { key: 'dew_point', label: 'Dew Point', unit: 'temperature', defaultVisible: false },
  { key: 'wind_gust_speed', label: 'Wind Gust Speed', unit: 'speed', defaultVisible: false },
  { key: 'visibility', label: 'Visibility', unit: 'distance', defaultVisible: false },
];

/**
 * The card's own curated set of speed/pressure units - a deliberately
 * narrower type than "whatever HA reports" (WeatherEntityAttributes.
 * wind_speed_unit stays a plain string), since these are choices the editor
 * offers and calculateBeaufortScale()/the manual conversion logic actually
 * know how to handle.
 */
export type WindSpeedUnit = 'km/h' | 'm/s' | 'mph' | 'Bft';
export type PressureUnit = 'hPa' | 'mmHg' | 'inHg';

export interface UnitsConfig {
  speed?: WindSpeedUnit;
  pressure?: PressureUnit;
  visibility?: string;
}

/**
 * labels_font_size/chart_height/precip_bar_size/number_of_forecasts are all
 * genuinely numeric (a font size, a percentage, a height in pixels, a
 * count), typed that way here - but getStubConfig() in main.js currently
 * hands out some of these as string literals ('11', '100', '0') while
 * setConfig()'s own defaults use actual numbers for some of the same
 * fields. Never caused a visible bug (everything downstream goes through
 * parseInt()/string interpolation, which tolerates either), but it's a real
 * inconsistency this model surfaces rather than silently matches. Left as a
 * note for step 7 (main.ts conversion) rather than fixed now, since fixing
 * it means touching still-JS render logic, out of scope for a models-only
 * step.
 */
export interface ForecastConfig {
  type?: 'daily' | 'hourly';
  style?: 'style1' | 'style2';
  precipitation_type?: 'rainfall' | 'probability';
  show_probability?: boolean;
  show_wind_forecast?: boolean;
  condition_icons?: boolean;
  round_temp?: boolean;
  show_dew_point_forecast?: boolean;
  show_all_labels?: boolean;
  disable_animation?: boolean;
  labels_font_size?: number;
  chart_height?: number;
  precip_bar_size?: number;
  number_of_forecasts?: number;
  temperature1_color?: string;
  temperature2_color?: string;
  precipitation_color?: string;
  dewpoint_color?: string;
  chart_text_color?: string;
  chart_datetime_color?: string;
}

export interface WeatherChartCardConfig {
  entity: string;
  title?: string;
  locale?: string;
  icons?: string;
  icons_size?: number;
  animated_icons?: boolean;
  icon_style?: 'style1' | 'style2';
  current_temp_size?: number;
  time_size?: number;
  day_date_size?: number;
  autoscroll?: boolean;
  use_12hour_format?: boolean;

  show_main?: boolean;
  show_temperature?: boolean;
  show_current_condition?: boolean;
  show_attributes?: boolean;
  show_time?: boolean;
  show_time_seconds?: boolean;
  show_day?: boolean;
  show_date?: boolean;
  show_description?: boolean;
  show_last_changed?: boolean;

  show_humidity?: boolean;
  show_pressure?: boolean;
  show_wind_direction?: boolean;
  show_wind_speed?: boolean;
  show_sun?: boolean;
  show_feels_like?: boolean;
  show_dew_point?: boolean;
  show_wind_gust_speed?: boolean;
  show_visibility?: boolean;

  /** Legacy top-level alias for units.speed, merged into it in setConfig(). */
  speed?: WindSpeedUnit;

  /**
   * Alternate-sensor overrides: point a current-conditions field at a
   * specific entity instead of relying on the weather entity's own
   * attribute. Each is an entity id, not a value.
   */
  temp?: string;
  humid?: string;
  press?: string;
  uv?: string;
  windspeed?: string;
  winddir?: string;
  dew_point?: string;
  wind_gust_speed?: string;
  visibility?: string;
  feels_like?: string;
  description?: string;

  units?: UnitsConfig;
  forecast?: ForecastConfig;
}
