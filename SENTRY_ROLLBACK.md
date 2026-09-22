# Sentry change and Oxygen rollback runbook

Prepared: 2026-09-19 on `prodReady`. Updated after the pushed Sentry commit.

## Release record

| Item                                       | Value                                                                                                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sentry change commit SHA                   | `09a61f5d0b8d0d1dea571d690af928918e4890d3` (`09a61f5`)                                                                                             |
| Sentry diagnostic follow-up commit SHA     | `e0f8ebaafa2eb8a77f97cf76c45e2726217a35dd` (`e0f8eba`)                                                                                             |
| PR / merge commit SHA                      | **Pending**- record the commit that actually lands on the deployment branch                                                                       |
| Local base before these edits              | `95a07362dc982f046dfcd256e9e4c961712e4e3d` (not necessarily the production rollback target)                                                        |
| Oxygen environment and domain              | **Pending**                                                                                                                                        |
| Last known good Oxygen deployment ID / URL | **Record before deploying**                                                                                                                        |
| New Oxygen deployment ID / URL             | **Record after deploying**                                                                                                                         |
| Environment values used                    | Record whether `SENTRY_ENABLED` is `true` or `false`, the Sentry environment name, and other changed variable **names**; never paste secret values |

The deployment ID is an **immediate incident fallback**, not a long-term rollback strategy. After later releases, switching to this old deployment would discard every newer storefront change. Keep the Sentry SHA above as the durable identifier for finding the original implementation, then remove only Sentry from the then-current `main`. Before this release, open and verify the last known good deployment's unique URL. Oxygen deployments retain their original environment variables, so check that it still has usable Shopify/Fastrr credentials.

## What commit `09a61f5` contains

This inventory was verified with `git show --name-status 09a61f5d0b8d0d1dea571d690af928918e4890d3`. The commit contains unrelated work: the Upstash planning edit and a generated route type file. **Do not revert this entire commit to remove Sentry**, even if Git reports a clean revert. Preserve the unrelated changes and all later work.

| Area                             | Files                                                                                                                                                                                                                                                                                                                        | Effect                                                                                                                                                                                                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sentry configuration             | `.env.example`, `env.d.ts`, `README.md`, `package.json`, `package-lock.json`                                                                                                                                                                                                                                                 | Adds `SENTRY_ENABLED`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, documentation, and `@sentry/browser` / `@sentry/core`. The Sentry auth token is not used.                                                                                                        |
| Server monitoring                | `server.ts`, `app/lib/context.ts`, `app/lib/monitoring.server.ts`, `app/lib/sentry-client.server.ts`                                                                                                                                                                                                                         | Creates a monitor only when enabled and the DSN is valid; records request status, route group, duration, exceptions, and selected API failures. Delivery is scheduled with Oxygen `waitUntil`. The server SDK is still bundled when monitoring is disabled. |
| Browser monitoring and CSP       | `app/entry.client.tsx`, `app/entry.server.tsx`, `app/root.tsx`, `app/lib/monitoring-signals.ts`, `app/lib/monitoring.client.ts`                                                                                                                                                                                              | Adds a conditional browser SDK import, Sentry DSN meta tags when enabled, and Sentry ingest origin to CSP when enabled. Records hydration and Fastrr launch signals.                                                                                        |
| Flow instrumentation             | `app/lib/fastrr.ts`, `app/lib/judgeme.server.ts`, `app/routes/account.addresses.tsx`, `app/routes/account.orders._index.tsx`, `app/routes/account.profile.tsx`, `app/routes/account.tsx`, `app/routes/collections.$handle.tsx`, `app/routes/collections.all.tsx`, `app/routes/products.$handle.tsx`, `app/routes/search.tsx` | Adds monitoring around existing Fastrr, Judge.me, Storefront, and Customer Account operations. Fastrr launch tracking does **not** confirm payment or Shopify order reconciliation.                                                                         |
| Tests                            | `tests/e2e/storefront.spec.ts`, `tests/judgeme.test.ts`, `tests/monitoring.test.ts`, `vite.e2e.config.ts`                                                                                                                                                                                                                    | Adds monitoring tests and an off-mode browser test; the Fastrr call is mocked.                                                                                                                                                                              |
| Existing readiness document edit | `PRODUCTION_READINESS.md`                                                                                                                                                                                                                                                                                                    | Adds the deferred Upstash rate-limit plan. No limiter is implemented by this change. **Preserve during Sentry removal.**                                                                                                                                    |
| Generated local type file        | `.react-router/types/+routes.ts`                                                                                                                                                                                                                                                                                             | Contains generated virtual-route paths with a machine-specific path. It is not part of Sentry. **Do not roll it back solely for Sentry.**                                                                                                                   |

No GitHub workflow file changed in this commit. The existing push workflow runs checks before its Oxygen deployment; after a merge, automatic deployment can make a rollback temporary unless the bad change is also removed on the linked branch.

## Diagnostic follow-up commit `e0f8eba`

`e0f8ebaafa2eb8a77f97cf76c45e2726217a35dd` builds on `09a61f5`; it does not introduce a second Sentry SDK or change the `SENTRY_ENABLED` switch. Verified with `git show --name-status e0f8ebaafa2eb8a77f97cf76c45e2726217a35dd`.

| Area | Files | Added diagnostic data |
| --- | --- | --- |
| Browser | `app/entry.client.tsx`, `app/lib/monitoring-signals.ts`, `app/lib/monitoring.client.ts`, `app/lib/fastrr.ts` | React invariant number, broad route group, allowlisted error name, component names, shortened script file/line frames, and separate issue fingerprints. Fastrr reports only launch attempts/failures, not an order result. |
| Server | `server.ts`, `app/entry.server.tsx`, `app/lib/monitoring.server.ts`, `app/lib/sentry-client.server.ts`, `app/lib/judgeme.server.ts` | Validated UUID request ID, failure stage/operation, allowlisted error name, extracted 4xx/5xx status, shortened script file/line frames, and issue fingerprints. |
| Customer Account | `app/routes/account.tsx`, `app/routes/account.orders._index.tsx`, `app/routes/account.profile.tsx`, `app/routes/account.addresses.tsx` | Fixed `graphql`/`missing_result`/`exception` reason labels and user-error counts; no address or customer field values. |
| Tests | `tests/monitoring.test.ts` | Checks flag behavior, bounded diagnostic extraction, omission of sample private values from a serialized server Sentry envelope, and failed-delivery isolation. |

**Privacy boundary:** The new Sentry calls pass fixed event names, allowlisted error names, broad route groups, numeric React/HTTP codes, component identifiers, file basenames and line/column numbers. They do not pass raw `Error.message`, raw stack traces, complete URLs, URL queries, form values, GraphQL variables, customer details, or Judge.me tokens. Both browser and server `beforeSend` remove request, user, breadcrumb, and extra fields; diagnostic context remains intentionally. A file or component identifier itself could theoretically contain sensitive text if future code dynamically names it; audit new instrumentation and spot-check a real Sentry event after deployment. The existing `console.error(error)` in `app/entry.client.tsx` still prints the raw hydration error **to that visitor's browser console**; it predates this follow-up and is not a Sentry payload. This review is limited to Sentry reporting in this commit, not every log in the storefront.

**Verification on 2026-09-19:** `npm.cmd run format:check`, `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd test` (37 passed), `npm.cmd run test:integration` (12 passed), and `npm.cmd run build` passed. The server-envelope test intercepted Sentry transport locally and confirmed a sample token/error message was absent. `npm.cmd run test:e2e` could not start MiniOxygen on local Windows/Node 24 (`MiniflareCoreError [ERR_RUNTIME_FAILURE]`); no browser test ran. The E2E suite mocks Fastrr. Browser Sentry envelopes and live Oxygen behavior were not verified by these local checks; inspect one new event in the target Sentry environment after deployment. Old Sentry events cannot gain the new fields.

**If only the diagnostic follow-up causes trouble:** First set `SENTRY_ENABLED=false` and redeploy the affected Oxygen environment. To retain base monitoring while removing the diagnostic follow-up, create a new branch from current `main`, inspect `git show e0f8ebaafa2eb8a77f97cf76c45e2726217a35dd`, and selectively remove its extra diagnostic arguments, parsing, tags, contexts, and fingerprints. Keep the original monitoring initialization from `09a61f5`, the current Fastrr `buyDirect` call and return behavior, all current Customer Account mutation/error handling, and later storefront fixes. Adapt `tests/monitoring.test.ts` to the resulting event shape, then run the checks listed in step 3 below. Do not blindly revert this commit months later if its files have evolved.

## Fast incident actions

### 1. Monitoring is slow, noisy, or sending unexpected data; storefront still works

In Shopify Admin → Hydrogen → this storefront → Storefront settings → Environments and variables, set **`SENTRY_ENABLED=false` for the affected environment**. Then redeploy that environment and verify the new deployment is current. Editing the variable alone does not change an already deployed worker. With the flag off, the current implementation does not initialize a Sentry client or download its browser SDK, but its server SDK remains in the worker bundle. If startup/bundle size is the problem, use step 3; step 2 is available as a temporary fallback only when the previous deployment is still suitable.

Verify the storefront homepage, catalog/PDP, cart, Buy now/Fastrr launch, login, and account pages. Confirm the response CSP no longer contains Sentry ingest, the HTML lacks `meta[name="sentry-dsn"]`, and browser Network shows no `monitoring.client-*` download or Sentry ingest request. Do not place a real order solely to test rollback.

### 2. New release breaks the storefront; temporarily restore the previous Oxygen build

Use this only when the older deployment is still a suitable version of the storefront, typically just after release. After months of other changes, skip this step and use steps 1 and 3 so newer features stay deployed.

For a **production or custom Oxygen environment**: Shopify Admin → Hydrogen → storefront overview → `…` on the affected environment → **View deployments** → `…` on the last known good deployment → **Make this the current deployment** → confirm. Verify the custom domain and checkout entry points. This switches the environment URL to the older immutable deployment without a fresh build. Shopify does not offer this action for the Preview environment. Check the older deployment's retained environment variables before selecting it. Shopify retains deployments for at least six months and always retains the ten most recent per environment; do not rely on a particular old deployment remaining available forever.

Record incident time, affected domain, old/new deployment IDs, and the result of the smoke check. A later push to the environment's linked branch will again select its newest deployment, so complete step 3 before the next automatic deploy.

### 3. Remove Sentry from the current code without losing later changes

On the linked Git branch, make a **new commit and PR** based on the latest `main`; do not force-push shared history or reset the production branch. Use the recorded Sentry commit SHA to identify original touch points and inspect what changed afterward:

```powershell
git fetch origin
git status --short
git show --name-status 09a61f5d0b8d0d1dea571d690af928918e4890d3
git show --name-status e0f8ebaafa2eb8a77f97cf76c45e2726217a35dd
git log --oneline 09a61f5d0b8d0d1dea571d690af928918e4890d3..origin/main -- server.ts app/entry.client.tsx app/root.tsx app/lib app/routes
```

Create a branch from current `main`, then make a targeted removal. Use the commit diff as a map, **not as a patch to reverse automatically**:

```powershell
git switch -c remove-sentry-monitoring origin/main
git show 09a61f5d0b8d0d1dea571d690af928918e4890d3 -- server.ts app/entry.client.tsx app/entry.server.tsx app/root.tsx app/lib app/routes package.json env.d.ts
git show e0f8ebaafa2eb8a77f97cf76c45e2726217a35dd -- server.ts app/entry.client.tsx app/entry.server.tsx app/lib app/routes tests/monitoring.test.ts
```

Remove only Sentry initialization, its browser import/meta/CSP changes, the monitoring calls and helper files listed above (including the `e0f8eba` diagnostic additions), and the Sentry packages from `package.json`/lockfile. Remove or adapt Sentry-specific tests and environment declarations. Preserve Fastrr checkout calls and their existing return/error behavior, Judge.me cache/fallback behavior, GraphQL queries and partial-error handling, account actions, and every later product fix. Keep the Upstash planning text in `PRODUCTION_READINESS.md`. Regenerate route types with the project's normal type generation; do not hand-reverse the committed generated file. If `@sentry/browser` or `@sentry/core` are used by newer features, adapt those features deliberately before removing the packages. Do not run `git revert 09a61f5` or `git revert e0f8eba` or revert a later merge commit wholesale.

Verify the targeted removal locally before merging:

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:integration
npm.cmd run test:e2e
npm.cmd run build
git diff --check
```

The Playwright storefront suite mocks Fastrr; do not call its live checkout API solely for this rollback. Review `git diff` against current `main` and confirm it contains only Sentry removal and necessary test/doc updates. After the PR merges, verify the new Oxygen deployment's catalog, PDP, cart, Buy now/Fastrr launch, login, profile/address flows, and browser Network/CSP. CI in `.github/workflows/oxygen-deployment-1000176591.yml` gates push deployment on formatting/lint, TypeScript, unit/integration tests, Playwright storefront, and build. These checks reduce regression risk but cannot guarantee that a future codebase or live third-party service has no regressions.

## Sources and operational limits

- [Shopify Oxygen deployments and rollback steps](https://shopify.dev/docs/storefronts/headless/hydrogen/deployments): only production/custom environments support selecting an older deployment; a later push restores latest-deployment behavior.
- [Shopify Oxygen environments](https://shopify.dev/docs/storefronts/headless/hydrogen/environments): deployment environment variables are immutable; changing them requires redeployment.
- This runbook was updated from the pushed commit. Fill the merge and deployment fields when they exist. Do not treat a green build or the monitoring flag as proof of live checkout or order reconciliation.
