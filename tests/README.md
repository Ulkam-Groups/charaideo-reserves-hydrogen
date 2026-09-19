# Test suites

Run `npm test`, `npm run test:integration`, `npm run typecheck`,
`npm run format:check`, and `npm run lint` locally. The Oxygen workflow runs
these checks and the mock.shop Playwright suite before deployment.

`npm run test:e2e` starts an isolated MiniOxygen instance against Shopify's
public mock.shop catalog. Every browser request outside localhost is blocked;
the Fastrr script and stylesheet are fulfilled locally, and `buyDirect` is a
recording stub. Tests exercise successful launches, missing script, a thrown
vendor error, empty cart, quantity and UTM payloads, and cart persistence.
These tests **never open the vendor checkout or call its API**.
The server only queries mock.shop for product and cart fixtures. On Windows,
set `E2E_BROWSER_EXECUTABLE` to an installed Chrome executable if Playwright's
browser download is unavailable.

Customer Account browser tests need a separate `.myshopify.dev` test deployment
and a test customer's Playwright `storageState` JSON. Set
`E2E_ACCOUNT_BASE_URL` and `E2E_ACCOUNT_STORAGE_STATE` (a local file path),
then run `npm run test:e2e:account`. Set `E2E_ACCOUNT_ALLOW_WRITES=1` to enable
profile and address mutations. The suite uses a test address and deletes it.
Do not point this suite at production or commit the storage-state file.

For GitHub Actions, set repository variable `E2E_ACCOUNT_BASE_URL` to the test
deployment URL, secret `E2E_ACCOUNT_STORAGE_STATE_B64` to a base64-encoded
storage-state JSON, and variable `E2E_ACCOUNT_ALLOW_WRITES` to `1` when that
test customer may be modified. The account job runs on pushes only when the
URL variable is set. Refresh the secret when the test session expires.

The route integration suite injects Storefront and Customer Account client
responses, including GraphQL errors on HTTP 200, timeouts, and expired sessions.
It does not contact Shopify, Fastrr, or an external account endpoint.
