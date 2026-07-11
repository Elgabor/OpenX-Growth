import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:5175";

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      accept: "application/json",
      ...(options.headers ?? {}),
    },
  });
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  return { response, body };
}

function cookieJar(response) {
  const raw = response.headers.getSetCookie?.() ?? [];
  return raw.map((entry) => entry.split(";")[0]).join("; ");
}

test("demo instance exposes public status without login", async () => {
  const { response, body } = await api("/api/x/status");
  assert.equal(response.status, 200);
  assert.equal(body.demoMode, true);
  assert.equal(body.accessProtected, false);
  assert.equal(body.connected, false);
});

test("dashboard HTML renders", async () => {
  const { response, body } = await api("/", { headers: { accept: "text/html" } });
  assert.equal(response.status, 200);
  assert.match(String(body), /OpenX Growth/i);
  assert.match(String(body), /DEMO DATA|Overview|Discover/i);
});

test("compliance endpoint reports demo posture", async () => {
  const { response, body } = await api("/api/compliance");
  assert.equal(response.status, 200);
  assert.equal(body.demoMode, true);
  assert.equal(body.accessProtected, false);
  assert.equal(body.checks.autonomousRepliesDisabled, true);
});

test("unconfigured writes return INSTANCE_NOT_CONFIGURED", async (t) => {
  const status = await api("/api/x/status");
  if (status.body.configured) {
    t.skip("instance is configured in this environment");
    return;
  }
  const csrf = await api("/api/security/csrf");
  const post = await api("/api/posts", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrf.body.token,
      cookie: cookieJar(csrf.response),
    },
    body: JSON.stringify({ text: "E2E draft post", evergreen: false }),
  });
  assert.equal(post.response.status, 503);
  assert.equal(post.body.error, "INSTANCE_NOT_CONFIGURED");
});
