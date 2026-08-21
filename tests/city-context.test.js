import test from "node:test";
import assert from "node:assert/strict";

import {
  CityContextService,
  deriveEnvironment,
  deriveIntensity,
  buildCityNarrative
} from "../scripts/city-context-service.js";

function installI18n() {
  globalThis.game = {
    i18n: {
      localize: key => ({
        "PF2EATMOSPHEREFORGE.CityNarrative.Mood.poor": "Mood is poor.",
        "PF2EATMOSPHEREFORGE.CityNarrative.Order.poor": "Order is poor.",
        "PF2EATMOSPHEREFORGE.CityNarrative.SecurityMobilized": "Security is mobilized.",
        "PF2EATMOSPHEREFORGE.CityForge.Influence.dominant": "dominant",
        "PF2EATMOSPHEREFORGE.CityForge.Stance.hostile": "hostile"
      }[key] ?? key),
      format: (key, data) => {
        if (key === "PF2EATMOSPHEREFORGE.CityNarrative.Conditions") return `Conditions: ${data.names}.`;
        if (key === "PF2EATMOSPHEREFORGE.CityNarrative.Threats") return `Threats: ${data.names}.`;
        if (key === "PF2EATMOSPHEREFORGE.CityNarrative.Faction") return `Faction ${data.name} (${data.influence}, ${data.stance}).`;
        return key;
      }
    }
  };
}

function context(overrides = {}) {
  return {
    settlement: {
      id: "city",
      name: "Test City",
      type: "town",
      traits: []
    },
    geography: {
      region: "Varisia",
      terrain: "forest"
    },
    scope: {
      district: null,
      location: null
    },
    state: {
      dimensions: {
        prosperity: { value: "normal" },
        supply: { value: "normal" },
        security: { value: "normal" },
        order: { value: "normal" },
        mood: { value: "normal" },
        health: { value: "normal" }
      },
      activeConditions: [],
      activeThreats: []
    },
    civic: {
      legitimacy: "accepted",
      corruption: { level: "low" },
      security: { readiness: "normal" },
      factions: []
    },
    ...overrides
  };
}

test("specific City location type drives environment before settlement type", () => {
  const ctx = context({
    scope: {
      district: { id: "faith", name: "Temple Ward", type: "religious", traits: [] },
      location: { id: "shrine", name: "Shrine", type: "temple", traits: [] }
    }
  });

  assert.equal(deriveEnvironment(ctx), "temple");
});

test("port/dock context derives coast environment", () => {
  const ctx = context({
    scope: {
      district: { id: "harbor", name: "Harbor", type: "docks", traits: [] },
      location: null
    }
  });
  assert.equal(deriveEnvironment(ctx), "coast");
});

test("settlement type is the fallback for civilized places", () => {
  assert.equal(deriveEnvironment(context({ settlement: { type: "village", traits: [] } })), "village");
  assert.equal(deriveEnvironment(context({ settlement: { type: "metropolis", traits: [] } })), "city");
});

test("unstable settlement state raises suggested intensity transparently", () => {
  const ctx = context({
    state: {
      dimensions: {
        prosperity: { value: "normal" },
        supply: { value: "normal" },
        security: { value: "normal" },
        order: { value: "normal" },
        mood: { value: "normal" },
        health: { value: "normal" }
      },
      activeConditions: [{ id: "siege", label: "Siege", severity: "severe" }],
      activeThreats: [{ id: "raiders", name: "Raiders" }]
    },
    civic: {
      legitimacy: "fragile",
      corruption: { level: "high" },
      security: { readiness: "mobilized" },
      factions: [{
        id: "rebels",
        name: "Rebels",
        effectiveInfluence: "dominant",
        effectiveStance: "hostile"
      }]
    }
  });

  const result = deriveIntensity(ctx);
  assert.equal(result.value, 99);
  assert.ok(result.reasons.some(entry => entry.type === "condition"));
  assert.ok(result.reasons.some(entry => entry.type === "faction"));
});

test("positive state can lower atmosphere intensity", () => {
  const ctx = context({
    state: {
      dimensions: {
        prosperity: { value: "very-good" },
        supply: { value: "very-good" },
        security: { value: "very-good" },
        order: { value: "very-good" },
        mood: { value: "very-good" },
        health: { value: "very-good" }
      },
      activeConditions: [],
      activeThreats: []
    }
  });
  assert.ok(deriveIntensity(ctx).value < 25);
});

test("City narrative includes state, named conditions/threats and hostile faction pressure", () => {
  installI18n();
  const ctx = context({
    state: {
      dimensions: {
        prosperity: { value: "normal" },
        supply: { value: "normal" },
        security: { value: "normal" },
        order: { value: "poor" },
        mood: { value: "poor" },
        health: { value: "normal" }
      },
      activeConditions: [{ id: "siege", label: "Siege", severity: "moderate" }],
      activeThreats: [{ id: "raiders", name: "Raiders" }]
    },
    civic: {
      legitimacy: "accepted",
      corruption: { level: "low" },
      security: { readiness: "mobilized" },
      factions: [{
        id: "rebels",
        name: "Rebels",
        effectiveInfluence: "dominant",
        effectiveStance: "hostile"
      }]
    }
  });

  const text = buildCityNarrative(ctx);
  assert.match(text, /Mood is poor/);
  assert.match(text, /Conditions: Siege/);
  assert.match(text, /Threats: Raiders/);
  assert.match(text, /Faction Rebels/);
});

test("manual source mode never consumes City Forge context", async () => {
  globalThis.game = {
    settings: { get: () => "manual" },
    modules: new Map()
  };
  const result = await CityContextService.getContext({ sourceMode: "manual" });
  assert.equal(result.source, "manual");
  assert.equal(result.context, null);
});
