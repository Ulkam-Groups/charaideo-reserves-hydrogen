# Sentry change and Oxygen rollback runbook

Prepared: 2026-09-19, before commit on `prodReady`.

## Release record — fill in after commit and before merge

| Item                                       | Value                                                                                                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Change commit SHA                          | **Pending** — run `git rev-parse HEAD` immediately after committing                                                                                |
| PR / merge commit SHA                      | **Pending** — record the commit that actually lands on the deployment branch                                                                       |
| Local base before these edits              | `95a07362dc982f046dfcd256e9e4c961712e4e3d` (not necessarily the production rollback target)                                                        |
| Oxygen environment and domain              | **Pending**                                                                                                                                        |
| Last known good Oxygen deployment ID / URL | **Record before deploying**                                                                                                                        |
| New Oxygen deployment ID / URL             | **Record after deploying**                                                                                                                         |
| Environment values used                    | Record whether `SENTRY_ENABLED` is `true` or `false`, the Sentry environment name, and other changed variable **names**; never paste secret values |

The deployment ID is an **immediate incident fallback**, not a long-term rollback strategy. After later releases, switching to this old deployment would discard every newer storefront change. Keep the change/merge commit SHA as the durable identifier for removing Sentry from the then-current `main` branch. Before this release, open and verify the last known good deployment's unique URL. Oxygen deployments retain their original environment variables, so check that it still has usable Shopify/Fastrr credentials.

## What the current uncommitted work changes

This inventory was taken from `git status` and `git diff` before this document was added. Include the new files when committing. Confirm the staged file list with `git diff --cached --name-status` because the eventual commit may differ from this snapshot.

For the cleanest future revert, commit the Sentry implementation and this runbook separately from the unrelated Upstash planning edit. Do not stage the generated `.react-router/types/+routes.ts` unless a deliberate review finds it necessary. Record the SHA of the commit that actually contains the Sentry code.

| Area                             | Files                                                                                                                                                                                                                                                                                                                        | Effect                                                                                                                                                                                                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sentry configuration             | `.env.example`, `env.d.ts`, `README.md`, `package.json`, `package-lock.json`                                                                                                                                                                                                                                                 | Adds `SENTRY_ENABLED`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, documentation, and `@sentry/browser` / `@sentry/core`. The Sentry auth token is not used.                                                                                                        |
| Server monitoring                | `server.ts`, `app/lib/context.ts`, `app/lib/monitoring.server.ts`, `app/lib/sentry-client.server.ts`                                                                                                                                                                                                                         | Creates a monitor only when enabled and the DSN is valid; records request status, route group, duration, exceptions, and selected API failures. Delivery is scheduled with Oxygen `waitUntil`. The server SDK is still bundled when monitoring is disabled. |
| Browser monitoring and CSP       | `app/entry.client.tsx`, `app/entry.server.tsx`, `app/root.tsx`, `app/lib/monitoring-signals.ts`, `app/lib/monitoring.client.ts`                                                                                                                                                                                              | Adds a conditional browser SDK import, Sentry DSN meta tags when enabled, and Sentry ingest origin to CSP when enabled. Records hydration and Fastrr launch signals.                                                                                        |
| Flow instrumentation             | `app/lib/fastrr.ts`, `app/lib/judgeme.server.ts`, `app/routes/account.addresses.tsx`, `app/routes/account.orders._index.tsx`, `app/routes/account.profile.tsx`, `app/routes/account.tsx`, `app/routes/collections.$handle.tsx`, `app/routes/collections.all.tsx`, `app/routes/products.$handle.tsx`, `app/routes/search.tsx` | Adds monitoring around existing Fastrr, Judge.me, Storefront, and Customer Account operations. Fastrr launch tracking does **not** confirm payment or Shopify order reconciliation.                                                                         |
| Tests                            | `tests/e2e/storefront.spec.ts`, `tests/judgeme.test.ts`, `tests/monitoring.test.ts`, `vite.e2e.config.ts`                                                                                                                                                                                                                    | Adds monitoring tests and an off-mode browser test; the Fastrr call is mocked.                                                                                                                                                                              |
| Existing readiness document edit | `PRODUCTION_READINESS.md`                                                                                                                                                                                                                                                                                                    | Adds the deferred Upstash rate-limit plan. No limiter is implemented by this change.                                                                                                                                                                        |
| Generated local type file        | `.react-router/types/+routes.ts`                                                                                                                                                                                                                                                                                             | Currently contains generated virtual-route paths from a local workspace. Review before staging; it is not part of the Sentry behavior and includes a machine-specific path.                                                                                 |

No GitHub workflow file is changed in this snapshot. The existing push workflow runs checks before its Oxygen deployment; after a merge, automatic deployment can make a rollback temporary unless the bad change is also reverted on the linked branch.

## Fast incident actions

### 1. Monitoring is slow, noisy, or sending unexpected data; storefront still works

In Shopify Admin → Hydrogen → this storefront → Storefront settings → Environments and variables, set **`SENTRY_ENABLED=false` for the affected environment**. Then redeploy that environment and verify the new deployment is current. Editing the variable alone does not change an already deployed worker. With the flag off, the current implementation does not initialize a Sentry client or download its browser SDK, but its server SDK remains in the worker bundle. If startup/bundle size is the problem, use step 2 instead.

Verify the storefront homepage, catalog/PDP, cart, Buy now/Fastrr launch, login, and account pages. Confirm the response CSP no longer contains Sentry ingest, the HTML lacks `meta[name="sentry-dsn"]`, and browser Network shows no `monitoring.client-*` download or Sentry ingest request. Do not place a real order solely to test rollback.

### 2. New release breaks the storefront; temporarily restore the previous Oxygen build

Use this only when the older deployment is still a suitable version of the storefront, typically just after release. After months of other changes, skip this step and use steps 1 and 3 so newer features stay deployed.

For a **production or custom Oxygen environment**: Shopify Admin → Hydrogen → storefront overview → `…` on the affected environment → **View deployments** → `…` on the last known good deployment → **Make this the current deployment** → confirm. Verify the custom domain and checkout entry points. This switches the environment URL to the older immutable deployment without a fresh build. Shopify does not offer this action for the Preview environment. Check the older deployment's retained environment variables before selecting it. Shopify retains deployments for at least six months and always retains the ten most recent per environment; do not rely on a particular old deployment remaining available forever.

Record incident time, affected domain, old/new deployment IDs, and the result of the smoke check. A later push to the environment's linked branch will again select its newest deployment, so complete step 3 before the next automatic deploy.

### 3. Remove Sentry from the current code without losing later changes

On the linked Git branch, make a **new commit and PR** based on the current `main`; do not force-push shared history or reset the production branch. Use the recorded Sentry commit SHA to identify all original touch points and inspect what changed afterward:

```powershell
git status --short
git show --name-status <sentry-change-sha>
git log --oneline <sentry-change-sha>..origin/main -- server.ts app/entry.client.tsx app/root.tsx app/lib app/routes
```

If this is still the most recent change to those files **and** the commit contains only Sentry work, a normal revert may be the quickest route. The current working tree also contains an unrelated Upstash documentation edit, so check the actual commit contents first:

```powershell
git switch -c revert-sentry-incident origin/main
git revert <change-sha>
```

After later work has changed those files, **do not blindly revert the old commit**. On a new branch from current `main`, remove only Sentry initialization, its browser import/meta/CSP changes, the monitoring calls and helper files listed above, and the Sentry packages from `package.json`/lockfile. Remove or adapt Sentry-specific tests and environment declarations. Keep subsequent product fixes and the separate Upstash planning text in `PRODUCTION_READINESS.md`. If GitHub created a true merge commit, `git revert -m 1 <merge-sha>` is likewise appropriate only after inspecting its parents and complete diff. Run the repository checks, open/merge the removal PR, and verify its Oxygen deployment. The workflow in `.github/workflows/oxygen-deployment-1000176591.yml` gates push deployment on formatting/lint, TypeScript, unit/integration tests, Playwright storefront, and build.

## Sources and operational limits

- [Shopify Oxygen deployments and rollback steps](https://shopify.dev/docs/storefronts/headless/hydrogen/deployments): only production/custom environments support selecting an older deployment; a later push restores latest-deployment behavior.
- [Shopify Oxygen environments](https://shopify.dev/docs/storefronts/headless/hydrogen/environments): deployment environment variables are immutable; changing them requires redeployment.
- This runbook was written from the uncommitted working tree. Recheck the inventory and fill the release record after committing. Do not treat a green build or the monitoring flag as proof of live checkout or order reconciliation.
