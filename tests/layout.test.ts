import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("onboarding content keeps the step scrollable inside the fixed-height modal", () => {
  const css = readFileSync(new URL("../app/globals.css",import.meta.url),"utf8");

  assert.match(css,/\.setup-content\{min-height:0;overflow:hidden\}/);
  assert.match(css,/\.setup-step\{min-height:0\}/);
  assert.match(css,/\.setup-step\{[^}]*overflow:auto/);
});
