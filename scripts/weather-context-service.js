const MODULE_ID = "pf2e-atmosphere-forge";
const WEATHER_FORGE_ID = "pf2e-weather-forge";
const CACHE_SETTING = "cachedWeatherForgeContext";

export class WeatherContextService {
  static registerSettings() {
    game.settings.register(MODULE_ID, CACHE_SETTING, {
      name: "Cached Weather Forge Context",
      scope: "world",
      config: false,
      type: Object,
      default: {}
    });
  }

  static isWeatherForgeActive() {
    return game.modules.get(WEATHER_FORGE_ID)?.active ?? false;
  }

  static cacheWeatherContext(value) {
    if (!value) return;

    try {
      const normalized = this.#normalize(value);
      if (!normalized.found) return;

      game.settings.set(MODULE_ID, CACHE_SETTING, {
        raw: value,
        normalized,
        cachedAt: Date.now()
      });
    } catch (error) {
      console.warn(`${MODULE_ID} | Failed to cache Weather Forge context`, error);
    }
  }

  static getContext() {
    if (!this.isWeatherForgeActive()) {
      return this.#buildContext({
        active: false,
        source: "manual",
        weather: "auto",
        timeOfDay: "auto",
        season: "auto",
        labelKey: "PF2EATMOSPHEREFORGE.WeatherContext.NotAvailable"
      });
    }

    const raw = this.#readWeatherForgeData();
    const normalized = this.#normalize(raw);

    if (normalized.found) this.cacheWeatherContext(raw);

    if (game.user?.isGM) {
      console.debug(`${MODULE_ID} | Weather Forge raw context`, raw);
      console.debug(`${MODULE_ID} | Weather Forge normalized context`, normalized);
    }

    return this.#buildContext({
      active: true,
      source: normalized.found ? "weatherForge" : "weatherForgeUnavailable",
      weather: normalized.weather,
      timeOfDay: normalized.timeOfDay,
      season: normalized.season,
      raw,
      labelKey: normalized.found
        ? "PF2EATMOSPHEREFORGE.WeatherContext.Loaded"
        : "PF2EATMOSPHEREFORGE.WeatherContext.NoData"
    });
  }

  static #buildContext({ active, source, weather, timeOfDay, season = "auto", raw = null, labelKey }) {
    return {
      active,
      source,
      weather,
      weatherLabel: game.i18n.localize(`PF2EATMOSPHEREFORGE.Weather.${this.#capitalize(weather)}`),
      timeOfDay,
      timeOfDayLabel: game.i18n.localize(`PF2EATMOSPHEREFORGE.TimeOfDay.${this.#capitalize(timeOfDay)}`),
      season,
      seasonLabel: game.i18n.localize(`PF2EATMOSPHEREFORGE.Season.${this.#capitalize(season)}`),
      raw,
      label: game.i18n.localize(labelKey)
    };
  }

  static #readWeatherForgeData() {
    const directCandidates = [
      () => game.modules.get(WEATHER_FORGE_ID)?.api?.getCurrentWeather?.(),
      () => game.modules.get(WEATHER_FORGE_ID)?.api?.getWeather?.(),
      () => game.modules.get(WEATHER_FORGE_ID)?.api?.getState?.(),
      () => game.modules.get(WEATHER_FORGE_ID)?.api?.getCurrentForecast?.(),
      () => globalThis.PF2eWeatherForge?.getCurrentWeather?.(),
      () => globalThis.PF2eWeatherForge?.getWeather?.(),
      () => globalThis.PF2eWeatherForge?.getState?.(),
      () => globalThis.PF2eWeatherForge?.currentWeather,
      () => globalThis.PF2EWeatherForge?.getCurrentWeather?.(),
      () => globalThis.PF2EWeatherForge?.getWeather?.(),
      () => globalThis.PF2EWeatherForge?.getState?.(),
      () => globalThis.PF2EWeatherForge?.currentWeather,
      () => globalThis.pf2eWeatherForge?.getCurrentWeather?.(),
      () => globalThis.pf2eWeatherForge?.getWeather?.(),
      () => globalThis.pf2eWeatherForge?.getState?.(),
      () => globalThis.pf2eWeatherForge?.currentWeather,
      () => game.pf2eWeatherForge?.getCurrentWeather?.(),
      () => game.pf2eWeatherForge?.getWeather?.(),
      () => game.pf2eWeatherForge?.getState?.(),
      () => game.pf2eWeatherForge?.currentWeather,
      () => canvas.scene?.getFlag(WEATHER_FORGE_ID, "currentWeather"),
      () => canvas.scene?.getFlag(WEATHER_FORGE_ID, "weather"),
      () => canvas.scene?.getFlag(WEATHER_FORGE_ID, "lastWeather"),
      () => canvas.scene?.getFlag(WEATHER_FORGE_ID, "forecast"),
      () => canvas.scene?.getFlag(WEATHER_FORGE_ID, "currentForecast"),
      () => canvas.scene?.getFlag(WEATHER_FORGE_ID, "state"),
      () => canvas.scene?.getFlag(WEATHER_FORGE_ID, "data"),
      () => game.settings.get(WEATHER_FORGE_ID, "currentWeather"),
      () => game.settings.get(WEATHER_FORGE_ID, "weather"),
      () => game.settings.get(WEATHER_FORGE_ID, "lastWeather"),
      () => game.settings.get(WEATHER_FORGE_ID, "forecast"),
      () => game.settings.get(WEATHER_FORGE_ID, "currentForecast"),
      () => game.settings.get(WEATHER_FORGE_ID, "state"),
      () => game.settings.get(WEATHER_FORGE_ID, "data")
    ];

    for (const getter of directCandidates) {
      try {
        const value = getter();
        if (this.#hasUsefulWeatherData(value)) return value;
      } catch (_error) {
        // Optional integration: missing APIs/settings/flags are expected.
      }
    }

    const scannedSceneFlags = this.#scanSceneFlags();
    if (this.#hasUsefulWeatherData(scannedSceneFlags)) return scannedSceneFlags;

    const scannedWorldSettings = this.#scanSettingsStorage("world");
    if (this.#hasUsefulWeatherData(scannedWorldSettings)) return scannedWorldSettings;

    const scannedClientSettings = this.#scanSettingsStorage("client");
    if (this.#hasUsefulWeatherData(scannedClientSettings)) return scannedClientSettings;

    const scannedSceneDocuments = this.#scanSceneDocuments();
    if (this.#hasUsefulWeatherData(scannedSceneDocuments)) return scannedSceneDocuments;

    const scannedGlobals = this.#scanGlobalWeatherForgeObjects();
    if (this.#hasUsefulWeatherData(scannedGlobals)) return scannedGlobals;

    const cached = this.#readCachedContext();
    if (this.#hasUsefulWeatherData(cached)) return cached;

    return null;
  }

  static #readCachedContext() {
    try {
      const cached = game.settings.get(MODULE_ID, CACHE_SETTING);
      return cached?.raw ?? cached ?? null;
    } catch (_error) {
      return null;
    }
  }

  static #scanSceneFlags() {
    try {
      const candidates = {
        activeScene: canvas.scene?.flags?.[WEATHER_FORGE_ID],
        activeSceneAllFlags: canvas.scene?.flags
      };

      return this.#hasUsefulWeatherData(candidates) ? candidates : null;
    } catch (_error) {
      return null;
    }
  }

  static #scanSceneDocuments() {
    try {
      const matches = {};

      const activeScene = canvas.scene;
      if (activeScene) {
        matches.activeScene = {
          id: activeScene.id,
          name: activeScene.name,
          flags: activeScene.flags
        };
      }

      for (const scene of game.scenes ?? []) {
        const sceneFlags = scene?.flags;
        if (!sceneFlags) continue;

        if (sceneFlags[WEATHER_FORGE_ID] || this.#hasUsefulWeatherData(sceneFlags)) {
          matches[scene.id] = {
            id: scene.id,
            name: scene.name,
            flags: sceneFlags
          };
        }
      }

      return Object.keys(matches).length ? matches : null;
    } catch (_error) {
      return null;
    }
  }

  static #scanSettingsStorage(scope) {
    try {
      const storage = game.settings.storage?.get(scope);
      if (!storage) return null;

      const matches = {};

      for (const [key, setting] of storage.entries()) {
        const isWeatherForgeSetting = key.startsWith(`${WEATHER_FORGE_ID}.`);
        const looksWeatherRelated = /(weather|wetter|forecast|vorhersage|climate|klima|timeOfDay|tageszeit|current|state)/i.test(key);

        if (!isWeatherForgeSetting && !looksWeatherRelated) continue;

        const settingKey = key.replace(`${WEATHER_FORGE_ID}.`, "");
        const value = setting?.value;

        if (value == null || value === "") continue;

        if (isWeatherForgeSetting || this.#hasUsefulWeatherData(value)) {
          matches[settingKey] = value;
        }
      }

      return Object.keys(matches).length ? matches : null;
    } catch (_error) {
      return null;
    }
  }

  static #scanGlobalWeatherForgeObjects() {
    const names = [
      "PF2eWeatherForge",
      "PF2EWeatherForge",
      "pf2eWeatherForge",
      "WeatherForge",
      "weatherForge"
    ];

    const matches = {};

    for (const name of names) {
      try {
        const value = globalThis[name] ?? game[name];
        if (this.#hasUsefulWeatherData(value)) matches[name] = value;
      } catch (_error) {
        // Ignore inaccessible globals.
      }
    }

    return Object.keys(matches).length ? matches : null;
  }

  static #hasUsefulWeatherData(value) {
    if (!value) return false;

    const flat = this.#flattenValues(value).join(" ").toLowerCase();

    return /(weather|wetter|forecast|vorhersage|rain|regen|storm|sturm|fog|nebel|snow|schnee|cloud|wolke|bewölkt|clear|klar|sun|sonnig|night|nacht|morning|morgen|evening|abend|mittag|afternoon|nachmittag|temperature|temperatur|wind|humidity|luftfeuchte|precipitation|niederschlag|current|aktuell)/i.test(flat);
  }

  static #normalize(raw) {
    if (!raw) return { found: false, weather: "auto", timeOfDay: "auto", season: "auto" };

    const flat = this.#flattenValues(raw).join(" ").toLowerCase();

    return {
      found: true,
      weather: this.#normalizeWeather(flat),
      timeOfDay: this.#normalizeTimeOfDay(flat),
      season: this.#normalizeSeason(flat)
    };
  }

  static #flattenValues(value, depth = 0) {
    if (depth > 6 || value == null) return [];

    if (["string", "number", "boolean"].includes(typeof value)) {
      return [String(value)];
    }

    if (Array.isArray(value)) {
      return value.flatMap((entry) => this.#flattenValues(entry, depth + 1));
    }

    if (value instanceof Map) {
      return [...value.entries()].flatMap(([key, entry]) => [
        String(key),
        ...this.#flattenValues(entry, depth + 1)
      ]);
    }

    if (typeof value === "object") {
      return Object.entries(value).flatMap(([key, entry]) => [
        key,
        ...this.#flattenValues(entry, depth + 1)
      ]);
    }

    return [];
  }

  static #normalizeWeather(value) {
    if (/(extreme|severe|unwetter|thunder|gewit|storm|sturm|orkan|tempest)/i.test(value)) return "storm";
    if (/(snow|sleet|blizzard|schnee|schneefall|hagel|hail)/i.test(value)) return "snow";
    if (/(fog|mist|nebel|dunst)/i.test(value)) return "fog";
    if (/(rain|shower|drizzle|regen|niesel|schauer|precipitation|niederschlag)/i.test(value)) return "rain";
    if (/(cloud|overcast|bewölkt|wolken|bedeckt)/i.test(value)) return "cloudy";
    if (/(clear|sun|klar|sonnig|wolkenlos)/i.test(value)) return "clear";
    return "auto";
  }

  static #normalizeSeason(value) {
    const explicitSeason = this.#extractExplicitSeason(value);
    if (explicitSeason) return explicitSeason;

    // Order matters here. Weather Forge data may contain option lists or tables
    // with several season names. Autumn is checked before summer so a current
    // "Herbst" value is not accidentally overruled by a generic "Sommer" entry.
    if (/(autumn|fall|herbst|herbt|lamashan|neth|kuthona)/i.test(value)) return "autumn";
    if (/(winter|abadius|calistril|pharast)/i.test(value)) return "winter";
    if (/(spring|frühling|fruehling|grobtag|desnus|sarenith)/i.test(value)) return "spring";
    if (/(summer|sommer|erastus|arodus|rova)/i.test(value)) return "summer";
    return "auto";
  }

  static #extractExplicitSeason(value) {
    const patterns = [
      /(?:currentSeason|current-season|season|jahreszeit|currentJahreszeit|aktuelleJahreszeit|aktuelle-jahreszeit)\s*[:=]\s*["']?(autumn|fall|herbst|herbt|winter|spring|frühling|fruehling|summer|sommer)["']?/i,
      /(?:currentSeason|current-season|season|jahreszeit|currentJahreszeit|aktuelleJahreszeit|aktuelle-jahreszeit)\s+(autumn|fall|herbst|herbt|winter|spring|frühling|fruehling|summer|sommer)/i
    ];

    for (const pattern of patterns) {
      const match = value.match(pattern);
      if (!match) continue;

      return this.#seasonFromToken(match[1]);
    }

    return null;
  }

  static #seasonFromToken(token) {
    const value = String(token ?? "").toLowerCase();

    if (/(autumn|fall|herbst|herbt)/i.test(value)) return "autumn";
    if (/(winter)/i.test(value)) return "winter";
    if (/(spring|frühling|fruehling)/i.test(value)) return "spring";
    if (/(summer|sommer)/i.test(value)) return "summer";

    return null;
  }

  static #normalizeTimeOfDay(value) {
    if (/(night|nacht|midnight)/i.test(value)) return "night";
    if (/(evening|abend|dusk|twilight|dämmerung)/i.test(value)) return "evening";
    if (/(afternoon|nachmittag)/i.test(value)) return "afternoon";
    if (/(midday|noon|mittag)/i.test(value)) return "midday";
    if (/(morning|morgen|dawn|morgengrauen)/i.test(value)) return "morning";
    return "auto";
  }

  static #capitalize(value) {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
