import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page=readFileSync(new URL("../app/page.tsx",import.meta.url),"utf8");
const growth=readFileSync(new URL("../lib/x-growth.ts",import.meta.url),"utf8");

test("live analytics and follower charts are data-driven with explicit sparse states", () => {
  const analyticsView=page.slice(page.indexOf("function AnalyticsView"),page.indexOf("function SettingsView"));
  assert.match(analyticsView,/DataSeriesChart label="Impressions from X snapshots"/);
  assert.match(page,/DataSeriesChart label="Follower snapshots"/);
  assert.match(page,/Insufficient data/);
  assert.doesNotMatch(analyticsView,/DemoGrowthChart/);
});

test("live discovery removes synthetic microbars and exposes metric provenance", () => {
  assert.doesNotMatch(growth,/Array\.from\(\{length:13\}/);
  assert.match(page,/dataSource==="demo"&&signal\.bars/);
  assert.match(page,/ProvenanceText provenance=\{signal\.scoreProvenance\}/);
});

test("posting-time UI never invents alternating suggested hours", () => {
  assert.doesNotMatch(page,/index%2\?"17:30":"10:00"/);
  assert.match(page,/postingTimes\.sampleSize/);
  assert.match(page,/Insufficient data for posting-time recommendations/);
});
