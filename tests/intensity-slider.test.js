import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../scripts/atmosphere-forge-app.js", import.meta.url), "utf8");
const template = fs.readFileSync(new URL("../templates/atmosphere-forge.hbs", import.meta.url), "utf8");

test("City suggestion pre-fills the form-state slider when no manual override exists", () => {
  assert.match(app, /!this\.#formState\.intensityOverride/);
  assert.match(app, /this\.#formState\.intensity = Number\(this\.#cityContext\.suggestedIntensity\)/);
  assert.match(template, /value="\{\{selectedIntensity\}\}"/);
});

test("generation uses the visible slider value instead of hidden City suggested intensity", () => {
  assert.match(app, /const intensity = manualIntensity;/);
  assert.doesNotMatch(app, /const intensity = cityResolved && useCityIntensity/);
});

test("moving the intensity slider creates a manual override and updates visible value live", () => {
  assert.match(app, /intensitySlider\?\.addEventListener\("input"/);
  assert.match(app, /this\.#formState\.intensityOverride = true/);
  assert.match(app, /effectiveIntensityValue\.textContent = String\(value\)/);
  assert.match(app, /effectiveIntensityLabel\.textContent = intensityLabel\(value\)/);
});

test("changing City context or re-enabling City suggestion clears the manual override", () => {
  const resets = app.match(/this\.#formState\.intensityOverride = false/g) ?? [];
  assert.ok(resets.length >= 4);
});

test("template explains suggestion versus manual override state", () => {
  assert.match(template, /CityForge\.IntensityFromSuggestion/);
  assert.match(template, /CityForge\.IntensityManualOverride/);
  assert.match(template, /data-effective-intensity-value/);
  assert.match(template, /data-effective-intensity-label/);
});
