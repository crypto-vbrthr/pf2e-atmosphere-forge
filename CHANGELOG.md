# Changelog

## 0.2.1

### Fixed
- Reworked DE/EN localization files from flat dotted keys to Foundry-native nested translation objects.
- Resolved the `CityForge.Source` label/options localization prefix collision by separating `SourceLabel` from `SourceOptions`.
- Fixed raw localization keys such as `PF2EATMOSPHEREFORGE.Title` appearing throughout the application.
- Hardened the three-column application layout so localized headings and controls cannot push the action column outside the window.
- Removed inherited hard minimum widths from the integration panels.
- Increased the default application size to 1280×900 and added two responsive layout breakpoints.

### Compatibility
- City Forge integration remains designed for 0.8.2+.
- Weather Forge integration remains designed for 1.1.3+.
- Public Atmosphere Forge API remains v1.
- No persistent data migration is required.

## 0.2.0

### Added
- Optional City Forge active-Scene atmosphere context.
- Explicit City Forge settlement selection.
- Manual/no-City source mode.
- Live City settlement list from the public City Forge API.
- Automatic environment derivation from City place type, traits, terrain, and settlement type.
- Optional settlement-state-derived atmosphere intensity.
- Intensity calculation includes dynamic state, active conditions/threats, security readiness, legitimacy, corruption, and hostile/opposed faction pressure.
- Optional deterministic local settlement-state section in generated atmosphere.
- City context path/status display.
- Direct Weather Forge `getCurrentWeatherContext()` integration.
- Current weather temperature and mismatch display.
- Public Atmosphere Forge API v1.
- Live rerender on Scene, City state/settlement, and Weather setting changes.
- CSS isolation beneath `.pf2e-atmosphere-forge`, with chat styling retained under `.pf2e-atmosphere-forge-chat`.

### Changed
- Weather Forge context loading now prefers the public API and uses a limited legacy fallback.
- Generation refreshes City and Weather contexts immediately before producing a result.
- City local-context sections are deterministic and do not offer the reroll action.
- Default application width increased to 1180px for the added integration controls.

### Compatibility
- Foundry VTT 14.
- City Forge optional, designed for 0.8.2+.
- Weather Forge optional, designed for 1.1.3+.
- No hard module dependencies.
- Existing Atmosphere Forge environment data and localization remain compatible.