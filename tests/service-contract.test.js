import test from "node:test";
import assert from "node:assert/strict";
import { AtmosphereService } from "../scripts/atmosphere-service.js";

test("deterministic local-context sections are not rerolled", async () => {
  const result = {
    sections: [{
      id: "localContext",
      label: "Local",
      text: "Settlement state text",
      rerollable: false
    }]
  };

  const rerolled = await AtmosphereService.rerollSection(result, "localContext");
  assert.equal(rerolled, result);
});
