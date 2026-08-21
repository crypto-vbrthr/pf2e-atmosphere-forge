const MODULE_ID = "pf2e-atmosphere-forge";
const CITY_FORGE_ID = "pf2e-city-forge";

export const CITY_SOURCE_MODES = Object.freeze(["scene", "settlement", "manual"]);

const INFLUENCE_RANK = Object.freeze({
  minor: 0,
  local: 1,
  significant: 2,
  major: 3,
  dominant: 4
});

export class CityContextService {
  static registerSettings() {
    register("citySourceMode", {
      name: "PF2EATMOSPHEREFORGE.CityForge.SourceLabel",
      scope: "world",
      config: false,
      type: String,
      default: "scene",
      choices: {
        scene: "PF2EATMOSPHEREFORGE.CityForge.SourceScene",
        settlement: "PF2EATMOSPHEREFORGE.CityForge.SourceSettlement",
        manual: "PF2EATMOSPHEREFORGE.CityForge.SourceManual"
      }
    });

    register("citySettlementId", {
      name: "PF2EATMOSPHEREFORGE.CityForge.Settlement",
      scope: "world",
      config: false,
      type: String,
      default: ""
    });
  }

  static status() {
    const module = globalThis.game?.modules?.get?.(CITY_FORGE_ID) ?? null;
    const api = module?.active ? module.api : null;
    const sceneCompatible = Boolean(
      api?.integrations && typeof api.integrations.getContextForScene === "function"
    );
    const settlementCompatible = Boolean(
      api?.settlements
      && typeof api.settlements.list === "function"
      && api?.integrations?.atmosphere
      && typeof api.integrations.atmosphere.getContext === "function"
    );

    return Object.freeze({
      installed: Boolean(module),
      active: Boolean(module?.active),
      compatible: sceneCompatible || settlementCompatible,
      sceneCompatible,
      settlementCompatible,
      version: module?.version ?? module?.manifest?.version ?? null
    });
  }

  static sourceMode() {
    const raw = safeGet("citySourceMode", "scene");
    return CITY_SOURCE_MODES.includes(raw) ? raw : "scene";
  }

  static settlementId() {
    return String(safeGet("citySettlementId", "") ?? "").trim();
  }

  static activeSceneUuid() {
    return globalThis.canvas?.scene?.uuid
      ?? globalThis.game?.scenes?.current?.uuid
      ?? null;
  }

  static async listSettlements() {
    const api = this.#api();
    if (typeof api?.settlements?.list !== "function") return [];

    try {
      const settlements = await api.settlements.list();
      return settlements
        .map((entry) => ({
          id: entry.id,
          name: entry.definition?.identity?.name ?? entry.id,
          region: entry.definition?.geography?.region ?? "",
          type: entry.definition?.identity?.type ?? "",
          level: entry.definition?.identity?.level ?? 0
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.warn(`${MODULE_ID} | Could not list City Forge settlements`, error);
      return [];
    }
  }

  static async getContext({
    sourceMode = this.sourceMode(),
    settlementId = this.settlementId(),
    sceneUuid = this.activeSceneUuid()
  } = {}) {
    const mode = CITY_SOURCE_MODES.includes(sourceMode) ? sourceMode : "scene";
    const status = this.status();

    if (mode === "manual") {
      return freeze({
        sourceMode: mode,
        source: "manual",
        reason: "manual-mode",
        status,
        context: null,
        derivedEnvironment: null,
        suggestedIntensity: null,
        intensityReasons: [],
        summary: ""
      });
    }

    if (!status.active) {
      return this.#fallback(mode, "city-unavailable", status);
    }

    let context = null;
    if (mode === "settlement") {
      if (!settlementId) return this.#fallback(mode, "settlement-unselected", status);
      if (!status.settlementCompatible) return this.#fallback(mode, "city-api-incompatible", status);
      try {
        context = await this.#api().integrations.atmosphere.getContext(settlementId);
      } catch (error) {
        console.warn(`${MODULE_ID} | City Forge settlement atmosphere context failed`, error);
      }
      if (!context) return this.#fallback(mode, "settlement-not-found", status);
    } else {
      if (!sceneUuid) return this.#fallback(mode, "no-active-scene", status);
      if (!status.sceneCompatible) return this.#fallback(mode, "city-api-incompatible", status);
      try {
        context = await this.#api().integrations.getContextForScene(sceneUuid, "atmosphere");
      } catch (error) {
        console.warn(`${MODULE_ID} | City Forge Scene atmosphere context failed`, error);
      }
      if (!context) return this.#fallback(mode, "scene-unlinked", status);
    }

    const derivedEnvironment = deriveEnvironment(context);
    const intensity = deriveIntensity(context);
    const summary = buildCityNarrative(context);

    return freeze({
      sourceMode: mode,
      source: "cityForge",
      reason: mode === "scene" ? "city-scene" : "city-settlement",
      status,
      context,
      derivedEnvironment,
      suggestedIntensity: intensity.value,
      intensityReasons: intensity.reasons,
      summary
    });
  }

  static deriveEnvironment(context) {
    return deriveEnvironment(context);
  }

  static deriveIntensity(context) {
    return deriveIntensity(context);
  }

  static buildNarrative(context) {
    return buildCityNarrative(context);
  }

  static #api() {
    const module = globalThis.game?.modules?.get?.(CITY_FORGE_ID);
    return module?.active ? module.api : null;
  }

  static #fallback(sourceMode, reason, status) {
    return freeze({
      sourceMode,
      source: "manual",
      reason,
      status,
      context: null,
      derivedEnvironment: null,
      suggestedIntensity: null,
      intensityReasons: [],
      summary: ""
    });
  }
}

export function deriveEnvironment(context) {
  const location = context?.scope?.location ?? null;
  const district = context?.scope?.district ?? null;
  const settlement = context?.settlement ?? {};
  const geography = context?.geography ?? {};

  const placeTokens = [
    location?.type,
    ...(location?.traits ?? []),
    district?.type,
    ...(district?.traits ?? [])
  ]
    .filter(Boolean)
    .map((value) => normalize(value));

  const placeText = ` ${placeTokens.join(" ")} `;

  const mappings = [
    ["temple", ["temple", "shrine", "church", "cathedral", "heiligtum", "tempel", "kirche"]],
    ["cave", ["cave", "cavern", "mine", "höhle", "hohle", "stollen"]],
    ["ruin", ["ruin", "ruins", "ruine", "ruinen"]],
    ["dungeon", ["dungeon", "sewer", "catacomb", "crypt", "kanal", "katakombe", "gruft"]],
    ["coast", ["coast", "coastal", "harbor", "harbour", "port", "dock", "docks", "shore", "küste", "kuste", "hafen", "kai"]],
    ["mountain", ["mountain", "alpine", "highland", "gebirge", "berg", "alpin"]],
    ["swamp", ["swamp", "marsh", "wetland", "sumpf", "moor"]],
    ["forest", ["forest", "wood", "woodland", "wald"]],
    ["wilderness", ["wilderness", "plains", "grassland", "steppe", "wildnis"]]
  ];

  // A specific district/location can override the general civilized settlement type.
  for (const [environment, aliases] of mappings) {
    if (aliases.some((alias) => placeText.includes(` ${normalize(alias)} `))) return environment;
  }

  // Otherwise a civilized settlement is primarily experienced as village/city,
  // even when the surrounding terrain is forest, mountain, or swamp.
  if (["hamlet", "village"].includes(settlement.type)) return "village";
  if (["town", "metropolis"].includes(settlement.type)) return "city";

  const terrainText = ` ${normalize(geography.terrain)} `;
  for (const [environment, aliases] of mappings) {
    if (aliases.some((alias) => terrainText.includes(` ${normalize(alias)} `))) return environment;
  }

  return "city";
}

export function deriveIntensity(context) {
  let score = 48;
  const reasons = [];
  const dimensions = context?.state?.dimensions ?? {};

  const weights = {
    prosperity: 4,
    supply: 6,
    security: 10,
    order: 12,
    mood: 10,
    health: 8
  };

  for (const [key, weight] of Object.entries(weights)) {
    const value = dimensions[key]?.value ?? "normal";
    const delta = statePressure(value);
    if (!delta) continue;
    score += delta * weight;
    reasons.push({ type: "dimension", key, value, delta });
  }

  for (const condition of context?.state?.activeConditions ?? []) {
    const add = {
      minor: 3,
      moderate: 7,
      severe: 12,
      extreme: 18
    }[condition.severity] ?? 5;
    score += add;
    reasons.push({
      type: "condition",
      id: condition.id,
      label: condition.label || condition.type,
      severity: condition.severity,
      delta: add
    });
  }

  const threats = context?.state?.activeThreats ?? [];
  if (threats.length) {
    const add = Math.min(18, 7 + Math.max(0, threats.length - 1) * 4);
    score += add;
    reasons.push({ type: "threats", count: threats.length, delta: add });
  }

  const security = context?.civic?.security ?? {};
  if (security.readiness === "mobilized") {
    score += 8;
    reasons.push({ type: "security", key: "mobilized", delta: 8 });
  } else if (security.readiness === "high") {
    score += 3;
    reasons.push({ type: "security", key: "high", delta: 3 });
  }

  const legitimacy = context?.civic?.legitimacy;
  if (legitimacy === "contested") {
    score += 6;
    reasons.push({ type: "legitimacy", key: legitimacy, delta: 6 });
  } else if (legitimacy === "fragile") {
    score += 10;
    reasons.push({ type: "legitimacy", key: legitimacy, delta: 10 });
  } else if (legitimacy === "coercive") {
    score += 5;
    reasons.push({ type: "legitimacy", key: legitimacy, delta: 5 });
  }

  const corruption = context?.civic?.corruption?.level;
  if (corruption === "high") {
    score += 4;
    reasons.push({ type: "corruption", key: corruption, delta: 4 });
  } else if (corruption === "pervasive") {
    score += 8;
    reasons.push({ type: "corruption", key: corruption, delta: 8 });
  }

  const faction = mostPressuringFaction(context?.civic?.factions ?? []);
  if (faction) {
    const rank = INFLUENCE_RANK[faction.effectiveInfluence] ?? 0;
    const add = faction.effectiveStance === "hostile"
      ? Math.max(4, rank * 2 + 2)
      : Math.max(2, rank + 1);
    score += add;
    reasons.push({
      type: "faction",
      id: faction.id,
      name: faction.name,
      stance: faction.effectiveStance,
      influence: faction.effectiveInfluence,
      delta: add
    });
  }

  return {
    value: Math.max(0, Math.min(100, Math.round(score))),
    reasons
  };
}

export function buildCityNarrative(context) {
  if (!context) return "";
  const parts = [];
  const dimensions = context.state?.dimensions ?? {};

  pushDimension(parts, "Mood", dimensions.mood?.value);
  pushDimension(parts, "Order", dimensions.order?.value);
  pushDimension(parts, "Security", dimensions.security?.value);
  pushDimension(parts, "Health", dimensions.health?.value);

  const conditions = (context.state?.activeConditions ?? [])
    .map((entry) => entry.label || entry.type)
    .filter(Boolean);
  if (conditions.length) {
    parts.push(format("PF2EATMOSPHEREFORGE.CityNarrative.Conditions", {
      names: conditions.join(", ")
    }));
  }

  const threats = (context.state?.activeThreats ?? [])
    .map((entry) => entry.name)
    .filter(Boolean);
  if (threats.length) {
    parts.push(format("PF2EATMOSPHEREFORGE.CityNarrative.Threats", {
      names: threats.join(", ")
    }));
  }

  const security = context.civic?.security ?? {};
  if (security.readiness === "mobilized") {
    parts.push(localize("PF2EATMOSPHEREFORGE.CityNarrative.SecurityMobilized"));
  }

  const faction = mostPressuringFaction(context.civic?.factions ?? []);
  if (faction) {
    parts.push(format("PF2EATMOSPHEREFORGE.CityNarrative.Faction", {
      name: faction.name,
      influence: localize(`PF2EATMOSPHEREFORGE.CityForge.Influence.${faction.effectiveInfluence}`),
      stance: localize(`PF2EATMOSPHEREFORGE.CityForge.Stance.${faction.effectiveStance}`)
    }));
  }

  return parts.filter(Boolean).join(" ");
}

function pushDimension(parts, dimension, value) {
  if (!value || value === "normal") return;
  const key = `PF2EATMOSPHEREFORGE.CityNarrative.${dimension}.${value}`;
  const text = localize(key);
  if (text !== key) parts.push(text);
}

function statePressure(value) {
  return {
    "very-poor": 2,
    poor: 1,
    normal: 0,
    good: -0.5,
    "very-good": -1
  }[value] ?? 0;
}

function mostPressuringFaction(factions) {
  return [...factions]
    .filter((entry) => ["opposed", "hostile"].includes(entry.effectiveStance))
    .sort((a, b) =>
      (INFLUENCE_RANK[b.effectiveInfluence] ?? 0)
      - (INFLUENCE_RANK[a.effectiveInfluence] ?? 0)
    )[0] ?? null;
}

function register(key, config) {
  try {
    if (globalThis.game?.settings?.settings?.has?.(`${MODULE_ID}.${key}`)) return;
    globalThis.game?.settings?.register?.(MODULE_ID, key, config);
  } catch (error) {
    console.warn(`${MODULE_ID} | Could not register setting ${key}`, error);
  }
}

function safeGet(key, fallback) {
  try {
    return globalThis.game?.settings?.get?.(MODULE_ID, key) ?? fallback;
  } catch (_) {
    return fallback;
  }
}

function localize(key) {
  return globalThis.game?.i18n?.localize?.(key) ?? key;
}

function format(key, data) {
  return globalThis.game?.i18n?.format?.(key, data) ?? key;
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("ß", "ss")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}
