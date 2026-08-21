import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const de = JSON.parse(fs.readFileSync(new URL("../lang/de.json", import.meta.url), "utf8"));
const en = JSON.parse(fs.readFileSync(new URL("../lang/en.json", import.meta.url), "utf8"));
const template = fs.readFileSync(new URL("../templates/atmosphere-forge.hbs", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../scripts/atmosphere-forge-app.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles/atmosphere-forge.css", import.meta.url), "utf8");

function flatten(value, prefix = "", output = {}) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) flatten(child, path, output);
    else output[path] = child;
  }
  return output;
}

test("DE/EN localization is nested and resolves core application keys", () => {
  assert.equal(typeof de.PF2EATMOSPHEREFORGE, "object");
  assert.equal(de.PF2EATMOSPHEREFORGE.Title, "Atmosphere Forge");
  assert.equal(de.PF2EATMOSPHEREFORGE.CityForge.SourceLabel, "Ortsquelle");
  assert.equal(de.PF2EATMOSPHEREFORGE.CityForge.SourceOptions.scene, "Automatisch über aktive Scene");
  assert.equal(en.PF2EATMOSPHEREFORGE.Title, "Atmosphere Forge");
  assert.equal(Object.hasOwn(de, "PF2EATMOSPHEREFORGE.Title"), false);
});

test("nested DE/EN localization still has identical leaf-key contracts", () => {
  assert.deepEqual(
    new Set(Object.keys(flatten(de))),
    new Set(Object.keys(flatten(en)))
  );
});

test("template and app use non-colliding source label/options keys", () => {
  assert.match(template, /CityForge\.SourceLabel/);
  assert.doesNotMatch(template, /CityForge\.Source"/);
  assert.match(app, /CityForge\.SourceOptions\.\$\{id\}/);
});

test("expanded Atmosphere Forge UI uses bounded responsive columns", () => {
  assert.match(app, /width:\s*1280/);
  assert.match(css, /minmax\(360px, 1\.05fr\)/);
  assert.match(css, /minmax\(0, 1\.55fr\)/);
  assert.match(css, /minmax\(220px, \.7fr\)/);
  assert.match(css, /\.atmosphere-forge-panel:first-child[\s\S]*min-width:\s*0/);
  assert.match(css, /@media \(max-width: 820px\)/);
});
