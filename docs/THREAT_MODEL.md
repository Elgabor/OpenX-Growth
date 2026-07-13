# Threat model

The supported deployment is one owner, one fork, one X account and one D1 database. Multi-tenant SaaS operation is outside the current security model.

## Protected assets

- X access and refresh tokens;
- application, scheduler and API bearer tokens;
- AI provider keys;
- cached feed content, drafts, schedules and analytics;
- the ability to publish from the connected X account.

## Trust boundaries

The browser is untrusted for secrets. X, the configured AI provider, deployment host, D1 and the owner's MCP client are external boundaries. No credential is intentionally sent to project maintainers. The browser login cookie, REST/MCP bearer and scheduler bearer are independent authorization boundaries; possession of one does not grant another authority.

## Threats and mitigations

- **Repository leak:** ignored instance files, privacy audit, Gitleaks and placeholders only.
- **Database disclosure:** OAuth tokens are AES-GCM sealed; rotate `SESSION_SECRET` and reconnect X after compromise.
- **CSRF:** SameSite cookies plus a required CSRF header for browser writes.
- **Missing deployment gate:** only an unconfigured, write-disabled demo is public. A configured instance without `APP_ACCESS_TOKEN` returns `APP_ACCESS_TOKEN_REQUIRED` before browser, API or cron authorization.
- **Credential confusion:** application, API and cron credentials are accepted only by their designated route classes. Direct `APP_ACCESS_TOKEN` bearer access is not supported; browser access requires the sealed, expiring login cookie.
- **Brute-force access:** failed logins are rate-limited by a hashed source identifier stored encrypted in D1.
- **Duplicate scheduling:** records use expiring conditional leases; every confirmed thread part is persisted before continuation, while possible acceptance without a receipt becomes `needs_review` and cannot auto-retry.
- **Prompt injection:** feed text is untrusted context; generated output never executes and publishing stays gated.
- **Supply chain:** lockfile installs, Dependabot, CI and dependency review.

## Residual risks

A compromised host, owner browser, dependency, deployment account or provider can access data available to that boundary. Exact-once publishing cannot be guaranteed across a crash between remote X acceptance and local receipt storage; the conservative recovery path requires owner reconciliation. Enable platform WAF/rate limiting, audit logs, backups and branch protection.
