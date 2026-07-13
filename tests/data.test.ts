import test from "node:test";
import assert from "node:assert/strict";
import { chunkForD1Insert, D1_MAX_BOUND_PARAMETERS } from "../lib/d1.ts";

test("D1 insert batches stay within the bound-parameter limit", () => {
  const rows = Array.from({length:50},(_,index)=>index);
  const batches = chunkForD1Insert(rows,7);

  assert.deepEqual(batches.map((batch)=>batch.length),[14,14,14,8]);
  assert.ok(batches.every((batch)=>batch.length*7<=D1_MAX_BOUND_PARAMETERS));
  assert.deepEqual(batches.flat(),rows);
});

test("D1 insert batching rejects impossible parameter counts", () => {
  assert.throws(()=>chunkForD1Insert([1],0),/INVALID_D1_BOUND_PARAMETER_COUNT/);
  assert.throws(()=>chunkForD1Insert([1],D1_MAX_BOUND_PARAMETERS+1),/INVALID_D1_BOUND_PARAMETER_COUNT/);
});
