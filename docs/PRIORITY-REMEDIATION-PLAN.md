# OpenX Growth — Priority Remediation Plan

Status: planning reference only. This file must remain uncommitted unless Lorenzo explicitly changes that instruction.

## Target outcome

Move OpenX Growth from a working early alpha to a trustworthy single-owner growth system whose security boundary, live-data claims, recommendations, X cost controls, and publisher recovery are executable and testable.

The intended loop is:

`X network -> ranked opportunity -> draft -> reviewed publication -> measured outcome -> learned preference`

## Hard boundaries

- Work only in `/Users/lorenzoborgato/code/OpenX-Growth`.
- `origin` must remain `https://github.com/Elgabor/OpenX-Growth.git`.
- `upstream` is read-only context. Never push, open PRs, deploy, or write to `dg996/OpenX-Growth`.
- Never implement on `main`. Before edits, verify `git branch --show-current`; create a `codex/...` branch if needed.
- Do not commit, push, deploy, open a PR, or modify production resources without a separate explicit request.
- Never read or print `.env.local`, secrets, tokens, sessions, D1 production data, or provider credentials.
- No live X calls in automated tests. Use injected deterministic fakes and isolated local D1 state.
- Preserve the single-owner, self-hosted, official-X-API-only product boundary. No scraping, autonomous replies, DMs, or multi-tenant credential custody.
- Do not add dependencies unless existing platform capabilities are insufficient and Lorenzo approves the dependency.

## Execution model

Implement in ordered, reviewable checkpoints. Each checkpoint starts with a failing behavioral test, makes the smallest production change, runs focused checks, then runs the full local gate. Do not begin the next checkpoint with red tests or unresolved security ambiguity.

Preferred implementation branch when execution starts: `codex/openx-priority-remediation`. If the plan is executed as separate slices, use `codex/openx-01-access-gate`, `codex/openx-02-data-provenance`, and so on. Branches may be created locally; commits remain forbidden until explicitly authorized.

## Phase 0 — Build a trustworthy verification harness

Purpose: make the five remediations testable without X credentials, network spend, or production data.

Work:

1. Introduce an internal X transport boundary used by sync, OAuth refresh, replies, and publishing. Production transport continues to call `api.x.com`; tests inject a deterministic fake.
2. Add isolated HTTP E2E orchestration that starts an unconfigured demo instance and a configured/protected instance with test-only environment values and local D1.
3. Replace regex-only security assertions with executed route tests where practical. Static assertions may remain only for repository-policy invariants.
4. Add a single `test:e2e` command and include it in `release:check`/CI only after it is hermetic and stable.
5. Ensure test logs redact authorization headers, cookies, provider bodies, and session material.

Acceptance:

- Tests run with no `.env.local` dependency and no external X/AI calls.
- Demo, protected, authenticated, unauthenticated, rate-limited, and provider-failure fixtures are reproducible.
- `npm run release:check` is deterministic locally and in CI.

## Phase 1 — P0 access gate: configured instances fail closed

Risk: when `APP_ACCESS_TOKEN` is absent, `hasAppAccess()` currently returns true even if X is configured. CSRF does not authenticate an anonymous visitor.

Test first:

1. Unconfigured + no access token: public demo reads work; every mutation returns `INSTANCE_NOT_CONFIGURED`.
2. Configured + no access token: fail with a clear configuration error; do not expose posts, analytics, export, sync, OAuth start, CSRF-backed mutations, or stored connection state.
3. Configured + access token + anonymous request: protected endpoints return `401`.
4. Valid login session: permitted routes work; invalid/expired/tampered cookies fail.
5. REST/MCP bearer, cron bearer, and browser login remain separate authorities.

Implementation:

- Define an explicit deployment posture in `lib/config.ts`: public demo is allowed only while the instance is unconfigured and write-disabled.
- Make configured-but-unprotected state fail closed in `lib/security.ts`; do not silently reinterpret it as demo mode.
- Centralize route authorization so new endpoints cannot accidentally omit the same checks.
- Keep CSRF as a second browser-write gate, never as authentication.
- Align README, setup UI, compliance response, threat model, deployment guide, and `SECURITY.md` with executable behavior.

Acceptance:

- The full access matrix passes at route level.
- Anonymous users cannot infer whether an X session is stored.
- No production-like configuration can expose X data or publish capability without an access gate.

## Phase 2 — P1 honest live data and provenance

Risk: static growth curves, generated signal bars, and alternating suggested times can appear beside live data.

Test first:

1. Every live metric returned by an API includes a source/provenance value and timestamp.
2. Rendered live charts exactly match database fixtures; no fixture means an explicit insufficient-data state.
3. Suggested posting times appear only after the configured minimum number of published posts/snapshots.
4. Date ranges actually filter the returned series.

Implementation:

- Add a migration for follower snapshots and persist a snapshot during successful X sync.
- Return real time-series data from analytics; keep raw snapshots separate from derived summaries.
- Model provenance as `demo | live | derived | estimate` and display it at the metric/chart boundary.
- Remove static curves and synthetic microbars from live views.
- Calculate posting-time recommendations from normalized performance with a documented sample threshold; otherwise show `Insufficient data`.
- Use engagement rate and distribution-aware comparisons, not only total impressions.

Acceptance:

- No live-labelled view contains hard-coded or decorative quantitative claims.
- Snapshot-to-API-to-UI contract tests pass for empty, sparse, and sufficient datasets.

## Phase 3 — P1 useful ranking and a real feedback loop

Risk: ranking currently uses freshness, engagement, and follower count; topic extraction is English word frequency; stored feedback does not change recommendations.

Test first:

1. Deterministic EN/IT fixtures cover freshness, topical affinity, author reach, duplicates, replies, missing metrics, and stale posts.
2. A positive preference increases a related candidate's score; a negative preference decreases or suppresses it.
3. Diversity prevents the top results from being near-duplicates from one author/topic.
4. Score explanations identify the features that materially affected rank.

Implementation:

- Refactor ranking and idea generation into pure domain functions with an injected clock.
- Use Unicode-aware tokenization, small explicit EN/IT stopword sets, phrase extraction, novelty against recent owned posts, and deterministic clustering. Do not add an embedding provider in this phase.
- Aggregate recent feedback by target/topic/author and feed bounded preference weights into ranking.
- Store algorithm version and feature explanation with each recommendation payload.
- Add an offline evaluation fixture and regression thresholds for precision@5, diversity, and feedback responsiveness.

Acceptance:

- Ranking is deterministic, explainable, multilingual for EN/IT fixtures, and measurably affected by feedback.
- Existing policy boundaries remain: no autonomous replies or engagement manipulation.

## Phase 4 — P1 accurate, race-safe X usage and cost controls

Risk: sync reserves three reads while it may retrieve many resources; the current read-modify-write counter can lose increments under concurrency.

Test first:

1. Usage records distinguish request count, returned resource count, writes, endpoint, status, and timestamp.
2. Concurrent reservations never exceed a configured hard limit.
3. Failed calls, retries, refresh-after-401, and 429 responses follow the documented accounting rule.
4. Sync reduces requested `max_results` or refuses before crossing the remaining resource budget.

Implementation:

- Centralize X calls in the transport/client boundary created in Phase 0.
- Replace read-modify-write with an atomic conditional D1 update or transactional batch.
- Reserve worst-case resources before a read, then reconcile to actual successful resources; count write attempts according to the documented X billing model.
- Persist rate-limit headers and expose remaining local budget without exposing sensitive identifiers.
- Add warning thresholds and actionable errors; keep provider-console spend limits documented as the external hard backstop.

Acceptance:

- Concurrency and retry tests prove the local cap cannot be bypassed.
- UI usage numbers state their unit and no longer imply exact currency when only resource usage is known.

## Phase 5 — P1 recoverable publishing and shared validation

Risk: a crash after claim can leave a record permanently `publishing`; a crash after X acceptance but before receipt persistence creates an ambiguous retry; API validation differs across create, edit, import, and publish.

Test first:

1. Fault injection before claim, after claim, after every thread part, after remote acceptance, and before local receipt persistence.
2. Expired claims are recoverable; active claims cannot be stolen.
3. Ambiguous delivery never auto-retries into a possible duplicate.
4. Empty, oversized, malformed thread, past schedule, invalid evergreen, and inconsistent status inputs fail at every boundary.

Implementation:

- Add a migration for claim token, claim expiry, delivery state, and structured publish receipts.
- Use leased conditional claims. Recover expired leases only when no ambiguous remote acceptance exists.
- Add `needs_review` for ambiguous delivery and a manual reconciliation path; do not promise exact-once semantics.
- Persist each confirmed thread part before continuing.
- Create shared Zod schemas for create, patch, import, schedule, reply, and publish preflight.
- Add a redacted operational event log for claims, provider responses, retries, reconciliation, and terminal failures.

Acceptance:

- Fault-injection tests prove no blind retry after ambiguous acceptance and no permanent stale claim.
- All publishing entry points enforce the same domain constraints.

## Phase 6 — Integration and release gate

1. Run focused tests after every phase.
2. Run the hermetic HTTP E2E matrix across demo, misconfigured, protected, authenticated, provider failure, budget exhaustion, and crash recovery.
3. Run security/privacy checks and inspect the complete diff for secret leakage, auth bypass, unsafe errors, and unrelated refactors.
4. Run `npm audit --omit=dev`. Do not run `npm audit fix --force`; dependency changes require a separate validated decision if they are breaking.
5. Update docs only to describe behavior proven by tests.

Final commands:

```bash
git branch --show-current
git remote -v
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
npm run release:check
npm run privacy:audit
npm audit --omit=dev
git diff --check
git status --short
```

## Stop conditions

Stop and ask Lorenzo before proceeding if:

- a change needs a new dependency, live X credentials, production D1, deployment, commit, push, PR, or upstream write;
- current X or Cloudflare behavior cannot be verified through official documentation or deterministic local tests;
- a schema choice would make existing exports incompatible without an explicit migration strategy;
- secure fail-closed behavior conflicts with the desired public-demo experience;
- the only remaining npm audit remediation requires a breaking downgrade or unrelated major rewrite.

The remediation is complete only when all five acceptance sections pass, the full gate is green, no secrets were accessed, the diff is limited to this plan's scope, and all changes remain uncommitted on a non-main branch for Lorenzo's review.

## Follow-up feature after remediation: Experiment Ledger

Do not begin this before Phases 0-6 pass. Add a traceable link from recommendation and algorithm version to draft, publication receipt, metrics at fixed windows, and explicit user evaluation. This closes the product learning loop and supplies future ranking evaluations with real, owner-controlled evidence.
