# Atmosphere Forge 0.2.0: City Forge + Weather Forge Integration

## Purpose

Atmosphere Forge now combines two optional providers:

```text
City Forge    → where, settlement state, civic context
Weather Forge → current meteorological conditions, time of day, season
Atmosphere    → narrative atmosphere, sounds, smells, details
```

Neither provider is required.

## City Forge sources

Atmosphere Forge supports three City context modes:

1. **Automatic from active Scene**
   - calls `city.integrations.getContextForScene(sceneUuid, "atmosphere")`
   - preserves City Forge location → district → settlement specificity

2. **City Forge settlement**
   - explicitly selects a settlement by stable City Forge settlement id
   - calls `city.integrations.atmosphere.getContext(settlementId)`
   - is independent of the currently viewed Scene

3. **Manual / no City Forge**
   - Atmosphere Forge ignores City Forge context

The settlement selector stores only the settlement id. City data is always fetched live.

## City-derived environment

When enabled, Atmosphere Forge derives its environment from the most specific available City context.

High-confidence place/type mappings include:

- temple / shrine / church → `temple`
- cave / mine → `cave`
- ruin → `ruin`
- dungeon / sewer / catacomb / crypt → `dungeon`
- coast / harbor / port / docks → `coast`
- mountain / alpine → `mountain`
- swamp / marsh / wetland → `swamp`
- forest / woodland → `forest`
- wilderness / grassland / steppe → `wilderness`

If no specific place/terrain mapping applies:

- hamlet / village → `village`
- town / metropolis → `city`

Manual environment remains available as fallback.

## City-derived intensity

When enabled, Atmosphere Forge calculates a transparent suggested intensity from City Forge's effective state.

Inputs include:

- prosperity
- supply
- security
- order
- mood
- health
- active conditions and their severity
- active threats
- security readiness
- government legitimacy
- corruption
- influential opposed/hostile factions

Poor/unstable state raises the atmosphere intensity. Positive/stable state lowers it.

The score is clamped to 0–100 and then uses the existing Atmosphere Forge bands:

- `<25` calm
- `<60` normal
- `<85` tense
- `>=85` nightmare

The existing manual intensity slider remains available as fallback or override by disabling City-derived intensity.

## Local settlement-state output

When enabled, generated atmosphere includes a deterministic **Local settlement state** section.

It can summarize:

- effective mood
- order
- security
- health
- named active conditions
- named active threats
- mobilized security
- the strongest opposed/hostile faction

This section is not random and therefore cannot be rerolled independently.

## Weather Forge 1.1.x

Atmosphere Forge prefers the public Weather Forge API:

```js
await game.modules
  .get("pf2e-weather-forge")
  .api.getCurrentWeatherContext();
```

It consumes:

- current precipitation / cloud state
- extreme weather
- temperature
- time segment
- season
- City-context provenance / mismatch metadata

Weather is normalized into Atmosphere Forge's existing coarse weather categories:

- clear
- cloudy
- rain
- storm
- fog
- snow

Weather Forge remains owner of actual weather generation.

A limited legacy fallback remains for older Weather Forge builds.

## Live refresh

The open Atmosphere Forge rerenders when:

- the active Foundry Scene changes
- City Forge settlement/state hooks fire
- Weather Forge settings update
- legacy Weather Forge update hooks fire

Generation itself always refreshes both City and Weather context again before rolling atmosphere.

## Public Atmosphere Forge API

```js
const atmosphere = game.modules.get("pf2e-atmosphere-forge")?.api;

atmosphere.version === 1;

await atmosphere.city.getContext();
await atmosphere.city.listSettlements();
await atmosphere.weather.getContext();

await atmosphere.generate(options);
```

## Ownership

### City Forge owns
- settlement identity
- place graph
- geography
- politics
- dynamic settlement state

### Weather Forge owns
- current weather
- forecast
- weather history
- meteorological generation

### Atmosphere Forge owns
- atmosphere generation
- sensory descriptions
- derived environment/intensity policy
- chat presentation

Atmosphere Forge never writes City Forge state or Weather Forge weather.
