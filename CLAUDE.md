# CLAUDE.md

Operating instructions for Claude Code on the `weather-chart-cardx` project.
**Read `Spec.md` in full before doing anything else.** It has the full context, phase order,
and architectural decisions. This file governs *how* you work; `Spec.md` governs *what* you're
building.

## Project snapshot

- Home Assistant Lovelace custom card, forked from an abandoned upstream project.
- Currently JavaScript (Lit + Chart.js + Rollup), converting to TypeScript.
- Two divergent sources exist at project start: the committed repo (minimal changes) and
  `weather-chart-cardx2.js` (a live-edited, uncommitted superset with unknown additional
  changes). Reconciling these is the literal first task — see "First task" below.
- Target: Home Assistant 2026.6.

## Working relationship

The maintainer is an experienced engineer (20 years managing capital projects) but not a
professional software developer — entry-level JS, rudimentary C++/Python/TypeScript, working
VBA knowledge. Treat him as the architect and product owner, not as someone who needs concepts
dumbed down, but don't assume fluency with JS/TS idiom or tooling conventions either.

- **Explain structural decisions before implementing them**, especially anything with
  long-term architectural weight (config schema shape, module boundaries, state management).
  A few sentences on the trade-off is enough — this isn't a lecture, it's letting him make an
  informed call.
- **Push back** if a request would conflict with something already decided in `Spec.md`, undercut
  the field-registry design, or reintroduce a known-bad pattern (e.g. sensor-based forecast
  data). Don't silently comply with something that contradicts the spec — flag it.
- **No shortcuts.** No "quick fix" patches, no `any` types as a way to avoid modeling data
  properly, no skipping error handling because "it probably won't happen." This is meant to be
  maintained long-term.
- If Home Assistant's current APIs, forecast mechanisms, or config editor conventions are
  uncertain, **verify against current HA developer documentation** rather than relying on
  training data — this card's core bugs came from exactly this kind of drift, and HA's weather
  forecast API in particular has changed more than once.

## Phase discipline

Follow the phase order in `Spec.md` §11. Do not jump ahead to the AQI feature or the
future visibility-toggle UI while Phase 1/2 issues are open, even if it seems like a quick
detour. If the maintainer asks for something out of phase order, point out the sequencing
rather than just doing it.

## First task

Before any refactor or modernization work begins:

1. Help reconcile `weather-chart-cardx2.js` (the maintainer's live-edited local file) against
   the current repo state. Confirm it's a superset of what's committed (not a different,
   older branch of changes) before treating it as the new baseline.
2. Once reconciled and committed to a snapshot branch (per the maintainer's own git recovery
   steps, done outside this session), treat that branch as the actual starting point for all
   further work — not the pre-existing `master`.
3. Do a full audit pass noting every deviation from upstream and every known/suspected bug,
   before starting the TypeScript conversion. Don't fix issues opportunistically as you notice
   them mid-conversion — log them, finish the audit, then work the list deliberately. Silent
   opportunistic fixes make it hard to track what changed and why.

## Coding standards

- **TypeScript, strict mode.** No implicit `any`. Model HA entity/forecast/config shapes as
  real interfaces (see `Spec.md` §5–6), not loosely-typed objects.
- **ESLint** config updated for the TS parser; keep it enforced, don't disable rules to make
  errors go away — fix the underlying issue or have a documented reason for an exception.
- **Error handling**: HA entities can be unavailable, unconfigured, or return unexpected
  shapes (especially during HA restarts or integration reloads). Handle these states
  explicitly — this card's history of "errors around rain units, temperature units" is a
  direct symptom of not handling this robustly.
- **Commits**: small, scoped, descriptive. This project is recovering from zero commit
  discipline — don't repeat that. One logical change per commit; no "misc fixes" dumps.
- **Tests**: unit conversion logic and config parsing are the highest-value test targets given
  this project's bug history — prioritize those over UI/render testing.

## Commands (fill in / confirm once tooling is set up)

```
npm run start   # dev build with watch (rollup -c rollup.config.dev.js --watch)
npm run build   # lint + production build
npm run lint    # eslint
```

TypeScript-specific commands (`tsc --noEmit` for type-checking, test runner command) should be
added here once the TS/testing setup lands in Phase 1 — keep this section current as tooling
changes rather than letting it drift out of sync with reality.

## What "done" looks like for Phase 1

- No sensor-based forecast data remains; forecast comes from the `weather` entity mechanism
  current in HA 2026.6.
- Unit handling (temp, pressure, precipitation, wind speed) verified correct against HA's
  configured unit system, not just hardcoded assumptions.
- UI config editor's forecast-type picker works again.
- Codebase is TypeScript, strict mode, passing lint.
- Config schema follows the field-registry pattern (`Spec.md` §6).
- Everything from the maintainer's live-edited file is either preserved or deliberately and
  visibly dropped (never silently lost).
