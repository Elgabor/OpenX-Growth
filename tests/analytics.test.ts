import test from "node:test";
import assert from "node:assert/strict";
import { summarizeLatestSnapshots } from "../lib/analytics.ts";

test("analytics totals count only the latest snapshot for every synced X post", () => {
  const result = summarizeLatestSnapshots([
    {postId:"x-1",recordedAt:100,impressions:10,likes:1,replies:0,reposts:0},
    {postId:"x-2",recordedAt:300,impressions:40,likes:3,replies:2,reposts:1},
    {postId:"x-1",recordedAt:200,impressions:25,likes:2,replies:1,reposts:0},
  ]);

  assert.equal(result.latest.size,2);
  assert.equal(result.latest.get("x-1")?.recordedAt,200);
  assert.deepEqual(result.totals,{impressions:65,likes:5,replies:3,reposts:1});
});

test("analytics snapshot order does not affect the latest totals", () => {
  const result = summarizeLatestSnapshots([
    {postId:"x-1",recordedAt:200,impressions:25,likes:2,replies:1,reposts:0},
    {postId:"x-1",recordedAt:100,impressions:10,likes:1,replies:0,reposts:0},
  ]);

  assert.equal(result.totals.impressions,25);
});
