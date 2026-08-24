# Phase 1 Audit

Audit pass per CLAUDE.md's First Task (step 3) and Spec.md §7, originally done
against the `recovery/reconcile-live-edits` branch (PR #28) once that was the
actual starting point per CLAUDE.md, superseding stale `master`. Started as a
log-first, fix-later document; every item identified has since been fixed and
verified live (see "Status: Phase 1 fix list complete" below) and this file is
kept as the record of what was found, why, and how it was actually resolved —
several findings here turned out different from the initial diagnosis once
tested live, which is exactly why that record has value.

Confidence is marked per item:
- **CONFIRMED** — verified against current HA core source/docs, or a reproducible logic error in the code itself.
- **SUSPECTED** — plausible root cause identified from code, but needs a live HA 2026.6 instance to confirm.
- **INFO** — not a bug; a deviation from upstream or a design note worth recording.

---

## Headline finding: forecast array index misalignment (style1 chart)

**Status: CONFIRMED — reproducible from code alone.**

Found while investigating a live report: on style1, the overnight-low temperature
line doesn't render correctly, and the tooltip near where it should be shows
precipitation-shaped data (inches, probability %) instead. Root cause is in
`computeForecastData()`:

```js
dateTime.push(d.datetime);
tempHigh.push(d.temperature);
if (showDewpointForecast && typeof d.dew_point !== 'undefined') {
  dewPoint.push(d.dew_point);
}
if (typeof d.templow !== 'undefined') {
  tempLow.push(d.templow);
}
```

`dateTime`, `tempHigh`, and `precip` are pushed unconditionally, once per forecast
item — they stay in lockstep with the chart's shared x-axis labels. `tempLow` and
`dewPoint` are pushed **only when that field is present on the forecast item**.
Chart.js maps a dataset's `data` array to the labels array purely by array
position, with no concept of "this point belongs to index 7" — so the moment any
single forecast item lacks `templow` (very plausible for hourly forecasts, where
"overnight low" isn't a meaningful per-hour value — daily forecasts populate it
far more reliably), the `tempLow` array becomes shorter than the others and every
point after the gap silently shifts left onto the wrong time slot. If *no* hourly
item has `templow`, the array is empty and the line doesn't render at all — matching
"I don't see an actual overnight temperature line," and matching that it's absent
in `weather-chart-cardx2.js` too (this bug predates the reconciliation; it's not
something introduced here). `dewPoint` (added in this recovery) inherits the exact
same flaw.

A second instance of the same underlying mistake, in the same function:
```js
if (roundTemp) {
  tempHigh[i] = Math.round(tempHigh[i]);
  ...
```
This indexes `tempHigh` by the raw loop counter `i` (position in the *unfiltered*
`forecast` array), not by the array's own current length. The moment
`config.autoscroll` causes any earlier item to `continue` (skipped, not pushed),
`i` and `tempHigh.length` diverge, and this either rounds the wrong entry or writes
a new element past the end of the array (creating a sparse hole).

**Fix direction (not applied here):** push a placeholder (`null`, which Chart.js
treats as a real gap in a line — semantically correct here) instead of skipping the
push, for both `tempLow` and `dewPoint`, so every array stays positionally aligned
with `dateTime` regardless of which fields are present per item. Fix the
`roundTemp` block to index by the array's actual current length instead of the
raw loop counter.

**Still open / needs live confirmation:** whether the reported "precip shows °F as
its unit" is *fully* explained by this (a tooltip landing on the precip bar
because there's no temp-low point to intersect with there), or whether Chart.js's
default tooltip interaction mode is also contributing by stacking multiple
datasets' lines into one tooltip box for this mixed bar/line chart — no
`interaction`/`tooltip.mode` override exists anywhere in the chart config, so
whatever Chart.js 4.4.1's default resolves to for a mixed-type chart is what's
running. Not conclusively separable from static review.

## Also found this round

- **`'precip': 'Precipitations'`** in the English locale table (`src/locale.js`)
  — should read "Precipitation" (singular). Grammar-only, logged rather than
  fixed here per the "don't fix opportunistically" rule, but trivial whenever
  this list gets worked.

---

## Spec §7 Known Issues

### 1. Sensor-based forecast data

**Status: not an issue — the forecast list itself is already correct.** (CONFIRMED)

Verified against current HA core (`homeassistant/components/weather/__init__.py`,
`dev` branch): the card subscribes to forecast data via the `weather/subscribe_forecast`
websocket command (`src/main.js` `subscribeForecastEvents()`), which is the current,
correct mechanism — not a `sensor` entity. This was already true in both `master`
and the `testlive`/live-edited lineage before this recovery; nothing to fix.

What *does* use optional sensor entities are the per-field **current-condition**
overrides (`config.temp`, `config.humid`, `config.press`, `config.uv`,
`config.windspeed`, `config.winddir`, `config.dew_point`, `config.wind_gust_speed`,
`config.visibility`, `config.feels_like`, `config.description`) — each falls back to
the weather entity's own attribute when unset. This is a deliberate, user-optional
convenience feature (let the user point a field at their own sensor if their weather
integration doesn't populate it), not the deprecated forecast-sourcing pattern Spec.md
warns about. Distinguishing this clearly since it's easy to conflate the two.

### 2. Rain/precipitation unit handling errors

**Status: confirmed root cause.** (CONFIRMED)

`src/main.js` `drawChart()`:
```js
var lengthUnit = this._hass.config.unit_system.length;
...
var precipUnit = lengthUnit === 'km' ? this.ll('units')['mm'] : this.ll('units')['in'];
...
precipMax = lengthUnit === 'km' ? 4 : 1;   // hourly
precipMax = lengthUnit === 'km' ? 20 : 1;  // daily
```

Verified against HA core (`homeassistant/util/unit_system.py`,
`homeassistant/const.py`, `dev` branch): HA's unit system has a distinct,
independently-configurable `accumulated_precipitation_unit` (JSON key
`accumulated_precipitation`, values `mm`/`in`), **separate from** `length_unit`.
The card infers precipitation unit from `length` instead of reading
`accumulated_precipitation` directly. This happens to produce the right answer
on HA's two stock presets (Metric: km+mm, US Customary: mi+in), which is almost
certainly why it's gone unnoticed — but it's wrong for anyone on HA's per-category
custom unit system (e.g. km paired with in), and it's the wrong property to read
in principle regardless of whether that happens to matter for a given user.

The forecast **values** themselves are fine — confirmed that `weather/subscribe_forecast`
returns forecast items already converted to the user's display unit system via
`WeatherEntity._convert_forecast()` (native_* → plain keys, unit-converted
server-side). Only the *label* (`precipUnit`) and the *axis max* (`precipMax`) are
wrong; the data plotted is correct.

**Fix direction (not applied here):** the weather entity itself exposes a
per-entity `precipitation_unit` attribute (confirmed in `WeatherEntity.state_attributes`),
matching the pattern already correctly used for `wind_speed_unit`/`pressure_unit`/
`visibility_unit` elsewhere in this same file (`renderAttributes`). Reading
`this.weather.attributes.precipitation_unit` instead of deriving from `length` would
fix this and match the codebase's own existing (correct) pattern for other units.

### 3. Temperature unit handling errors

**Status: no bug found in the unit-conversion logic itself.** (CONFIRMED, negative result)

Verified: forecast temperature values (`temperature`, `templow`) and current-condition
temperature (`weather.attributes.temperature`) both arrive pre-converted to the
user's configured unit system before the card reads them — no client-side
conversion is attempted or needed, and none is done. `getUnit('temperature')`
correctly reads `hass.config.unit_system.temperature` for the display suffix.
(The real temperature-adjacent bug found this round — misaligned array indices
causing the low-temp line to render wrong or not at all — is a positional-data
bug, not a unit-conversion bug; see headline finding above.)

Minor, low-priority inconsistency: the display suffix uses the *global*
`unit_system.temperature` rather than the entity's own `weather.attributes.temperature_unit`
(as pressure/wind/visibility correctly do). In practice these are almost always
identical for weather entities, so this is a theoretical nitpick, not a real-world bug —
noting it for completeness rather than recommending action.

Wind speed and pressure conversion arithmetic (`renderAttributes()`, the manual
km/h↔m/s↔mph↔Bft and hPa↔mmHg↔inHg conversion blocks) was checked formula-by-formula
against known conversion constants — all correct. This logic exists because the card
supports a *per-card* display-unit override (`config.units.speed`/`config.units.pressure`)
independent of HA's global unit system, comparing against the entity's actual current
unit (`weather.attributes.wind_speed_unit`/`pressure_unit`) and converting only when
they differ. That's a legitimate design, not a bug.

### 4. Broken forecast-type picker in the UI config editor

**Status: RESOLVED, root cause confirmed live.** (CONFIRMED)

This took several rounds of live testing to actually run down, and the real
cause turned out to be different from every initial guess:

- **Not** the entity-selection commit (`88b5243`) — that was a real, separate
  bug (see below), but not the explanation for the pickers themselves.
- **Not** `ha-radio` being renamed to `ha-radio-group`/`ha-radio-option` in HA
  2026.6, despite that being a real, documented change (confirmed against the
  actual 2026.6 frontend blog post and component source). Migrating to the new
  component name made no difference when tested live.
- **Actual root cause**: Home Assistant lazy-loads many of its own internal
  frontend components. `ha-radio-group` is only used in one place in HA's own
  UI (the theme-mode picker in Profile settings) — if a user's browser session
  never happened to trigger loading that specific chunk, the tag is simply
  never registered, regardless of which of its names a custom card uses.
  Confirmed directly on the maintainer's live instance (HA 2026.7.3):
  `customElements.get('ha-radio-group')` returned `undefined`. Old `ha-radio`
  had the identical problem for the identical reason, which is why it looked
  broken from the very start, unrelated to any of this project's own changes.
  The page-tab buttons (`<mwc-button>`) turned out to have the same class of
  bug: `customElements.get('mwc-button')` also returned `undefined`.
- **Fix**: replaced the passive dependency on `<ha-radio>`/`<ha-radio-group>`
  with a standalone `<ha-selector>` (a `select` selector, `mode: 'list'`).
  `ha-selector` doesn't assume its sub-components are already loaded — it
  actively `import()`s the specific selector implementation it needs and
  awaits it before rendering (confirmed in `ha-selector.ts`'s `LOAD_ELEMENTS`
  map), which is what actually solves this class of bug rather than just
  matching whatever HA happens to call the component this release. The page
  tabs were swapped from `<mwc-button>` to `<ha-button>` (confirmed reliably
  loaded — used constantly throughout HA's own interface, unlike the niche
  radio-group), a plain tag swap since both fire a normal `click` event.

Separately, the entity-selection commit (`88b5243`, "Fix entity selection in
card editor") removed `this.requestUpdate()` and a `key === 'entity'` guard
from `_EntityChanged` — this was investigated and found to not be the cause
of the picker issue, but is worth keeping in mind if entity-selection-specific
problems ever surface, since it's still a real, if minor, behavioral change
from before that commit.

### 5. Other latent breakage found while reconciling

All items below are now fixed — kept here as a record of what was found and why,
per CLAUDE.md's "log the audit, don't just fix and forget" spirit.

- chartjs-plugin-datalabels `display` callbacks returning the string `'true'`
  instead of the string `'auto'` (not a valid value for that option) — fixed,
  commit `4a107be`.
- `calculateBeaufortScale()` (`src/main.js`) threw (`throw new Error(...)`) if
  `weather.attributes.wind_speed_unit` was missing or unrecognized, called
  directly from `renderAttributes()` and the wind-forecast render path — an
  uncaught throw there during render crashed the whole card, not just degraded
  the wind-speed field. Exactly the "HA entities can return unexpected shapes
  during restarts/integration reloads" scenario CLAUDE.md calls out by name as
  this project's historical failure pattern. Fixed to log and return `undefined`
  instead — PR #31.
- `WeatherChartCardEditor.render()` guarded `this._config` before reading
  `.entity` but not before unconditionally reading `.forecast`/`.units`/
  `.show_time` right after — if Lit's initial render fired before HA called
  `setConfig()` (a real timing race, not hypothetical), the editor threw and
  the whole config UI broke. Found live, not from static review — it only
  surfaced clearly once an unrelated card's duplicate custom-element
  registration crash (a different HACS card entirely, not this project) was
  fixed and stopped disrupting page load order. Fixed — PR #29.

---

## Deviations from upstream (informational — mostly already tracked as Phase 3)

- `package.json` (`name: "weather-chart-card"`, `repository: mlamberts78/weather-chart-card`)
  and `hacs.json` (`name: "Weather Chart Card"`, `filename: "weather-chart-card.js"`)
  still identify as the upstream project. Already Spec §9 / Phase 3 scope — not
  re-litigating here, just confirming it's still accurate as of this audit.
- `baseIconPath` in `setConfig()` still points at `cdn.jsdelivr.net/gh/mlamberts78/weather-chart-card/...`
  for both icon styles — same Phase 3 rebrand scope, but worth flagging specifically
  since it's a *runtime* dependency on the upstream repo's `dist/` output (icons are
  fetched from mlamberts78's GitHub at render time), not just cosmetic metadata.
- Feature additions beyond upstream, already present or landed in this recovery:
  `autoscroll`, dew-point current-value display (`show_dew_point`), dew-point
  *forecast line* (`show_dew_point_forecast`, this recovery), `wind_gust_speed`,
  `visibility`, RTL chart support, hourly min/max highlighting, day-separator
  gridlines, per-card unit overrides (`config.units.*`), Beaufort scale wind
  display, 12-hour time format option, per-field alternate-sensor overrides.

---

## Status: Phase 1 fix list complete

Every item identified in this audit has been fixed and verified live in Home
Assistant (2026.7.3) across several rounds of testing:

- Forecast array index misalignment — PR #29
- Chart label positioning (precip anchor/offset, gridline centering) and the
  `show_all_labels` density option, in both chart styles — PR #29
- Editor crash on render before `setConfig()` — PR #29
- Precipitation unit — PR #30
- `calculateBeaufortScale()` hardening — PR #31
- `ha-radio` → `ha-selector` (forecast type, chart style, icon style pickers) — PR #33
- `mwc-button` → `ha-button` (editor page tabs) — PR #34

Entity picker, language/units pickers, and checkboxes were all confirmed
working correctly during this same testing and needed no changes.

Per CLAUDE.md's phase discipline, TypeScript conversion (Spec.md §11 Phase 2)
is the next real work — no further Phase 1 items are open.
