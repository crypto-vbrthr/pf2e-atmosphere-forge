import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../scripts/atmosphere-forge-app.js", import.meta.url), "utf8");
const main = fs.readFileSync(new URL("../scripts/atmosphere-forge.js", import.meta.url), "utf8");
const template = fs.readFileSync(new URL("../templates/atmosphere-forge.hbs", import.meta.url), "utf8");
const chat = fs.readFileSync(new URL("../templates/chat-message.hbs", import.meta.url), "utf8");

test("Atmosphere Forge exposes City source and explicit settlement controls", () => {
  assert.match(template, /name="citySourceMode"/);
  assert.match(template, /name="citySettlementId"/);
  assert.match(app, /CityContextService\.listSettlements/);
  assert.match(app, /citySettlementId", settlementId/);
});

test("City environment, intensity and local-context output are individually optional", () => {
  assert.match(template, /name="useCityEnvironment"/);
  assert.match(template, /name="useCityIntensity"/);
  assert.match(template, /name="includeCityContext"/);
  assert.match(app, /city\.derivedEnvironment/);
  assert.match(app, /city\.suggestedIntensity/);
});

test("City local context is displayed but has no reroll button", () => {
  assert.match(template, /if this\.rerollable/);
  assert.match(template, /atmosphere-forge-section-/);
});

test("chat output carries City settlement provenance", () => {
  assert.match(chat, /cityContextMeta/);
  assert.match(chat, /cityContextMeta\.settlementName/);
});

test("public API advertises City and Weather integrations", () => {
  assert.match(main, /cityForge:\s*true/);
  assert.match(main, /weatherForge:\s*true/);
  assert.match(main, /derivedEnvironment:\s*true/);
  assert.match(main, /derivedIntensity:\s*true/);
  assert.match(main, /pf2eAtmosphereForge\.ready/);
});

test("open app rerenders on Scene, City and Weather changes", () => {
  assert.match(main, /Hooks\.on\("canvasReady"/);
  assert.match(main, /pf2eCityForge\.settlementUpdated/);
  assert.match(main, /pf2eCityForge\.statePatched/);
  assert.match(main, /updateSetting/);
});
