# PF2E Atmosphere Forge 0.2.2

Atmosphere Forge generates quick PF2e scene atmosphere descriptions for Foundry VTT.

0.2.0 adds deep optional integration with City Forge and the current Weather Forge API.

## City Forge

Atmosphere Forge can use either:

- the active Scene's City Forge settlement/district/location
- an explicitly selected City Forge settlement
- no City Forge context

City context can optionally:

- derive the effective environment
- derive atmosphere intensity from settlement state
- add a local settlement-state section to generated output

The manual environment and intensity controls remain available as fallbacks.

## Weather Forge

Atmosphere Forge now prefers Weather Forge's public `getCurrentWeatherContext()` API rather than searching through unrelated flags/settings.

Current weather is converted to the existing atmosphere categories:

- clear
- cloudy
- rain
- storm
- fog
- snow

Time of day and season are also consumed.

## Combined use

A typical generation path can now be:

```text
Scene
 ↓
City Forge: Schusseln › Hafenviertel › Alter Kai
 ↓
Environment: Coast
Settlement state: tense
 ↓
Weather Forge: rain, evening, autumn
 ↓
Atmosphere Forge:
atmosphere + sounds + smell + rain + evening + autumn + local settlement state + detail
```

All integrations remain optional.

See `CITY-WEATHER-INTEGRATION.md` for the complete contract.


## 0.2.1 localization/layout hotfix

The 0.2.0 integration build exposed that Atmosphere Forge's old flat dotted localization files were not being resolved by the current Foundry runtime. 0.2.1 converts the full DE/EN catalog to nested Foundry translation objects and hardens the expanded three-column UI against overflow.


## 0.2.2 City intensity suggestion behavior

City Forge no longer supplies a hidden intensity value that overrides the visible slider.

When City intensity suggestions are enabled, the current City-derived intensity pre-fills the slider. From that point onward the slider is authoritative and can be adjusted freely. Changing City context or explicitly refreshing/re-enabling the suggestion applies the latest suggestion again.
