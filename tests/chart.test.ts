import assert from "node:assert/strict";
import test from "node:test";

import { buildChartCoordinates } from "../lib/chart.ts";

test("chart coordinates are derived exactly from API fixture values", () => {
  assert.equal(buildChartCoordinates([10,30,20],640,160,20),"0,160 320,20 640,90");
});

test("flat and insufficient series remain deterministic", () => {
  assert.equal(buildChartCoordinates([5,5],640,160,20),"0,160 640,160");
  assert.equal(buildChartCoordinates([5],640,160,20),"");
});
