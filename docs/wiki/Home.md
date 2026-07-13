# OpenX Growth Wiki

OpenX Growth is a self-hosted, open-source workspace to **discover ideas and reply opportunities**, **draft and schedule posts/threads**, and **track performance** using the official X API.

This wiki is the operator handbook: how to run it live, connect X safely, and troubleshoot common issues.

## Quick start (local demo)

- Clone the repo
- Install dependencies: `npm ci`
- Copy env template: `cp .env.example .env.local`
- Start: `npm run dev`

The app loads in **unconfigured, write-disabled demo mode**.

## Go live (connect your X account)

### 1) Create an X app

- Create an app in the X Developer Console (`https://console.x.com/`)
- Enable OAuth 2.0
- Set permissions to **Read and Write**
- Register the callback URL:

`https://YOUR_DOMAIN/api/x/oauth/callback`

### 2) Set required server env vars

Before you configure X, you must protect the instance:

- `APP_ACCESS_TOKEN` (required once configured)
- `SESSION_SECRET` (generate a strong secret)
- `APP_URL` (your public origin)
- `X_CLIENT_ID` (from X developer console)

Optional (recommended in production):

- `CRON_SECRET` (protects scheduled publish endpoint)
- `OPENX_API_TOKEN` (protects REST/MCP write access)

Restart the server after changing env vars.

### 3) Authorize via Settings

Open **Settings → Continue with X** and complete the OAuth consent flow.

## Daily limits and usage

OpenX enforces local budgets so one instance cannot accidentally exceed your plan:

- `MAX_DAILY_X_RESOURCES`
- `MAX_DAILY_X_WRITES`

Reads reserve worst-case resources before the call and reconcile to returned data.
Writes count every outbound attempt, including retries and failures.

## Publishing safety and `needs_review`

X post creation does not provide a global idempotency key.
If OpenX cannot prove whether X accepted a request (timeouts or 5xx), the item is moved to **`needs_review`** and is **never retried automatically**.

Use the UI reconciliation flow to confirm and continue safely.

## Data, privacy, and exports

- No telemetry to maintainers
- Exports exclude credentials and OAuth tokens
- Disconnecting X removes stored tokens

See `PRIVACY.md` for details.

## Security reporting

Do not open public issues for vulnerabilities.
Use GitHub’s private **Report a vulnerability** flow (requires “Private vulnerability reporting” enabled in repo settings).

See `SECURITY.md`.

