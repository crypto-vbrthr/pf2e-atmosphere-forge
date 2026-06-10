import { PF2eAtmosphereForgeApp } from "./atmosphere-forge-app.js";
import { AtmosphereService } from "./atmosphere-service.js";
import { WeatherContextService } from "./weather-context-service.js";

const MODULE_ID = "pf2e-atmosphere-forge";
const TOOL_NAME = "pf2e-atmosphere-forge";

class PF2eAtmosphereForge {
  static ID = MODULE_ID;

  static async initialize() {
    console.log(`${MODULE_ID} | Initializing`);
    WeatherContextService.registerSettings();
    await AtmosphereService.initialize();
  }

  static openApp() {
    new PF2eAtmosphereForgeApp().render(true);
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
      console.log(`${MODULE_ID} | Registered regions tool using array API.`);
      return;
    }

    if (regions.tools && typeof regions.tools === "object") {
      if (regions.tools[TOOL_NAME]) return;
      regions.tools[TOOL_NAME] = tool;
      console.log(`${MODULE_ID} | Registered regions tool using object API.`);
      return;
    }

    regions.tools = [tool];
    console.log(`${MODULE_ID} | Registered regions tool after creating tools array.`);
  }

  static #findRegionsControl(controls) {
    if (!controls) return null;

    if (Array.isArray(controls)) {
      return controls.find((control) => control.name === "regions");
    }

    if (controls.regions) return controls.regions;

    return Object.values(controls).find((control) => control?.name === "regions") ?? null;
  }
}

Hooks.once("init", () => {
  PF2eAtmosphereForge.initialize();
});

Hooks.on("getSceneControlButtons", (controls) => {
  PF2eAtmosphereForge.registerRegionControl(controls);
});

globalThis.PF2eAtmosphereForge = PF2eAtmosphereForge;


Hooks.on("pf2e-weather-forge.weatherUpdated", (weatherData) => {
  WeatherContextService.cacheWeatherContext(weatherData);
});

Hooks.on("pf2e-weather-forge.forecastUpdated", (weatherData) => {
  WeatherContextService.cacheWeatherContext(weatherData);
});

Hooks.on("pf2eWeatherForgeWeatherUpdated", (weatherData) => {
  WeatherContextService.cacheWeatherContext(weatherData);
});

Hooks.on("pf2eWeatherForgeForecastUpdated", (weatherData) => {
  WeatherContextService.cacheWeatherContext(weatherData);
});
