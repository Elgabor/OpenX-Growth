# Deployment guide

## Guided setup

For the recommended Cloudflare path, clone your fork, run `npm ci`, then run `npm run setup`. The wizard creates or reuses D1 without deleting data, applies migrations, deploys the Worker, writes generated values only to the gitignored `.env.local` with mode `600`, uploads missing secrets through Wrangler stdin, and verifies the protected instance. Existing remote secrets are detected and never rotated automatically.

The X application itself still requires the manual X Developer Console configuration described below. Re-run the command after an interruption; the remaining numbered steps are the manual reference and recovery path.

The D1 binding must be exactly `DB`; `openx_growth` is not compatible with the included migration and runtime commands. See the complete environment-variable table in the [README](../README.md#3-configure-environment-variables). `.env.local` supports local development, bootstrap and resumable setup.

After deployment, use the application&apos;s **Settings** page for normal configuration. X credentials, OpenRouter/OpenAI settings, evergreen behavior, cache duration, local limits, the scheduler secret, API token and application access token can be updated there without opening the Cloudflare dashboard or redeploying. Secret values are encrypted in D1 and never returned after saving. `SESSION_SECRET` remains in the deployment secret store because it is the encryption root; `APP_URL` remains deployment-owned because it defines the public OAuth origin.

1. Fork the repository and keep it private while configuring secrets.
2. Copy `.env.example` to `.env.local` for local development only.
3. Generate independent values for `SESSION_SECRET`, `APP_ACCESS_TOKEN`, `CRON_SECRET` and `OPENX_API_TOKEN`.
4. Create and migrate a D1 database.
5. Configure a dedicated X application with the exact production callback URL.
6. Deploy, sign in with `APP_ACCESS_TOKEN`, then configure and authorize X from **Settings → X account**.
7. Configure a scheduler only after a manual draft and publish test succeeds.
8. Leave AI and evergreen toggles disabled in Settings until the associated policy review is complete.

`APP_ACCESS_TOKEN` may be omitted only for an unconfigured, write-disabled demo. A configured instance without it fails closed; `OPENX_API_TOKEN` and `CRON_SECRET` cannot bypass that deployment gate or authenticate browser routes.

## Release validation

```bash
npm ci
npm run release:check
git status --short
```

Confirm that Git contains no `.env`, `wrangler.jsonc`, `.openai/hosting.json`, database, export, private screenshot or log. Scan full history with Gitleaks before making a previously private fork public.

## Recovery

- Revoke X authorization and rotate all secrets after suspected disclosure.
- Restore D1 from an operator-managed backup; exports omit credentials.
- Changing `SESSION_SECRET` makes stored OAuth ciphertext unreadable and requires reconnection.
- Disable the scheduler before repairing repeated publishing failures.
