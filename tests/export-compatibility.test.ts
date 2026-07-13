import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("schema v1 export keeps lease and receipt internals out of portable posts",()=>{
  const source=readFileSync(new URL("../app/api/data/export/route.ts",import.meta.url),"utf8");
  assert.match(source,/schemaVersion:1/);
  assert.match(source,/const portablePosts=/);
  assert.doesNotMatch(source,/publishReceiptsJson|claimToken|claimExpiresAt|deliveryState/);
});
