const MODULE_ID = "pf2e-atmosphere-forge";

export class AtmosphereService {
  static #data = new Map();
  static #environments = ["forest", "city", "dungeon", "wilderness"];

  static async initialize() {
    await this.#loadAtmosphereData();
  }

  static getAvailableEnvironments() {
    return this.#environments.map((id) => ({
      id,
      label: game.i18n.localize(`PF2EATMOSPHEREFORGE.Environment.${this.#capitalize(id)}`)
    }));
  }

  static async generate({ environment = "forest", intensity = 50 } = {}) {
    if (!this.#data.size) await this.#loadAtmosphereData();

    const intensityKey = this.#getIntensityKey(Number(intensity));
    const atmosphere = this.#data.get(environment) ?? this.#data.get("forest");

    const selectedKeys = {
      atmosphere: this.#pick(atmosphere?.[intensityKey]?.atmosphere),
      sound: this.#pick(atmosphere?.[intensityKey]?.sound),
      detail: this.#pick(atmosphere?.[intensityKey]?.detail)
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
        id: "detail",
        icon: "fa-solid fa-eye",
        label: game.i18n.localize("PF2EATMOSPHEREFORGE.Section.Detail"),
        text: this.#localizeKey(selectedKeys.detail)
      }
    ].filter((section) => Boolean(section.text));

    const text = sections
      .map((section) => `${section.label}\n${section.text}`)
      .join("\n\n");

    return {
      environment,
      intensity,
      intensityKey,
      environmentLabel: game.i18n.localize(`PF2EATMOSPHEREFORGE.Environment.${this.#capitalize(environment)}`),
      intensityLabel: game.i18n.localize(`PF2EATMOSPHEREFORGE.Intensity.${intensityKey}`),
      sections,
      selectedKeys,
      text: text || game.i18n.localize("PF2EATMOSPHEREFORGE.Preview.GenerationFailed")
    };
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
