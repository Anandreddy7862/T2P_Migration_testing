# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository purpose

Playwright + TypeScript automation framework for ComplySci (the **Comply Platform** product). UI specs run today; an API tier (`src/apps/comply-platform/api/`) is fully scaffolded but **not currently runnable** — the `api` and `api-auth-setup` projects are commented out in `playwright.config.ts:151-165` and `global-setup/api-token.setup.ts` does not exist. Treat the API tree as inert until those are restored.

## Commands

```bash
npm run test:auth          # Run only the auth-setup project (refreshes auth/<role>.json)
npm run test:smoke         # Run @smoke-tagged tests (across all projects)
npm run test:regression    # Run @regression-tagged tests (across all projects)
npm run report:playwright  # Open Playwright HTML report
npm run report:allure:generate && npm run report:allure:open
npm run tsc:check          # Type-check (no emit)
npm run lint               # ESLint over src
npm run lint:fix
```

UI tests are split into **per-feature batch projects** (see "Test execution model" below). There is one npm script per batch — run a feature's suite with its script:

```bash
npm run test:certifications
npm run test:reports
npm run test:data-records
npm run test:preclearance-config        # preclearance/{templates,questionnaires,rules}
npm run test:preclearance-requests
npm run test:users-cpm-csi-sso          # tests/{users,cpm,csi-admin,sso}
npm run test:audit-log
npm run test:smcr
npm run test:restricted-security-list
npm run test:control-room               # pinned --workers=1
npm run test:custom-preclearance
npm run test:communications
npm run test:case-management            # pinned --workers=1
npm run test:dashboard                  # pinned --workers=1
npm run test:config-isolated-serial     # @company-config-serial-isolated tests, --workers=1
```

`npm test` (bare `playwright test`) runs **every** project. There is no single "all UI" project anymore — the old `chromium-ui` project was replaced by the batches.

Run a single spec / test — pass `--project=<batch>` so `auth-setup` runs as its dependency:

```bash
npx playwright test src/apps/comply-platform/ui/tests/audit-log/audit-log.spec.ts --project=audit-log
npx playwright test --project=certifications -g "PTCCFOUR-58156"   # match by title
npx playwright test --project=certifications --grep @smoke
```

`test:api` does not exist; the `api` project is commented out in `playwright.config.ts`, so any `--project=api` filter matches nothing.

`.env` is required (copy `.env.example`). `EnvConfig` (`src/common-utils/helpers/EnvConfig.ts`) calls `required(...)` for many keys (BASE_URL, ADMIN_URL, all SMCR_* keys, DEFAULT_USER_PASS, certification users, etc.) — first import will throw if any are missing. `.env.example` is an incomplete template; check `EnvConfig.ts` for the authoritative list.

Husky + lint-staged run `eslint --fix` and `tsc --noEmit --skipLibCheck` on staged `.ts` files via `.husky/precommit`.

## Test execution model (batch projects)

`playwright.config.ts` defines one Playwright project **per feature batch** instead of a single UI project. Key facts:

- A `batch({ name, testDir|testMatch, fullyParallel })` helper (`playwright.config.ts:31-44`) declares each project. Every batch:
  - depends on `auth-setup` (`dependencies: ['auth-setup']` — **active**, not commented out), so storage state is refreshed automatically before the batch runs.
  - shares the `uiUse` Desktop-Chrome config.
  - excludes `@company-config-serial-isolated` tests via `grepInvert`.
- Batches are scoped by folder (`testDir`) or regex (`testMatch`) — e.g. `users-cpm-csi-sso` matches `tests/{users,cpm,csi-admin,sso}`, `preclearance-config` matches `preclearance/{templates,questionnaires,rules}`.
- Top-level `fullyParallel: false` and `workers: CI ? 4 : 3`; each batch sets its own `fullyParallel`. Playwright has no per-project `workers`, so batches that must run single-threaded pin `--workers=1` in their npm script (`control-room`, `case-management`, `dashboard`, `config-isolated-serial`).
- `slowMo: 400` and generous timeouts (action 25s, navigation 180s, expect 180s, test 300s) are set globally.

### `@company-config-serial-isolated` tag

Tests that mutate company-wide configuration and must run serially in isolation are tagged `@company-config-serial-isolated`. They span many folders (`configuration/`, `company-policy/`, `control-room/`, `case-management/`, `certifications/`, `communications/`, `custom-preclearance/`, `dashboard/`, `sso/`, …). The `configuration/` and `company-policy/` folders are **not** assigned to any batch — their specs run only here.

- Every batch project excludes these tests via `grepInvert: /@company-config-serial-isolated/`.
- The `config-isolated-serial` project (declared raw, **not** via `batch()`, so `grepInvert` is not applied) is the **only** project that runs them — serially, one worker.

## Architecture

The framework enforces a strict three-layer separation, validated by ESLint:

```
src/apps/comply-platform/ui/
├── app-utils/
│   ├── pages/             # Page layer: <Name>Page.page.ts (extends BasePage) + <Name>Page.locators.ts. Locators + low-level actions, NO assertions.
│   ├── modules/           # Business flows. Compose pages via this.pm.<page>. Hold ALL assertions.
│   ├── common-components/ # Shared cross-feature UI component helpers
│   ├── fixtures/          # ui/, api/, certifications/ fixtures → barrel re-exported by fixtures/index.ts
│   ├── constants/         # Per-feature *.constants.ts (UI strings, selectors, scenario data)
│   └── data/              # Static data + Faker builders
└── tests/<feature>/*.spec.ts   # Specs call uiModuleManager only — never reach into pages
```

`src/common-utils/` holds non-app primitives: `BasePage`, `LazyRegistry`, `EnvConfig`, `actions.ts`, `assertions.ts`, `waits.ts`, `date-utils.ts`, `attachmentUtils.ts`, plus the API base/client (`BaseApiService`, `ApiClient`, `RequestBuilder`, `ResponseHandler`).

### Page layer: `.page.ts` + `.locators.ts` split

A page object is **two files** (per `docs/NAMING-STANDARDS.md` §2 — `PascalCase.page.ts` / `PascalCase.locators.ts`):

- `<Name>Page.locators.ts` — a `<Name>PageLocators` class (`constructor(private page: Page) {}`) of **arrow-function `Locator` properties**. Static locators take no args (`pageTitle = (): Locator => this.page.getByRole(...)`); dynamic ones take a parameter (`rowByText = (text: string): Locator => …`). Compose dynamic locators from a stable container (`this.someSection().locator('tr', { hasText })`).
- `<Name>Page.page.ts` — the `<Name>Page` class that **extends `BasePage`**, instantiates `new <Name>PageLocators(page)` in its constructor, implements `waitForPageLoad()`, and exposes atomic actions (via `@common-utils/ui-utils/actions` + `waits`) plus locator getters that modules assert on. Locators + low-level actions only — **no assertions, no `expect`**.

The barrel exports the `<Name>Page` class (the `.page.ts` one) → `pm.<name>Page`. A few older pages keep locators inline in the `.page.ts` file; the split is the standard for new pages. Either way, **all locators stay in the page layer** — modules and specs never construct locators.

### Lazy Proxy registries (PageManager / UiModuleManager)

Adding a page or module = **one export line** in the relevant `index.ts` barrel. There are no manual getters.

- `PageManager` (`pages/PageManager.ts`) and `UiModuleManager` (`modules/UiModuleManager.ts`) both delegate to `createLazyRegistry()` in `src/common-utils/base/LazyRegistry.ts`.
- Property access (`pm.certificationFormPage`, `uiModuleManager.certificationForm`) is intercepted by a `Proxy`, mapped to a class name (capitalise first letter; modules also append `Module`), instantiated, cached per test, and returned.
- TypeScript-side declaration merging (`interface PageManager extends PageInstances`) provides full IntelliSense without hand-written types.
- Modules access pages via `this.pm.<page>`; specs access modules via `uiModuleManager.<module>`.

### Fixtures and storage state (auth)

`@fixtures` (alias for `src/apps/comply-platform/ui/app-utils/fixtures/index.ts`) re-exports from the subfolders and exposes `test`, `expect`, `storageState`, `createUserSession`, the `UserSession` type, and `apiTest`. The fixture files live in subdirectories:

- `fixtures/ui/ui.fixtures.ts` — base UI `test` (lazy `pageManager`/`uiModuleManager`, auto-navigate, suite labels, re-auth) plus `storageState` and `createUserSession`.
- `fixtures/api/api.fixtures.ts` — `apiTest`.
- `fixtures/certifications/certifications.fixtures.ts` — extends the UI `test` with a **worker-scoped** `certSharedForms` fixture that creates three canonical certification forms once per worker and archives them on teardown. Certification specs import `test` from this file instead of `@fixtures`.

Auth details:

- `global-setup/auth.setup.ts` (project `auth-setup`) logs in once per role and writes `auth/<role>.json`. It creates `supervisor` and `employee` unconditionally, and `admin` only when `ADMIN_URL` + the CSI admin user are configured. The `auth/` folder is gitignored.
- `storageState` exposes four roles: `supervisor`, `admin`, `employee`, `lineManager`. Specs select one with `test.use({ storageState: storageState.supervisor })`.
- **Tests must never log in themselves.** For a single role, use `storageState`. For multi-role workflows, use `createUserSession(browser, credentials, contextOptions?)` — it opens a fresh context, navigates, logs in once via the login module, and returns `{ context, modules, close }`; always `close()` it in a `finally` block. (`createUserSession` swallows OneDrive `ENOENT`/`EBUSY` trace-file errors on teardown.)
- `ensureAuthenticated()` (`global-setup/reauth.ts`) re-logs in if the saved storageState expired between `auth.setup` and the test. The UI `page` fixture calls it after the initial `goto`, so an expired session self-heals.
- Every batch project declares `dependencies: ['auth-setup']`, so storage state is refreshed automatically before tests run — you no longer need to run `test:auth` by hand (though it's still available to refresh state explicitly).
- Allure suite labels are auto-derived from the spec's folder path in `fixtures/ui/ui.fixtures.ts:42-66` — no manual `parentSuite()/suite()` calls needed.

### Assertion policy (ESLint-enforced)

Pages and modules **may not** import `expect` from `@playwright/test`. Use the typed wrappers in `src/common-utils/ui-utils/assertions.ts` (`assertVisible`, `assertText`, `assertCount`, `assertUrlContains`, `assertStringEquals`, …). Every wrapper requires a human-readable `message` that surfaces in Allure.

The rule (`no-restricted-imports`) is in `eslint.config.mjs:108-118` and applies to `pages/**` and `modules/**` (the `ASSERTION_RESTRICTED` glob, `eslint.config.mjs:16-19`). Specs may import `expect` but should prefer module methods that already encapsulate assertions.

If a matcher isn't covered (`expect.poll`, `expect.soft` on arrays, `toHaveLength`), import `rawExpect` from `assertions.ts` — that's the documented escape hatch.

### `test.step` titles

`test.step` is used at two layers, with **different phrasing rules**:

- **Spec layer** (`tests/**/*.spec.ts`) — titles must be in **BDD format**: `Given …`, `When …`, `Then …`, `And …`. They narrate the scenario for stakeholders and Allure. Body usually calls a single module method.
- **Module layer** (`app-utils/modules/**`) — titles must be **general imperative business text**: `Create …`, `Open …`, `Assert …`, `Verify …`. Never use Given/When/Then here, since the same module method may be invoked from any phase of a scenario.
- **Page layer** (`app-utils/pages/**`) — do **not** use `test.step` at all.

Use `return test.step(...)` when the module method returns a value (e.g. a created `caseId`); otherwise `await test.step(...)`. Wrap the entire public method body in one step — don't nest a step per page call.

### Path aliases

Defined in `tsconfig.json` and resolved by ESLint's TypeScript resolver. Always prefer aliases over deep relative paths:

```
@fixtures            src/apps/comply-platform/ui/app-utils/fixtures/index
@common-utils/*      src/common-utils/*
@comply-platform/*   src/apps/comply-platform/*
@modules/*           …/ui/app-utils/modules/*
@pages/*             …/ui/app-utils/pages/*
@common-components/* …/ui/app-utils/common-components/*
@data/*              …/ui/app-utils/data/*
@constants/*         …/ui/app-utils/constants/*
@api-data/*          …/api/data/*
```

ESLint enforces import grouping (`builtin/external` → `internal` → `relative`) with a blank line between groups, alphabetised within each.

## Conventions

- See `docs/NAMING-STANDARDS.md` for the single source of truth on folders, files, and identifiers. Rule of thumb: **class file → `PascalCase.ts`; non-class file → `kebab-case.ts`.**
- Test titles use plain English; Jira IDs go in tags (`@PTCCFOUR-58156`) and the `annotation` field, never in folder/file names.
- Spec tags: `@smoke`, `@regression`, `@<Feature>`, `@<TICKET>` (the `test:smoke` / `test:regression` scripts grep on these). Use `@company-config-serial-isolated` for tests that mutate company-wide config and must run serially in isolation.
- Strict ESLint: `no-explicit-any`, `no-floating-promises`, `await-thenable`, `no-misused-promises`, `require-await`, `consistent-type-imports`, `eqeqeq`, ordered imports — all error-level. `tsc --noEmit` is in lint-staged.
- `hardWait()` exists in `waits.ts` but is discouraged; prefer waiting on a real readiness signal.
- **Locator priority** for any new automation: (1) built-in Playwright locators (`getByRole`, `getByLabel`, `getByText`, `getByPlaceholder`, `getByTestId`, `getByAltText`, `getByTitle`) — first choice; (2) CSS selectors only when no `getBy*` works; (3) XPath only as a last resort. Built-ins survive DOM refactors; XPath is most fragile and least readable.
- **No inline locators, constants, or static data.** All locators live in the page layer only (the `<Name>Page.page.ts` class or its sibling `<Name>Page.locators.ts`) — modules and specs must never call `page.locator(...)` / `page.getByRole(...)`. All UI strings, labels, column titles, and error messages live in `app-utils/constants/<feature>.constants.ts`. All static test data and Faker builders live in `app-utils/data/<feature>/...`. Inline UI literals or hardcoded test data in pages/modules/specs are a review blocker, not a nit.
- Multi-role workflows: use `createUserSession()` (or open a second `browser.newContext({ storageState: 'auth/<role>.json' })`); never call a login module inline in a spec.
- Don't add API specs expecting them to run; the `api` project is disabled. If you must build something API-side, restore `playwright.config.ts:151-165` and create the missing `global-setup/api-token.setup.ts` first.

## Reports

- `playwright-report/` — Playwright HTML (auto-opens locally, `never` in CI)
- `reports/allure-results/` and `reports/allure-report/` — Allure (suite labels auto-derived)
- `reports/junit/results.xml` — JUnit XML
- `test-results/` — per-test artifacts (traces, videos)
