import { LitElement, html, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { HomeAssistant, LovelaceCardConfig, LovelaceCardEditor } from 'custom-card-helpers';
import type { WeatherChartCardConfig } from '../models/config';

/**
 * Minimal local typing for HA's `select` selector config, as consumed by
 * `<ha-selector>`. Not exported by custom-card-helpers (that package covers
 * the card/editor contract, not ha-selector's own config shapes), and only
 * used in this file, so kept local rather than promoted to `models/`.
 */
interface SelectSelectorOption {
  value: string;
  label: string;
}

interface SelectSelectorConfig {
  select: {
    mode: 'list' | 'dropdown' | 'box';
    options: SelectSelectorOption[];
  };
}

/** One field in an <ha-form> schema, as used by the "Alternate entities" page. */
interface AltEntitySchemaField {
  name: string;
  title: string;
  selector: { entity: { domain: string } };
}

/**
 * The shape actually read off `event.target` by the generic change
 * handlers below - not a real DOM element type (ha-switch/ha-checkbox/
 * ha-textfield/ha-select all differ), just the two properties this file
 * ever reads off whichever of them fired the event.
 */
interface ConfigFieldTarget {
  checked?: boolean;
  value?: string;
}

const FORECAST_TYPE_SELECTOR: SelectSelectorConfig = {
  select: {
    mode: 'list',
    options: [
      { value: 'daily', label: 'Daily forecast' },
      { value: 'hourly', label: 'Hourly forecast' },
    ],
  },
};

const CHART_STYLE_SELECTOR: SelectSelectorConfig = {
  select: {
    mode: 'list',
    options: [
      { value: 'style1', label: 'Chart style 1' },
      { value: 'style2', label: 'Chart style 2' },
    ],
  },
};

const ICON_STYLE_SELECTOR: SelectSelectorConfig = {
  select: {
    mode: 'list',
    options: [
      { value: 'style1', label: 'Style 1' },
      { value: 'style2', label: 'Style 2' },
    ],
  },
};

const ALT_SCHEMA: AltEntitySchemaField[] = [
  { name: 'temp', title: 'Alternative temperature sensor', selector: { entity: { domain: 'sensor' } } },
  { name: 'feels_like', title: 'Alternative feels like temperature sensor', selector: { entity: { domain: 'sensor' } } },
  { name: 'description', title: 'Alternative weather description sensor', selector: { entity: { domain: 'sensor' } } },
  { name: 'press', title: 'Alternative pressure sensor', selector: { entity: { domain: 'sensor' } } },
  { name: 'humid', title: 'Alternative humidity sensor', selector: { entity: { domain: 'sensor' } } },
  { name: 'uv', title: 'Alternative UV index sensor', selector: { entity: { domain: 'sensor' } } },
  { name: 'winddir', title: 'Alternative wind bearing sensor', selector: { entity: { domain: 'sensor' } } },
  { name: 'windspeed', title: 'Alternative wind speed sensor', selector: { entity: { domain: 'sensor' } } },
  { name: 'dew_point', title: 'Alternative dew pointsensor', selector: { entity: { domain: 'sensor' } } },
  { name: 'wind_gust_speed', title: 'Alternative wind gust speed sensor', selector: { entity: { domain: 'sensor' } } },
  { name: 'visibility', title: 'Alternative visibility sensor', selector: { entity: { domain: 'sensor' } } },
];

@customElement('weather-chart-card-editor')
export class WeatherChartCardEditor extends LitElement implements LovelaceCardEditor {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @state() private _config?: WeatherChartCardConfig;
  @state() private currentPage = 'card';
  @state() private entities: string[] = [];
  @state() private _entity = '';

  @state() private hasApparentTemperature = false;
  @state() private hasDewpoint = false;
  @state() private hasWindgustspeed = false;
  @state() private hasVisibility = false;
  @state() private hasDescription = false;

  constructor() {
    super();
    this._formValueChanged = this._formValueChanged.bind(this);
  }

  /**
   * `LovelaceCardEditor.setConfig` is typed against `LovelaceCardConfig`
   * (HA's deliberately loose `{ type: string; [key: string]: any }` shape,
   * since it has to accept every custom card's config). This card's own
   * config has a stricter shape (`entity` required, no `type`), so the two
   * don't satisfy each other structurally - the cast below is the narrow
   * boundary crossing, not a weakening of WeatherChartCardConfig itself.
   */
  public setConfig(config: LovelaceCardConfig): void {
    if (!config) {
      throw new Error('Invalid configuration');
    }
    const cardConfig = config as unknown as WeatherChartCardConfig;
    this._config = cardConfig;
    this._entity = cardConfig.entity || '';
    this.hasApparentTemperature = Boolean(
      (this.hass &&
        this.hass.states[cardConfig.entity]?.attributes &&
        this.hass.states[cardConfig.entity]?.attributes.apparent_temperature !== undefined) ||
      cardConfig.feels_like !== undefined
    );
    this.hasDewpoint = Boolean(
      (this.hass &&
        this.hass.states[cardConfig.entity]?.attributes &&
        this.hass.states[cardConfig.entity]?.attributes.dew_point !== undefined) ||
      cardConfig.dew_point !== undefined
    );
    this.hasWindgustspeed = Boolean(
      (this.hass &&
        this.hass.states[cardConfig.entity]?.attributes &&
        this.hass.states[cardConfig.entity]?.attributes.wind_gust_speed !== undefined) ||
      cardConfig.wind_gust_speed !== undefined
    );
    this.hasVisibility = Boolean(
      (this.hass &&
        this.hass.states[cardConfig.entity]?.attributes &&
        this.hass.states[cardConfig.entity]?.attributes.visibility !== undefined) ||
      cardConfig.visibility !== undefined
    );
    this.hasDescription = Boolean(
      (this.hass &&
        this.hass.states[cardConfig.entity]?.attributes &&
        this.hass.states[cardConfig.entity]?.attributes.description !== undefined) ||
      cardConfig.description !== undefined
    );
    this.fetchEntities();
    this.requestUpdate();
  }

  public get config(): WeatherChartCardConfig | undefined {
    return this._config;
  }

  protected updated(changedProperties: PropertyValues): void {
    if (changedProperties.has('hass')) {
      this.fetchEntities();
    }
    if (changedProperties.has('_config') && this._config && this._config.entity) {
      this._entity = this._config.entity;
    }
  }

  private fetchEntities(): void {
    if (this.hass) {
      this.entities = Object.keys(this.hass.states).filter((e) => e.startsWith('weather.'));
      this.requestUpdate();
    }
  }

  private _EntityChanged(event: Event): void {
    if (!this._config) {
      return;
    }
    const target = event.target as ConfigFieldTarget;
    const newConfig = { ...this._config };
    newConfig.entity = target.value ?? '';
    this._entity = target.value ?? '';
    this.configChanged(newConfig);
  }

  private configChanged(newConfig: WeatherChartCardConfig): void {
    const event = new CustomEvent('config-changed', {
      bubbles: true,
      composed: true,
      detail: { config: newConfig },
    });
    this.dispatchEvent(event);
  }

  /**
   * Handles most switches/checkboxes/textfields via a dynamic dot-path key
   * (e.g. 'show_humidity', 'forecast.round_temp', 'units.speed'). This is
   * inherently a runtime-reflection-style operation - genuinely incompatible
   * with WeatherChartCardConfig's closed interface without either a large,
   * separate rewrite into one handler per field, or the narrow, explicitly
   * scoped `as Record<string, unknown>` cast below. Went with the latter for
   * this step; the per-field rewrite is a real, separate future cleanup, not
   * a shortcut being taken here - see PR description.
   */
  private _valueChanged(event: Event, key: string): void {
    if (!this._config) {
      return;
    }

    const newConfig = { ...this._config } as unknown as Record<string, unknown>;
    const target = event.target as ConfigFieldTarget;
    const newValue = target.checked !== undefined ? target.checked : target.value;

    if (key.includes('.')) {
      const parts = key.split('.');
      let currentLevel = newConfig;

      for (let i = 0; i < parts.length - 1; i++) {
        // `noUncheckedIndexedAccess` types `parts[i]` as `string | undefined`;
        // the loop bound guarantees it's always in range here.
        const part = parts[i] as string;
        currentLevel[part] = { ...(currentLevel[part] as Record<string, unknown>) };
        currentLevel = currentLevel[part] as Record<string, unknown>;
      }

      const finalKey = parts[parts.length - 1] as string;
      currentLevel[finalKey] = newValue;
    } else {
      newConfig[key] = newValue;
    }

    this.configChanged(newConfig as unknown as WeatherChartCardConfig);
    this.requestUpdate();
  }

  private _handleStyleChange(event: CustomEvent<{ value: string }>): void {
    if (!this._config) {
      return;
    }
    const newConfig: WeatherChartCardConfig = JSON.parse(JSON.stringify(this._config));
    newConfig.forecast = { ...newConfig.forecast, style: event.detail.value as 'style1' | 'style2' };
    this.configChanged(newConfig);
    this.requestUpdate();
  }

  private _handleTypeChange(event: CustomEvent<{ value: string }>): void {
    if (!this._config) {
      return;
    }
    const newConfig: WeatherChartCardConfig = JSON.parse(JSON.stringify(this._config));
    newConfig.forecast = { ...newConfig.forecast, type: event.detail.value as 'daily' | 'hourly' };
    this.configChanged(newConfig);
    this.requestUpdate();
  }

  private _handleIconStyleChange(event: CustomEvent<{ value: string }>): void {
    if (!this._config) {
      return;
    }
    const newConfig: WeatherChartCardConfig = JSON.parse(JSON.stringify(this._config));
    newConfig.icon_style = event.detail.value as 'style1' | 'style2';
    this.configChanged(newConfig);
    this.requestUpdate();
  }

  private _formValueChanged(event: CustomEvent<{ value: WeatherChartCardConfig }>): void {
    const target = event.target as HTMLElement;
    if (target.tagName.toLowerCase() === 'ha-form') {
      const newConfig = event.detail.value;
      this.configChanged(newConfig);
      this.requestUpdate();
    }
  }

  private showPage(pageName: string): void {
    this.currentPage = pageName;
    this.requestUpdate();
  }

  protected render(): TemplateResult {
    if (!this._config) {
      return html``;
    }
    if (this._config.entity !== this._entity) {
      this._entity = this._config.entity;
    }
    const forecastConfig = this._config.forecast || {};
    const unitsConfig = this._config.units || {};

    return html`
      <style>
        .switch-label {
          padding-left: 14px;
        }
        .switch-container {
          margin-bottom: 12px;
        }
        .page-container {
	  display: none;
        }
        .page-container.active {
          display: block;
        }
        .time-container {
          display: flex;
          flex-direction: row;
          margin-bottom: 12px;
        }
        .icon-container {
          display: flex;
          flex-direction: row;
          margin-bottom: 12px;
        }
        .switch-right {
          display: flex;
          flex-direction: row;
          align-items: center;
        }
        .checkbox-container {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .textfield-container {
          display: flex;
          flex-direction: column;
          margin-bottom: 10px;
	  gap: 20px;
        }
        .radio-container {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .radio-group {
          display: flex;
          align-items: center;
        }
        .radio-group label {
          margin-left: 4px;
        }
	div.buttons-container {
          border-bottom: 2px solid #ccc;
          padding-bottom: 10px;
          margin-bottom: 20px;
        }
        .flex-container {
          display: flex;
          flex-direction: row;
          gap: 20px;
        }
        .flex-container ha-textfield {
          flex-basis: 50%;
          flex-grow: 1;
        }
      </style>
      <div>
      <div class="textfield-container">
<ha-select
  naturalMenuWidth
  fixedMenuPosition
  label="Entity"
  .configValue=${'entity'}
  .value=${this._entity}
  @change=${(e: Event) => this._EntityChanged(e)}
  @closed=${(ev: Event) => ev.stopPropagation()}
>
  ${this.entities.map((entity) => html`<ha-list-item .value=${entity}>${entity}</ha-list-item>`)}
</ha-select>
      <ha-textfield
        label="Title"
        .value="${this._config.title || ''}"
        @change="${(e: Event) => this._valueChanged(e, 'title')}"
      ></ha-textfield>
       </div>

      <h5>Forecast type:</h5>

      <ha-selector
        .hass="${this.hass}"
        .selector="${FORECAST_TYPE_SELECTOR}"
        .value="${forecastConfig.type}"
        @value-changed="${(e: CustomEvent<{ value: string }>) => this._handleTypeChange(e)}"
      ></ha-selector>

      <h5>Chart style:</h5>
      <ha-selector
        .hass="${this.hass}"
        .selector="${CHART_STYLE_SELECTOR}"
        .value="${forecastConfig.style}"
        @value-changed="${(e: CustomEvent<{ value: string }>) => this._handleStyleChange(e)}"
      ></ha-selector>

        <!-- Buttons to switch between pages -->
       <h4>Settings:</h4>
       <div class="buttons-container">
         <ha-button @click="${() => this.showPage('card')}">Main</ha-button>
         <ha-button @click="${() => this.showPage('forecast')}">Forecast</ha-button>
         <ha-button @click="${() => this.showPage('units')}">Units</ha-button>
         <ha-button @click="${() => this.showPage('alternate')}">Alternate entities</ha-button>
       </div>

        <!-- Card Settings Page -->
        <div class="page-container ${this.currentPage === 'card' ? 'active' : ''}">
          <div class="switch-container">
            <ha-switch
              @change="${(e: Event) => this._valueChanged(e, 'show_main')}"
              .checked="${this._config.show_main !== false}"
            ></ha-switch>
            <label class="switch-label">
              Show Main
            </label>
          </div>
      <div class="switch-container">
        ${this.hasApparentTemperature ? html`
          <ha-switch
            @change="${(e: Event) => this._valueChanged(e, 'show_feels_like')}"
            .checked="${this._config.show_feels_like !== false}"
          ></ha-switch>
          <label class="switch-label">
            Show Feels Like Temperature
          </label>
        ` : ''}
      </div>
      <div class="switch-container">
        ${this.hasDescription ? html`
          <ha-switch
            @change="${(e: Event) => this._valueChanged(e, 'show_description')}"
            .checked="${this._config.show_description !== false}"
          ></ha-switch>
          <label class="switch-label">
            Show Weather Description
          </label>
        ` : ''}
      </div>
          <div class="switch-container">
            <ha-switch
              @change="${(e: Event) => this._valueChanged(e, 'show_temperature')}"
              .checked="${this._config.show_temperature !== false}"
            ></ha-switch>
            <label class="switch-label">
              Show Current Temperature
            </label>
          </div>
          <div class="switch-container">
            <ha-switch
              @change="${(e: Event) => this._valueChanged(e, 'show_current_condition')}"
              .checked="${this._config.show_current_condition !== false}"
            ></ha-switch>
            <label class="switch-label">
              Show Current Weather Condition
            </label>
          </div>
          <div class="switch-container">
            <ha-switch
              @change="${(e: Event) => this._valueChanged(e, 'show_attributes')}"
              .checked="${this._config.show_attributes !== false}"
            ></ha-switch>
            <label class="switch-label">
              Show Attributes
            </label>
          </div>
          <div class="switch-container">
            <ha-switch
              @change="${(e: Event) => this._valueChanged(e, 'show_humidity')}"
              .checked="${this._config.show_humidity !== false}"
            ></ha-switch>
            <label class="switch-label">
              Show Humidity
            </label>
          </div>
          <div class="switch-container">
            <ha-switch
              @change="${(e: Event) => this._valueChanged(e, 'show_pressure')}"
              .checked="${this._config.show_pressure !== false}"
            ></ha-switch>
            <label class="switch-label">
              Show Pressure
            </label>
          </div>
          <div class="switch-container">
            <ha-switch
              @change="${(e: Event) => this._valueChanged(e, 'show_sun')}"
              .checked="${this._config.show_sun !== false}"
            ></ha-switch>
            <label class="switch-label">
              Show Sun
            </label>
          </div>
          <div class="switch-container">
            <ha-switch
              @change="${(e: Event) => this._valueChanged(e, 'show_wind_direction')}"
              .checked="${this._config.show_wind_direction !== false}"
            ></ha-switch>
            <label class="switch-label">
              Show Wind Direction
            </label>
          </div>
          <div class="switch-container">
            <ha-switch
              @change="${(e: Event) => this._valueChanged(e, 'show_wind_speed')}"
              .checked="${this._config.show_wind_speed !== false}"
            ></ha-switch>
            <label class="switch-label">
              Show Wind Speed
            </label>
	  </div>
      <div class="switch-container">
        ${this.hasDewpoint ? html`
          <ha-switch
            @change="${(e: Event) => this._valueChanged(e, 'show_dew_point')}"
            .checked="${this._config.show_dew_point !== false}"
          ></ha-switch>
          <label class="switch-label">
            Show Dew Point
          </label>
        ` : ''}
      </div>
      <div class="switch-container">
        ${this.hasWindgustspeed ? html`
          <ha-switch
            @change="${(e: Event) => this._valueChanged(e, 'show_wind_gust_speed')}"
            .checked="${this._config.show_wind_gust_speed !== false}"
          ></ha-switch>
          <label class="switch-label">
            Show Wind Gust Speed
          </label>
        ` : ''}
      </div>
      <div class="switch-container">
        ${this.hasVisibility ? html`
          <ha-switch
            @change="${(e: Event) => this._valueChanged(e, 'show_visibility')}"
            .checked="${this._config.show_visibility !== false}"
          ></ha-switch>
          <label class="switch-label">
            Show Visibility
          </label>
        ` : ''}
      </div>
          <div class="switch-container">
            <ha-switch
              @change="${(e: Event) => this._valueChanged(e, 'show_last_changed')}"
              .checked="${this._config.show_last_changed !== false}"
            ></ha-switch>
            <label class="switch-label">
              Show when last data changed
            </label>
          </div>
          <div class="switch-container">
            <ha-switch
              @change="${(e: Event) => this._valueChanged(e, 'use_12hour_format')}"
              .checked="${this._config.use_12hour_format !== false}"
            ></ha-switch>
            <label class="switch-label">
              Use 12-Hour Format
            </label>
          </div>
          <div class="switch-container">
            <ha-switch
              @change="${(e: Event) => this._valueChanged(e, 'autoscroll')}"
              .checked="${this._config.autoscroll !== false}"
            ></ha-switch>
            <label class="switch-label">
              Autoscroll
            </label>
          </div>
          <div class="time-container">
            <div class="switch-right">
              <ha-switch
                @change="${(e: Event) => this._valueChanged(e, 'show_time')}"
                .checked="${this._config.show_time !== false}"
              ></ha-switch>
              <label class="switch-label">
                Show Current Time
              </label>
            </div>
            <div class="switch-right checkbox-container" style="${this._config.show_time ? 'display: flex;' : 'display: none;'}">
              <ha-checkbox
                @change="${(e: Event) => this._valueChanged(e, 'show_time_seconds')}"
                .checked="${this._config.show_time_seconds !== false}"
              ></ha-checkbox>
              <label class="check-label">
                Show Seconds
              </label>
            </div>
            <div class="switch-right checkbox-container" style="${this._config.show_time ? 'display: flex;' : 'display: none;'}">
              <ha-checkbox
                @change="${(e: Event) => this._valueChanged(e, 'show_day')}"
                .checked="${this._config.show_day !== false}"
              ></ha-checkbox>
              <label class="check-label">
                Show Day
              </label>
            </div>
            <div class="switch-right checkbox-container" style="${this._config.show_time ? 'display: flex;' : 'display: none;'}">
              <ha-checkbox
                @change="${(e: Event) => this._valueChanged(e, 'show_date')}"
                .checked="${this._config.show_date !== false}"
              ></ha-checkbox>
              <label class="check-label">
                Show Date
              </label>
            </div>
          </div>
            <div class="flex-container" style="${this._config.show_time ? 'display: flex;' : 'display: none;'}">
              <ha-textfield
                label="Time text size"
                type="number"
                .value="${this._config.time_size || '26'}"
                @change="${(e: Event) => this._valueChanged(e, 'time_size')}"
              ></ha-textfield>
              <ha-textfield
                label="Day and date text size"
                type="number"
                .value="${this._config.day_date_size || '15'}"
                @change="${(e: Event) => this._valueChanged(e, 'day_date_size')}"
              ></ha-textfield>
              </div>
            <div class="icon-container">
              <div class="switch-right">
                <ha-switch
                  @change="${(e: Event) => this._valueChanged(e, 'animated_icons')}"
                  .checked="${this._config.animated_icons === true}"
                ></ha-switch>
                <label class="switch-label">
                  Use Animated Icons
                </label>
              </div>
              <div class="switch-right radio-container" style="${this._config.animated_icons ? 'display: flex;' : 'display: none;'}">
                <ha-selector
                  .hass="${this.hass}"
                  .selector="${ICON_STYLE_SELECTOR}"
                  .value="${this._config.icon_style}"
                  @value-changed="${(e: CustomEvent<{ value: string }>) => this._handleIconStyleChange(e)}"
                ></ha-selector>
              </div>
              </div>
       <div class="textfield-container">
         <ha-textfield
           label="Icon Size for animated or custom icons"
           type="number"
           .value="${this._config.icons_size || '25'}"
           @change="${(e: Event) => this._valueChanged(e, 'icons_size')}"
         ></ha-textfield>
          <ha-textfield
            label="Curent temperature Font Size"
           type="number"
            .value="${this._config.current_temp_size || '28'}"
            @change="${(e: Event) => this._valueChanged(e, 'current_temp_size')}"
          ></ha-textfield>
        <ha-textfield
          label="Custom icon path"
          .value="${this._config.icons || ''}"
          @change="${(e: Event) => this._valueChanged(e, 'icons')}"
        ></ha-textfield>
         <ha-select
           naturalMenuWidth
           fixedMenuPosition
           label="Select custom language"
           .configValue=${''}
           .value=${this._config.locale}
           @change=${(e: Event) => this._valueChanged(e, 'locale')}
           @closed=${(ev: Event) => ev.stopPropagation()}
         >
           <ha-list-item .value=${''}>HA Default</ha-list-item>
           <ha-list-item .value=${'bg'}>Bulgarian</ha-list-item>
           <ha-list-item .value=${'ca'}>Catalan</ha-list-item>
           <ha-list-item .value=${'cs'}>Czech</ha-list-item>
           <ha-list-item .value=${'da'}>Danish</ha-list-item>
           <ha-list-item .value=${'nl'}>Dutch</ha-list-item>
           <ha-list-item .value=${'en'}>English</ha-list-item>
           <ha-list-item .value=${'fi'}>Finnish</ha-list-item>
           <ha-list-item .value=${'fr'}>French</ha-list-item>
           <ha-list-item .value=${'de'}>German</ha-list-item>
           <ha-list-item .value=${'el'}>Greek</ha-list-item>
           <ha-list-item .value=${'hu'}>Hungarian</ha-list-item>
           <ha-list-item .value=${'it'}>Italian</ha-list-item>
           <ha-list-item .value=${'lt'}>Lithuanian</ha-list-item>
           <ha-list-item .value=${'no'}>Norwegian</ha-list-item>
           <ha-list-item .value=${'pl'}>Polish</ha-list-item>
           <ha-list-item .value=${'pt'}>Portuguese</ha-list-item>
           <ha-list-item .value=${'ro'}>Romanian</ha-list-item>
           <ha-list-item .value=${'ru'}>Russian</ha-list-item>
           <ha-list-item .value=${'sk'}>Slovak</ha-list-item>
           <ha-list-item .value=${'es'}>Spanish</ha-list-item>
           <ha-list-item .value=${'sv'}>Swedish</ha-list-item>
	   <ha-list-item .value=${'uk'}>Ukrainian</ha-list-item>
    	   <ha-list-item .value=${'ko'}>한국어</ha-list-item>
        </ha-select>
        </div>
      </div>

        <!-- Forecast Settings Page -->
        <div class="page-container ${this.currentPage === 'forecast' ? 'active' : ''}">
          <div class="switch-container">
            <ha-switch
              @change="${(e: Event) => this._valueChanged(e, 'forecast.condition_icons')}"
              .checked="${forecastConfig.condition_icons !== false}"
            ></ha-switch>
            <label class="switch-label">
              Show Condition Icons
            </label>
          </div>
          <div class="switch-container">
            <ha-switch
              @change="${(e: Event) => this._valueChanged(e, 'forecast.show_wind_forecast')}"
              .checked="${forecastConfig.show_wind_forecast !== false}"
            ></ha-switch>
            <label class="switch-label">
              Show Wind Forecast
            </label>
          </div>
          <div class="switch-container">
            <ha-switch
              @change="${(e: Event) => this._valueChanged(e, 'forecast.show_dew_point_forecast')}"
              .checked="${forecastConfig.show_dew_point_forecast !== false}"
            ></ha-switch>
            <label class="switch-label">
              Show Dew Point Forecast
            </label>
          </div>
          <div class="switch-container">
            <ha-switch
              @change="${(e: Event) => this._valueChanged(e, 'forecast.show_all_labels')}"
              .checked="${forecastConfig.show_all_labels !== false}"
            ></ha-switch>
            <label class="switch-label">
              Show Temperature Label On Every Point
            </label>
          </div>
          <div class="switch-container">
            <ha-switch
              @change="${(e: Event) => this._valueChanged(e, 'forecast.round_temp')}"
              .checked="${forecastConfig.round_temp !== false}"
            ></ha-switch>
            <label class="switch-label">
              Rounding Temperatures
            </label>
          </div>
          <div class="switch-container">
            <ha-switch
              @change="${(e: Event) => this._valueChanged(e, 'forecast.disable_animation')}"
              .checked="${forecastConfig.disable_animation !== false}"
            ></ha-switch>
            <label class="switch-label">
              Disable Chart Animation
            </label>
          </div>
	  <div class="textfield-container">
          <ha-select
            naturalMenuWidth
            fixedMenuPosition
            label="Precipitation Type (Probability if supported by the weather entity)"
            .configValue=${'forecast.precipitation_type'}
            .value=${forecastConfig.precipitation_type}
            @change=${(e: Event) => this._valueChanged(e, 'forecast.precipitation_type')}
            @closed=${(ev: Event) => ev.stopPropagation()}
          >
            <ha-list-item .value=${'rainfall'}>Rainfall</ha-list-item>
            <ha-list-item .value=${'probability'}>Probability</ha-list-item>
          </ha-select>
         <div class="switch-container" ?hidden=${forecastConfig.precipitation_type !== 'rainfall'}>
             <ha-switch
               @change="${(e: Event) => this._valueChanged(e, 'forecast.show_probability')}"
               .checked="${forecastConfig.show_probability !== false}"
             ></ha-switch>
             <label class="switch-label">
               Show precipitation probability
             </label>
         </div>
          <div class="textfield-container">
            <div class="flex-container">
              <ha-textfield
                label="Precipitation Bar Size %"
                type="number"
                max="100"
                min="0"
                .value="${forecastConfig.precip_bar_size || '100'}"
                @change="${(e: Event) => this._valueChanged(e, 'forecast.precip_bar_size')}"
              ></ha-textfield>
              <ha-textfield
                label="Labels Font Size"
                type="number"
                .value="${forecastConfig.labels_font_size || '11'}"
                @change="${(e: Event) => this._valueChanged(e, 'forecast.labels_font_size')}"
              ></ha-textfield>
              </div>
	    <div class="flex-container">
              <ha-textfield
                label="Chart height"
                type="number"
                .value="${forecastConfig.chart_height || '180'}"
                @change="${(e: Event) => this._valueChanged(e, 'forecast.chart_height')}"
              ></ha-textfield>
              <ha-textfield
                label="Number of forecasts"
                type="number"
                .value="${forecastConfig.number_of_forecasts || '0'}"
                @change="${(e: Event) => this._valueChanged(e, 'forecast.number_of_forecasts')}"
              ></ha-textfield>
              </div>
            </div>
          </div>
        </div>

        <!-- Units Page -->
        <div class="page-container ${this.currentPage === 'units' ? 'active' : ''}">
          <div class="textfield-container">
            <ha-select
              naturalMenuWidth
              fixedMenuPosition
              label="Convert pressure to"
              .configValue=${'units.pressure'}
              .value=${unitsConfig.pressure}
              @change=${(e: Event) => this._valueChanged(e, 'units.pressure')}
              @closed=${(ev: Event) => ev.stopPropagation()}
            >
              <ha-list-item .value=${'hPa'}>hPa</ha-list-item>
              <ha-list-item .value=${'mmHg'}>mmHg</ha-list-item>
              <ha-list-item .value=${'inHg'}>inHg</ha-list-item>
            </ha-select>
            <ha-select
              naturalMenuWidth
              fixedMenuPosition
              label="Convert wind speed to"
              .configValue=${'units.speed'}
              .value=${unitsConfig.speed}
              @change=${(e: Event) => this._valueChanged(e, 'units.speed')}
              @closed=${(ev: Event) => ev.stopPropagation()}
            >
              <ha-list-item .value=${'km/h'}>km/h</ha-list-item>
              <ha-list-item .value=${'m/s'}>m/s</ha-list-item>
              <ha-list-item .value=${'Bft'}>Bft</ha-list-item>
              <ha-list-item .value=${'mph'}>mph</ha-list-item>
            </ha-select>
          </div>
        </div>

        <!-- Alternate Page -->
        <div class="page-container ${this.currentPage === 'alternate' ? 'active' : ''}">
          <h5>Alternative sensors for the main card attributes:</h5>
          <ha-form
            .data=${this._config}
            .schema=${ALT_SCHEMA}
            .hass=${this.hass}
            @value-changed=${this._formValueChanged}
          ></ha-form>
        </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'weather-chart-card-editor': WeatherChartCardEditor;
  }
}
