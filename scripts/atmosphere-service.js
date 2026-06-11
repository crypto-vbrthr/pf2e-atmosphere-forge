const MODULE_ID = "pf2e-atmosphere-forge";

export class AtmosphereService {
  static #data = new Map();
  static #environments = ["forest", "city", "dungeon", "wilderness", "village", "ruin", "cave", "temple", "coast", "mountain", "swamp"];

  static async initialize() {
    await this.#loadAtmosphereData();
  }

  static getAvailableEnvironments() {
    return this.#environments.map((id) => ({
      id,
      label: game.i18n.localize(`PF2EATMOSPHEREFORGE.Environment.${this.#capitalize(id)}`)
    }));
  }

  static getWeatherOptions() {
    return ["auto", "clear", "cloudy", "rain", "storm", "fog", "snow"].map((id) => ({
      id,
      label: game.i18n.localize(`PF2EATMOSPHEREFORGE.Weather.${this.#capitalize(id)}`)
    }));
  }

  static getTimeOfDayOptions() {
    return ["auto", "morning", "midday", "afternoon", "evening", "night"].map((id) => ({
      id,
      label: game.i18n.localize(`PF2EATMOSPHEREFORGE.TimeOfDay.${this.#capitalize(id)}`)
    }));
  }

  static getSeasonOptions() {
    return ["auto", "spring", "summer", "autumn", "winter"].map((id) => ({
      id,
      label: game.i18n.localize(`PF2EATMOSPHEREFORGE.Season.${this.#capitalize(id)}`)
    }));
  }

  static async generate({ environment = "forest", intensity = 50, useWeather = false, weather = "auto", useTimeOfDay = false, timeOfDay = "auto", useSeason = false, season = "auto" } = {}) {
    if (!this.#data.size) await this.#loadAtmosphereData();

    const intensityKey = this.#getIntensityKey(Number(intensity));
    const atmosphere = this.#data.get(environment) ?? this.#data.get("forest");

    const selectedKeys = {
      atmosphere: this.#pick(atmosphere?.[intensityKey]?.atmosphere),
      sound: this.#pick(atmosphere?.[intensityKey]?.sound),
      smell: this.#pick(atmosphere?.[intensityKey]?.smell),
      weather: useWeather ? this.#pick(atmosphere?.weather?.[weather]) : "",
      timeOfDay: useTimeOfDay ? this.#pick(atmosphere?.timeOfDay?.[timeOfDay]) : "",
      season: useSeason ? this.#pick(atmosphere?.season?.[season]) : "",
      detail: this.#pickDetail(atmosphere, intensityKey)
    };

    const sections = [
      {
        id: "atmosphere",
        icon: "fa-solid fa-smog",
        label: game.i18n.localize("PF2EATMOSPHEREFORGE.Section.Atmosphere"),
        text: this.#localizeKey(selectedKeys.atmosphere)
      },
      {
        id: "sound",
        icon: "fa-solid fa-volume-high",
        label: game.i18n.localize("PF2EATMOSPHEREFORGE.Section.Sound"),
        text: this.#localizeKey(selectedKeys.sound)
      },
      {
        id: "smell",
        icon: "fa-solid fa-wind",
        label: game.i18n.localize("PF2EATMOSPHEREFORGE.Section.Smell"),
        text: this.#localizeKey(selectedKeys.smell)
      },
      {
        id: "weather",
        icon: "fa-solid fa-cloud",
        label: game.i18n.localize("PF2EATMOSPHEREFORGE.Section.Weather"),
        text: this.#localizeKey(selectedKeys.weather)
      },
      {
        id: "timeOfDay",
        icon: "fa-solid fa-clock",
        label: game.i18n.localize("PF2EATMOSPHEREFORGE.Section.TimeOfDay"),
        text: this.#localizeKey(selectedKeys.timeOfDay)
      },
      {
        id: "season",
        icon: "fa-solid fa-leaf",
        label: game.i18n.localize("PF2EATMOSPHEREFORGE.Section.Season"),
        text: this.#localizeKey(selectedKeys.season)
      },
      {
        id: "detail",
        icon: "fa-solid fa-eye",
        label: game.i18n.localize("PF2EATMOSPHEREFORGE.Section.Detail"),
        text: this.#localizeKey(selectedKeys.detail)
      }
    ].filter((section) => Boolean(section.text));

    const text = sections
      .map((section) => `${section.label}\n${section.text}`)
      .join("\n\n");

    const sceneParameters = {
      useWeather: Boolean(useWeather),
      weather,
      weatherLabel: game.i18n.localize(`PF2EATMOSPHEREFORGE.Weather.${this.#capitalize(weather)}`),
      useTimeOfDay: Boolean(useTimeOfDay),
      timeOfDay,
      timeOfDayLabel: game.i18n.localize(`PF2EATMOSPHEREFORGE.TimeOfDay.${this.#capitalize(timeOfDay)}`),
      useSeason: Boolean(useSeason),
      season,
      seasonLabel: game.i18n.localize(`PF2EATMOSPHEREFORGE.Season.${this.#capitalize(season)}`)
    };

    return {
      environment,
      intensity,
      intensityKey,
      environmentLabel: game.i18n.localize(`PF2EATMOSPHEREFORGE.Environment.${this.#capitalize(environment)}`),
      intensityLabel: game.i18n.localize(`PF2EATMOSPHEREFORGE.Intensity.${intensityKey}`),
      sections,
      selectedKeys,
      sceneParameters,
      text: text || game.i18n.localize("PF2EATMOSPHEREFORGE.Preview.GenerationFailed")
    };
  }


  static async rerollSection(previousResult, sectionId) {
    if (!previousResult) return null;
    if (!this.#data.size) await this.#loadAtmosphereData();

    const environment = previousResult.environment ?? "forest";
    const intensityKey = previousResult.intensityKey ?? this.#getIntensityKey(Number(previousResult.intensity ?? 50));
    const atmosphere = this.#data.get(environment) ?? this.#data.get("forest");
    const sceneParameters = previousResult.sceneParameters ?? {};

    const keyPath = {
      atmosphere: atmosphere?.[intensityKey]?.atmosphere,
      sound: atmosphere?.[intensityKey]?.sound,
      smell: atmosphere?.[intensityKey]?.smell,
      weather: sceneParameters.useWeather ? atmosphere?.weather?.[sceneParameters.weather] : [],
      timeOfDay: sceneParameters.useTimeOfDay ? atmosphere?.timeOfDay?.[sceneParameters.timeOfDay] : [],
      season: sceneParameters.useSeason ? atmosphere?.season?.[sceneParameters.season] : [],
      detail: null
    }[sectionId];

    const newKey = sectionId === "detail"
      ? this.#pickDetail(atmosphere, intensityKey)
      : this.#pick(keyPath);
    const newText = this.#localizeKey(newKey);
    if (!newText) return previousResult;

    const updatedSections = previousResult.sections.map((section) => {
      if (section.id !== sectionId) return section;
      return { ...section, text: newText };
    });

    const text = updatedSections
      .map((section) => `${section.label}\n${section.text}`)
      .join("\n\n");

    return {
      ...previousResult,
      sections: updatedSections,
      selectedKeys: {
        ...previousResult.selectedKeys,
        [sectionId]: newKey
      },
      text
    };
  }


  static #pickDetail(atmosphere, intensityKey) {
    const detailData = atmosphere?.[intensityKey]?.detail;

    if (Array.isArray(detailData)) {
      return this.#pick(detailData);
    }

    if (detailData && typeof detailData === "object") {
      const pools = Object.values(detailData)
        .filter((pool) => Array.isArray(pool) && pool.length);

      if (pools.length) {
        return this.#pick(this.#pick(pools));
      }
    }

    return "";
  }

  static async #loadAtmosphereData() {
    this.#data.clear();

    for (const environment of this.#environments) {
      try {
        const response = await fetch(`modules/${MODULE_ID}/data/atmospheres/${environment}.json`);
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

        const data = await response.json();
        this.#data.set(environment, data);
      } catch (error) {
        console.error(`${MODULE_ID} | Failed to load atmosphere data for "${environment}"`, error);
      }
    }
  }

  static #getIntensityKey(intensity) {
    if (intensity < 25) return "calm";
    if (intensity < 60) return "normal";
    if (intensity < 85) return "tense";
    return "nightmare";
  }

  static #pick(values) {
    if (!Array.isArray(values) || !values.length) return "";
    return values[Math.floor(Math.random() * values.length)];
  }

  static #localizeKey(key) {
    if (!key) return "";
    const localized = game.i18n.localize(key);
    return localized === key ? "" : localized;
  }

  static #capitalize(value) {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
