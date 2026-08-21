import test from "node:test";
import assert from "node:assert/strict";

import {
  WeatherContextService,
  mapWeather,
  mapTimeSegment,
  mapSeason
} from "../scripts/weather-context-service.js";

function i18n() {
  return {
    localize: key => key
  };
}

test("Weather Forge precipitation maps to Atmosphere Forge categories", () => {
  assert.equal(mapWeather({ precipitation: "thunderstorm" }), "storm");
  assert.equal(mapWeather({ precipitation: "heavyRain" }), "rain");
  assert.equal(mapWeather({ precipitation: "mist" }), "fog");
  assert.equal(mapWeather({ precipitation: "snow" }), "snow");
  assert.equal(mapWeather({ precipitation: "none", cloudDensity: 80 }), "cloudy");
  assert.equal(mapWeather({ precipitation: "none", cloudDensity: 20 }), "clear");
});

test("Weather Forge dayparts and seasons normalize directly", () => {
  assert.equal(mapTimeSegment("noon"), "midday");
  assert.equal(mapTimeSegment("evening"), "evening");
  assert.equal(mapSeason("autumn"), "autumn");
  assert.equal(mapSeason("fall"), "autumn");
});

test("Atmosphere Forge prefers Weather Forge 1.1.x current-weather API", async () => {
  const weatherApi = {
    async getCurrentWeatherContext() {
      return {
        weather: {
          precipitation: "heavyRain",
          cloudDensity: 90,
          temperature: 17,
          humidity: 85,
          windStrength: 4,
          timeSegment: "evening",
          season: "autumn"
        },
        provenance: { settlementId: "port" },
        mismatch: false
      };
    }
  };

  globalThis.game = {
    i18n: i18n(),
    user: { isGM: true },
    modules: new Map([
      ["pf2e-weather-forge", { active: true, version: "1.1.3", api: weatherApi }]
    ]),
    settings: {
      set: async () => {},
      get: () => null,
      settings: new Map()
    }
  };

  const result = await WeatherContextService.getContext();
  assert.equal(result.source, "weatherForgeApi");
  assert.equal(result.weather, "rain");
  assert.equal(result.timeOfDay, "evening");
  assert.equal(result.season, "autumn");
  assert.equal(result.temperature, 17);
  assert.equal(result.provenance.settlementId, "port");
});
