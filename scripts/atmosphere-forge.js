import { PF2eAtmosphereForgeApp } from "./atmosphere-forge-app.js";
import { AtmosphereService } from "./atmosphere-service.js";
import { WeatherContextService } from "./weather-context-service.js";
import { CityContextService } from "./city-context-service.js";

const MODULE_ID = "pf2e-atmosphere-forge";
const TOOL_NAME = "pf2e-atmosphere-forge";

class PF2eAtmosphereForge {
  static ID = MODULE_ID;
  static #app = null;

  static async initialize() {
    console.log(`${MODULE_ID} | Initializing`);
    WeatherContextService.registerSettings();
    CityContextService.registerSettings();
    await AtmosphereService.initialize();
  }

  static openApp() {
    if (!this.#app) this.#app = new PF2eAtmosphereForgeApp();
    this.#app.render(true);
    return this.#app;
  }

  static refreshApp() {
    if (this.#app?.rendered) this.#app.render({ force: true });
  }

  static registerRegionControl(controls) {
    const regions = this.#findRegionsControl(controls);
    if (!regions) {
      console.warn(`${MODULE_ID} | Regions scene control was not found.`);
      return;
    }

    const tool = {
      name: TOOL_NAME,
      title: "PF2EATMOSPHEREFORGE.Controls.Open",
      icon: "fa-solid fa-smog",
      button: true,
      visible: game.user?.isGM ?? false,
      onClick: () => this.openApp(),
      onChange: () => this.openApp()
    };

    if (Array.isArray(regions.tools)) {
      if (regions.tools.some((existingTool) => existingTool.name === TOOL_NAME)) return;
      regions.tools.push(tool);
      return;
    }

    if (regions.tools && typeof regions.tools === "object") {
      if (regions.tools[TOOL_NAME]) return;
      regions.tools[TOOL_NAME] = tool;
      return;
    }

    regions.tools = [tool];
  }

  static #findRegionsControl(controls) {
    if (!controls) return null;
    if (Array.isArray(controls)) return controls.find((control) => control.name === "regions");
    if (controls.regions) return controls.regions;
    return Object.values(controls).find((control) => control?.name === "regions") ?? null;
  }
}

Hooks.once("init", () => {
  void PF2eAtmosphereForge.initialize();
});

Hooks.once("ready", () => {
  const module = game.modules.get(MODULE_ID);
  if (module) {
    module.api = Object.freeze({
      version: 1,
      capabilities: Object.freeze({
        cityForge: true,
        weatherForge: true,
        activeSceneContext: true,
        settlementContext: true,
        derivedEnvironment: true,
        derivedIntensity: true
      }),
      open: () => PF2eAtmosphereForge.openApp(),
      city: Object.freeze({
        status: () => CityContextService.status(),
        listSettlements: () => CityContextService.listSettlements(),
        getContext: (options = {}) => CityContextService.getContext(options)
      }),
      weather: Object.freeze({
        status: () => WeatherContextService.status(),
        getContext: () => WeatherContextService.getContext()
      }),
      generate: (options = {}) => AtmosphereService.generate(options)
    });
  }

  Hooks.callAll("pf2eAtmosphereForge.ready", module?.api ?? null);
});

Hooks.on("getSceneControlButtons", (controls) => {
  PF2eAtmosphereForge.registerRegionControl(controls);
});

Hooks.on("canvasReady", () => {
  PF2eAtmosphereForge.refreshApp();
});

for (const hook of [
  "pf2eCityForge.ready",
  "pf2eCityForge.integrationReady",
  "pf2eCityForge.settlementCreated",
  "pf2eCityForge.settlementUpdated",
  "pf2eCityForge.settlementDeleted",
  "pf2eCityForge.statePatched"
]) {
  Hooks.on(hook, () => {
    PF2eAtmosphereForge.refreshApp();
  });
}

Hooks.on("updateSetting", (setting) => {
  const key = String(setting?.key ?? "");
  if (key.startsWith("pf2e-weather-forge.")) PF2eAtmosphereForge.refreshApp();
});

// Legacy Weather Forge hook compatibility.
for (const hook of [
  "pf2e-weather-forge.weatherUpdated",
  "pf2e-weather-forge.forecastUpdated",
  "pf2eWeatherForgeWeatherUpdated",
  "pf2eWeatherForgeForecastUpdated"
]) {
  Hooks.on(hook, (weatherData) => {
    void WeatherContextService.cacheWeatherContext(weatherData);
    PF2eAtmosphereForge.refreshApp();
  });
}

globalThis.PF2eAtmosphereForge = PF2eAtmosphereForge;
