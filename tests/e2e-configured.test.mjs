import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:5176";

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
  return { response, body, headers: response.headers };
}

function cookieJar(response) {
  const raw = response.headers.getSetCookie?.() ?? [];
  return raw.map((entry) => entry.split(";")[0]).join("; ");
}

async function csrfSession() {
  const csrf = await api("/api/security/csrf");
  assert.equal(csrf.response.status, 200);
  return {
    token: csrf.body.token,
    cookies: cookieJar(csrf.response),
  };
}

test("configured instance can create posts and feedback signals", async (t) => {
  const status = await api("/api/x/status");
  if (!status.body.configured) {
    t.skip("set X_CLIENT_ID and SESSION_SECRET to run configured E2E");
    return;
  }
  const { token, cookies } = await csrfSession();

  const post = await api("/api/posts", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": token,
      cookie: cookies,
    },
    body: JSON.stringify({
      text: "E2E configured draft",
      topic: "Open source AI",
      hook: "E2E configured draft",
      evergreen: false,
    }),
  });
  assert.equal(post.response.status, 201, JSON.stringify(post.body));
  assert.equal(post.body.post.text, "E2E configured draft");

  const feedback = await api("/api/feedback", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": token,
      cookie: cookies,
    },
    body: JSON.stringify({
      targetType: "idea",
      targetId: "Open source AI",
      vote: 1,
      context: { topic: "Open source AI" },
    }),
  });
  assert.equal(feedback.response.status, 201);

  const posts = await api("/api/posts");
  assert.equal(posts.response.status, 200);
  assert.ok(posts.body.posts.some((row) => row.text === "E2E configured draft"));
});

test("configured instance exposes oauth start redirect to X", async (t) => {
  const status = await api("/api/x/status");
  if (!status.body.configured) {
    t.skip("set X_CLIENT_ID and SESSION_SECRET to run configured E2E");
    return;
  }
  const { response, headers } = await api("/api/x/oauth/start", { redirect: "manual" });
  assert.ok([302, 307].includes(response.status), `expected redirect, got ${response.status}`);
  const location = headers.get("location") ?? "";
  assert.match(location, /^https:\/\/x\.com\/i\/oauth2\/authorize\?/);
  assert.match(location, /client_id=/);
  assert.match(location, /code_challenge=/);
  assert.match(location, /tweet\.read/);
});

test("configured instance blocks AI until provider and policy flags are set", async (t) => {
  const status = await api("/api/x/status");
  if (!status.body.configured) {
    t.skip("set X_CLIENT_ID and SESSION_SECRET to run configured E2E");
    return;
  }
  const { token, cookies } = await csrfSession();
  const ai = await api("/api/ai/generate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": token,
      cookie: cookies,
    },
    body: JSON.stringify({ kind: "rewrite", prompt: "Make this sharper" }),
  });
  assert.equal(ai.response.status, 503);
  assert.equal(ai.body.error, "AI_NOT_CONFIGURED");
});

test("configured instance blocks X sync until OAuth session exists", async (t) => {
  const status = await api("/api/x/status");
  if (!status.body.configured) {
    t.skip("set X_CLIENT_ID and SESSION_SECRET to run configured E2E");
    return;
  }
  const sync = await api("/api/x/sync");
  assert.equal(sync.response.status, 401);
  assert.equal(sync.body.error, "X_NOT_CONNECTED");
});

test("cron publisher stays protected", async () => {
  const cron = await api("/api/cron/publish", { method: "POST" });
  assert.equal(cron.response.status, 401);
});
