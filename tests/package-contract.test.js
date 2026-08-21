import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const moduleJson = JSON.parse(fs.readFileSync(new URL("../module.json", import.meta.url), "utf8"));
const de = JSON.parse(fs.readFileSync(new URL("../lang/de.json", import.meta.url), "utf8"));
const en = JSON.parse(fs.readFileSync(new URL("../lang/en.json", import.meta.url), "utf8"));

test("release manifest is Atmosphere Forge 0.2.0 without hard City/Weather dependencies", () => {
  assert.equal(moduleJson.id, "pf2e-atmosphere-forge");
  assert.equal(moduleJson.version, "0.2.1");
  assert.equal(moduleJson.compatibility.minimum, "14");
  assert.equal(moduleJson.relationships?.requires?.length ?? 0, 0);
});

test("German and English localization key contracts remain identical", () => {
  assert.deepEqual(new Set(Object.keys(de)), new Set(Object.keys(en)));
});
