import assert from "node:assert/strict";
import test from "node:test";

import { syncPageSize } from "../lib/usage-policy.ts";

test("sync page size reserves both collection reads without crossing remaining resources", () => {
  assert.equal(syncPageSize(101),50);
  assert.equal(syncPageSize(24),12);
  assert.equal(syncPageSize(10),5);
  assert.equal(syncPageSize(9),null);
});
