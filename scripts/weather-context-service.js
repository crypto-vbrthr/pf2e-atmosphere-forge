const MODULE_ID = "pf2e-atmosphere-forge";
const WEATHER_FORGE_ID = "pf2e-weather-forge";
const CACHE_SETTING = "cachedWeatherForgeContext";

export class WeatherContextService {
  static registerSettings() {
    try {
      if (!game.settings.settings?.has?.(`${MODULE_ID}.${CACHE_SETTING}`)) {
        game.settings.register(MODULE_ID, CACHE_SETTING, {
          name: "Cached Weather Forge Context",
          scope: "world",
          config: false,
          type: Object,
          default: {}
        });
      }
    } catch (error) {
      console.warn(`${MODULE_ID} | Could not register Weather Forge cache`, error);
    }
  }

  static status() {
    const module = globalThis.game?.modules?.get?.(WEATHER_FORGE_ID) ?? null;
    const api = module?.active ? module.api : null;
    return Object.freeze({
      installed: Boolean(module),
      active: Boolean(module?.active),
      compatible: Boolean(api && typeof api.getCurrentWeatherContext === "function"),
      version: module?.version ?? module?.manifest?.version ?? null
    });
  }

  static isWeatherForgeActive() {
    return this.status().active;
  }

  static async cacheWeatherContext(value) {
    if (!value) return;
    try {
      const normalized = this.#normalize(value);
      if (!normalized.found) return;
      await game.settings.set(MODULE_ID, CACHE_SETTING, {
        raw: structuredClone(value),
        normalized,
        cachedAt: Date.now()
      });
    } catch (error) {
      console.warn(`${MODULE_ID} | Failed to cache Weather Forge context`, error);
    }
  }

  static async getContext() {
    const status = this.status();
    if (!status.active) {
      return this.#buildContext({
        active: false,
        compatible: false,
        source: "manual",
        weather: "auto",
        timeOfDay: "auto",
        season: "auto",
        labelKey: "PF2EATMOSPHEREFORGE.WeatherContext.NotAvailable"
      });
    }

    const direct = await this.#readDirectApi();
    if (direct) {
      const normalized = this.#normalize(direct.weather ?? direct);
      await this.cacheWeatherContext(direct);
      return this.#buildContext({
        active: true,
        compatible: status.compatible,
        source: "weatherForgeApi",
        weather: normalized.weather,
        timeOfDay: normalized.timeOfDay,
        season: normalized.season,
        raw: direct,
        currentWeather: direct.weather ?? direct,
        provenance: direct.provenance ?? null,
        mismatch: Boolean(direct.mismatch),
        labelKey: "PF2EATMOSPHEREFORGE.WeatherContext.Loaded"
      });
    }

    const legacy = this.#readLegacyWeatherState();
    const normalized = this.#normalize(legacy);
    if (normalized.found) await this.cacheWeatherContext(legacy);

    return this.#buildContext({
      active: true,
      compatible: status.compatible,
      source: normalized.found ? "weatherForgeLegacy" : "weatherForgeUnavailable",
      weather: normalized.weather,
      timeOfDay: normalized.timeOfDay,
      season: normalized.season,
      raw: legacy,
      currentWeather: legacy,
      provenance: null,
      mismatch: false,
      labelKey: normalized.found
        ? "PF2EATMOSPHEREFORGE.WeatherContext.LoadedLegacy"
        : "PF2EATMOSPHEREFORGE.WeatherContext.NoData"
    });
  }

  static async #readDirectApi() {
    const api = globalThis.game?.modules?.get?.(WEATHER_FORGE_ID)?.api;
    if (typeof api?.getCurrentWeatherContext !== "function") return null;

    try {
      return await api.getCurrentWeatherContext();
    } catch (error) {
      console.warn(`${MODULE_ID} | Weather Forge direct context failed`, error);
      return null;
    }
  }

  static #readLegacyWeatherState() {
    const candidates = [
      () => game.modules.get(WEATHER_FORGE_ID)?.api?.getCurrentWeather?.(),
      () => game.modules.get(WEATHER_FORGE_ID)?.api?.getWeather?.(),
      () => game.modules.get(WEATHER_FORGE_ID)?.api?.getState?.(),
      () => game.settings.get(WEATHER_FORGE_ID, "weatherState"),
      () => game.settings.get(WEATHER_FORGE_ID, "currentWeather"),
      () => globalThis.PF2eWeatherForge?.currentWeather,
      () => globalThis.PF2eWeatherForge?.getCurrentWeather?.()
    ];

    for (const getter of candidates) {
      try {
        const value = getter();
        if (value && typeof value === "object") return value;
      } catch (_) {
        // Optional compatibility fallback.
      }
    }

    try {
      const cached = game.settings.get(MODULE_ID, CACHE_SETTING);
      return cached?.raw?.weather ?? cached?.raw ?? null;
    } catch (_) {
      return null;
    }
  }

  static #normalize(value) {
    const weather = value?.weather && typeof value.weather === "object"
      ? value.weather
      : value;

    if (!weather || typeof weather !== "object") {
      return { found: false, weather: "auto", timeOfDay: "auto", season: "auto" };
    }

    const mappedWeather = mapWeather(weather);
    const timeOfDay = mapTimeSegment(weather.timeSegment ?? weather.timeOfDay);
    const season = mapSeason(weather.season);

    const found = mappedWeather !== "auto"
      || timeOfDay !== "auto"
      || season !== "auto"
      || Number.isFinite(Number(weather.temperature));

    return {
      found,
      weather: mappedWeather,
      timeOfDay,
      season
    };
  }

  static #buildContext({
    active,
    compatible,
    source,
    weather,
    timeOfDay,
    season = "auto",
    raw = null,
    currentWeather = null,
    provenance = null,
    mismatch = false,
    labelKey
  }) {
    const weatherState = currentWeather && typeof currentWeather === "object"
      ? currentWeather
      : {};

    return Object.freeze({
      active,
      compatible,
      source,
      weather,
      weatherLabel: localize(`PF2EATMOSPHEREFORGE.Weather.${capitalize(weather)}`),
      timeOfDay,
      timeOfDayLabel: localize(`PF2EATMOSPHEREFORGE.TimeOfDay.${capitalize(timeOfDay)}`),
      season,
      seasonLabel: localize(`PF2EATMOSPHEREFORGE.Season.${capitalize(season)}`),
      temperature: finiteOrNull(weatherState.temperature),
      precipitation: weatherState.precipitation ?? null,
      humidity: finiteOrNull(weatherState.humidity),
      cloudDensity: finiteOrNull(weatherState.cloudDensity),
      windStrength: finiteOrNull(weatherState.windStrength),
      extremeWeather: weatherState.extremeWeather ?? null,
      provenance: provenance ? structuredClone(provenance) : null,
      mismatch,
      raw: raw ? structuredClone(raw) : null,
      label: localize(labelKey)
    });
  }
}

export function mapWeather(weather = {}) {
  const extreme = String(weather.extremeWeather?.type ?? "").toLowerCase();
  const precipitation = String(weather.precipitation ?? "").toLowerCase();

  if (extreme === "storm") return "storm";
  if (extreme === "blizzard") return "snow";

  if (["thunderstorm"].includes(precipitation)) return "storm";
  if (["snow", "sleet", "hail"].includes(precipitation)) return "snow";
  if (["mist", "fog"].includes(precipitation)) return "fog";
  if (["rain", "heavyrain", "drizzle", "shower"].includes(precipitation)) return "rain";

  const clouds = Number(weather.cloudDensity);
  if (Number.isFinite(clouds) && clouds >= 65) return "cloudy";
  if (Number.isFinite(clouds)) return "clear";

  return "auto";
}

export function mapTimeSegment(value) {
  const raw = String(value ?? "").toLowerCase();
  return {
    morning: "morning",
    noon: "midday",
    midday: "midday",
    afternoon: "afternoon",
    evening: "evening",
    night: "night"
  }[raw] ?? "auto";
}

export function mapSeason(value) {
  const raw = String(value ?? "").toLowerCase();
  return {
    spring: "spring",
    summer: "summer",
    autumn: "autumn",
    fall: "autumn",
    winter: "winter"
  }[raw] ?? "auto";
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function localize(key) {
  return globalThis.game?.i18n?.localize?.(key) ?? key;
}

function capitalize(value) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
