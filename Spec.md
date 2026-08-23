# Weather Chart Cardx — Specification

## 1. Background & Context

`weather-chart-cardx` is a fork of [mlamberts78/weather-chart-card](https://github.com/mlamberts78/weather-chart-card),
a Home Assistant Lovelace custom card (Lit + Chart.js). The upstream project appears abandoned.
This fork is taking up active maintenance as its own project.

**Current state of the codebase (as of project start):**

- The GitHub fork (`dxmnkd316/weather-chart-cardx`, MIT license) contains only one real change
  from upstream: an added dew point forecast line. `package.json` still identifies as
  `weather-chart-card` and still points at the upstream repository — the rename never
  propagated past the GitHub repo name.
- A second, divergent copy — `weather-chart-cardx2.js` — has been live-edited directly on the
  maintainer's Home Assistant instance since 2024, with no corresponding commits. It contains
  the dew point work plus an unknown quantity of additional changes, some of which forced
  bad patterns (notably: using a `sensor` entity for forecast data instead of the `weather`
  entity's forecast attribute/service, which HA deprecated the sensor-based approach in favor
  of ~2023–2024).
- Known breakage: the Lovelace UI config editor no longer allows selecting a forecast type,
  indicating something in the editor/config schema is out of sync with current HA frontend
  expectations.
- Stack: Lit 2.8, Chart.js 4.4 + chartjs-plugin-datalabels, Rollup build, plain JavaScript
  (no TypeScript), ESLint.

**Why this document exists:** to turn a loosely-described cleanup effort into a spec precise
enough to hand to Claude Code, phase by phase, without re-litigating scope each session.

---

## 2. Goals

1. Recover the maintainer's untracked local edits into version control without losing work.
2. Bring the codebase up to current best practices: TypeScript, correct HA 2026.6 APIs,
   accurate unit handling, working config UI.
3. Replace the sensor-based forecast hack with the standard `weather` entity forecast
   subscription (service call `weather.get_forecasts` / entity forecast attribute, per
   current HA integration guidance — **verify exact mechanism against current HA docs at
   implementation time; do not assume from training data, as this API has changed more than
   once**).
4. Rebrand cleanly: repo, `package.json`, README all consistently identify this as
   `weather-chart-cardx`, a new project maintained independently, built on Marc Lamberts'
   original work.
5. Build the project as if it will eventually be HACS-published (proper `hacs.json`,
   semantic versioning, clean README, no hardcoded assumptions about the maintainer's own
   HA setup) — without actually taking publishing steps yet. This is a "no regrets" choice:
   the cost of doing it now is low, the cost of retrofitting it later is not.
6. Add one new feature once the above is stable: a configurable AQI line in the forecast,
   with the AQI source entity chosen via the UI config editor (not hardcoded).

## 3. Non-Goals (this phase)

- **Full per-field visibility toggle UI** (letting users show/hide any forecast parameter —
  UV index, wind, etc. — live from the card editor). The maintainer wants this eventually but
  has explicitly deferred building it until the repo is in working order. See §6 for the
  architectural accommodation we're making now so this doesn't require a rewrite later.
- Actually publishing to HACS (submitting for inclusion, announcing it, etc.) — build
  HACS-ready, stop there.
- Feature parity chasing with any other weather card project.
- Multi-language string additions beyond keeping the existing `localize/` files intact.

## 4. Target Environment

- Home Assistant **2026.6** — frontend conventions, config editor patterns, and the weather
  forecast API must target this version specifically. Do not assume older HA behavior is
  still valid; several relevant APIs have changed since this card was last touched.
- HACS-compatible custom card (`hacs.json` present and correct), even though not yet submitted.
- Browser support: whatever the HA frontend itself supports (evergreen browsers) — no need to
  target anything more conservative.

## 5. Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Language | Convert to **TypeScript** | This card's worst bugs (unit mismatches, forecast field shape assumptions) are exactly what a type system catches. Chart.js ships native TS types, so this isn't a fight with a dependency — the real work is modeling the weather/forecast entity shapes correctly, which pays for itself immediately. |
| Component framework | Stay on **Lit**, upgrade to Lit 3 | Matches current HA frontend convention; Lit 2→3 is a well-documented, low-risk upgrade path, not a framework change. |
| Charting | Keep **Chart.js 4.x** | No reason to replace; verify current version compatibility with Lit 3 / TS during upgrade. |
| Build | Keep **Rollup**, add `tsconfig.json` + TS plugin | Minimal disruption to existing build; Rollup handles TS fine. |
| Forecast data source | **`weather` entity forecast (service/attribute)**, not `sensor` | This is the specific deprecated pattern the maintainer forced in; it's the root of several "errors" mentioned (units, missing fields). Must be fixed before anything else is layered on top. |
| Config schema | **Field-registry pattern** (see §6) | Makes future per-field visibility toggles additive, not a rewrite. |
| Testing | Add a minimal unit test setup (Vitest recommended — fast, TS-native, works cleanly with Rollup projects) covering unit conversion logic and config parsing at minimum | These are exactly the areas with known historical bugs; regression protection matters more here than UI snapshot testing. |

### Proposed directory structure

```
weather-chart-cardx/
├── .github/
│   └── workflows/
│       └── validate.yml          # HACS validation action
├── src/
│   ├── main.ts                   # custom element registration entry point
│   ├── weather-chart-card.ts     # root Lit component
│   ├── editor/
│   │   └── weather-chart-card-editor.ts
│   ├── components/
│   │   ├── forecast-chart.ts
│   │   ├── current-conditions.ts
│   │   └── attributes-row.ts
│   ├── models/
│   │   ├── config.ts             # Config type, defaults, field registry (§6)
│   │   ├── forecast.ts           # Forecast data typings
│   │   └── weather-entity.ts     # HA weather entity + forecast API typings
│   ├── utils/
│   │   ├── units.ts              # temp/pressure/speed/precip conversion
│   │   └── forecast-source.ts    # resolves weather entity forecast (replaces sensor hack)
│   ├── const.ts
│   └── localize/                 # existing i18n, carried over as-is
├── test/
├── dist/                         # build output, gitignored
├── tsconfig.json
├── rollup.config.mjs
├── .eslintrc / eslint.config.*   # updated for TS parser
├── package.json                  # corrected name + repository fields
├── hacs.json
├── README.md
├── CLAUDE.md
└── Spec.md
```

## 6. Config Schema Design (forward-compatibility requirement)

Forecast display fields (temperature, humidity, pressure, wind, UV index, dew point, AQI,
etc.) must be modeled as a **registry**, not individually hardcoded `show_x: boolean` config
options scattered through render logic:

```ts
interface ForecastFieldDefinition {
  key: string;            // e.g. "uv_index"
  label: string;          // display label / translation key
  unit?: string;          // unit type for conversion lookup
  defaultVisible: boolean;
}
```

Render logic should iterate this registry rather than branching on named booleans. This is a
**data-modeling requirement for Phase 1**, not the deferred visibility-toggle *feature* itself
— we're not building the UI to let users flip these live yet, we're just not painting
ourselves into a corner that makes it a rewrite when we do.

## 7. Known Issues to Resolve (Phase 1)

- [ ] Sensor-based forecast data → replace with `weather` entity forecast mechanism per
      current HA docs.
- [ ] Rain/precipitation unit handling errors (verify against HA's unit system, including
      the user's configured unit system, not just hardcoded assumptions).
- [ ] Temperature unit handling errors (same — respect HA's configured unit system).
- [ ] Broken forecast-type picker in the UI config editor.
- [ ] Any other latent breakage surfaced while reconciling `weather-chart-cardx2.js` into
      the repo — audit during Phase 1, don't assume the list above is exhaustive.

## 8. New Feature: AQI (Phase 2 — after Phase 1 is stable and merged)

- New optional forecast field: Air Quality Index.
- **Entity is user-configurable via the UI editor** — do not hardcode a specific AQI
  integration (PurpleAir, AirNow, generic `sensor.*_air_quality_index`, etc.). The card
  should accept any entity the user points it at and handle missing/unavailable state
  gracefully.
- Follows the field-registry pattern from §6 — this should mostly be "add one registry entry
  + one entity-picker config option," not bespoke plumbing, if §6 was implemented correctly.

## 9. README / Branding (Phase 3)

- Clearly state: forked from and originally created by Marc Lamberts
  (mlamberts78/weather-chart-card), now maintained independently as a new project under new
  ownership.
- Correct all `package.json` metadata (`name`, `repository`) to match the actual repo.
- Remove or update installation instructions / badges that reference the upstream repo where
  they should now reference this one.
- Document the new HA 2026.6-compatible config options accurately — the existing README's
  config table should be audited against the actual (post-cleanup) config schema, not
  copied forward assuming it's still accurate.
- **Detach from the upstream fork network** (GitHub: repo Settings → Danger Zone → "Leave fork
  network"). This is self-service and permanent. Rationale: MIT licensing only requires
  retaining the original copyright/license notice and attribution, which the README already
  covers — the GitHub "fork of" relationship is a separate, purely cosmetic GitHub-network
  concept, and keeping it implies a closer tracking relationship with an abandoned upstream
  than actually exists.
  - **Do this only after Phase 1 (recovery) is complete and committed** — detaching before
    then risks nothing directly, but there's no reason to do it before the repo actually
    reflects the maintainer's real working state.
  - **Before detaching**, review the repo's currently-open pull requests. Detaching does
    **not** carry over issues, PRs, wikis, stars, or watchers (git commit history and
    authorship *are* preserved). Confirm nothing there is worth keeping first — this step is
    irreversible.

## 10. Open Questions / Decisions Log

*(Keep this updated as decisions get made — this is the running record for anything not
nailed down at spec-writing time.)*

- None outstanding as of spec creation. Add here as they come up.

## 11. Phase Order (do not reorder without discussion)

1. **Recovery**: reconcile `weather-chart-cardx2.js` into the repo as a single source of truth.
2. **Modernization**: TypeScript conversion, Lit 3 upgrade, forecast-source fix, unit fixes,
   config editor fix, field-registry config model.
3. **Rebrand**: README, package.json metadata, HACS-readiness, detach from upstream fork
   network (see §9 — review open PRs first; irreversible).
4. **New feature**: AQI.
5. *(Future, not this engagement unless explicitly revisited)*: per-field visibility toggle UI.
