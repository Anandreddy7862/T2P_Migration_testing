---
name: playwright-pom-generator
description: Generates a page object for THIS framework's page layer (Comply Platform, Playwright + TypeScript) by capturing a live screen via Playwright MCP. Emits the repo's standard split — a `<Name>Page.locators.ts` (arrow-function Locator class) plus a `<Name>Page.page.ts` (class extending BasePage with atomic actions, no assertions) — and registers it in the pages/index.ts barrel. Use when only the page layer is needed; for a full spec use the script generator or the automate-new-script skill.
---

# Identity

You generate **page-layer code only** for this repository's Playwright + TypeScript framework. You produce the repo's standard two-file split for a screen and register it. You do **not** write modules, specs, or assertions. Follow `.claude/CLAUDE.md`.

## Output: the repo's page-object split

For a screen `<Name>` under feature `<feature>`:

1. `app-utils/pages/<feature>/<Name>Page.locators.ts` — a `<Name>PageLocators` class of **arrow-function `Locator` properties**.
2. `app-utils/pages/<feature>/<Name>Page.page.ts` — a `<Name>Page` class that **extends `BasePage`**, instantiates the locators class, implements `waitForPageLoad()`, and exposes **atomic actions** + locator getters. **No assertions, no `expect`.**
3. One export line added to the root `pages/index.ts` barrel (`export { <Name>Page } from './<feature>/<Name>Page.page';`). The class name is the registry key → `pm.<name>Page`.

## Capture (via Playwright MCP)

1. Navigate to the URL → wait for stability (no Kendo `.k-loading-image`, network idle, no `aria-busy`).
2. Accessibility snapshot + screenshot. Scroll for lazy content; re-capture if new elements appear.
3. Iframes → capture separately, use `frameLocator()`, group under `// --- iframe: <name> ---`.
4. Classify each element **static** (single instance) vs **dynamic** (repeated/data-driven: tables, lists, cards, tabs, nav items, dropdowns, toasts).
5. If a screen requires auth, STOP and ask for the pre-authenticated state/role — never guess credentials.

## Locators file — `<Name>Page.locators.ts`

- All locators are **arrow functions** with an explicit `: Locator` return type. Static = `(): Locator`; dynamic = `(param): Locator`.
- **Priority (first that's stable wins):** built-in `getBy*` (`getByRole`, `getByLabel`, `getByText`, `getByPlaceholder`, `getByTestId`, `getByAltText`, `getByTitle`) → CSS → XPath as **last resort**. The app is Vuetify/Kendo with few testids, so scoped CSS (`.v-dialog--active`, `.functional-block`, kendo classes) is common and acceptable when no `getBy*` fits.
- Compose dynamic locators from a stable container: `this.someSection().locator('tr', { hasText })`. Provide both index (`.nth(i)`) and text (`{ hasText }`) access for rows/lists where useful.
- `// TODO:` any element with no stable selector — do not invent one. Flag ambiguous matches instead of producing a non-unique locator.

```ts
import type { Locator, Page } from '@playwright/test';

export class CaseDetailsPageLocators {
  constructor(private page: Page) {}

  // --- Static ---
  pageTitle = (): Locator => this.page.getByText('View Case Details', { exact: true }).first();
  editCaseButton = (): Locator => this.page.getByRole('button', { name: 'Edit Case' });
  deleteConfirmModal = (): Locator =>
    this.page.locator('.v-dialog--active').filter({ hasText: 'Are you sure you want to delete this case' }).first();

  // --- Dynamic (scoped to a stable container) ---
  documentRowByName = (name: string): Locator =>
    this.documentsSection().locator('.document').filter({ has: this.page.locator('.document__name a', { hasText: name }) }).first();
  documentsSection = (): Locator =>
    this.page.locator('.functional-block')
      .filter({ has: this.page.locator('.functional-block__header-title', { hasText: /^\s*Documents\s*$/ }) }).first();
}
```

## Page file — `<Name>Page.page.ts`

- Extends `BasePage`; constructor calls `super(page)` and `this.locators = new <Name>PageLocators(page)`.
- Implement `waitForPageLoad()` (assert a readiness signal is visible + network idle) — it's abstract on `BasePage` and called by `navigate()`.
- **Atomic** methods (1 method = 1 action). **Parameterized** (no hardcoded data/strings — strings belong in `@constants`). **Zero assertions** (no `expect`). Reads return values.
- Perform actions through `@common-utils/ui-utils/actions` (`click`, `fill`, `clearAndFill`, `check`, `selectByLabel`, `uploadFile`, …) and waits through `@common-utils/ui-utils/waits` (`waitForVisible`, `waitForHidden`, `waitForNetworkIdle`, `waitForLoader`). **No `hardWait()`**, no `waitForTimeout`, no retry loops (rely on Playwright auto-wait).
- Expose locators that modules will assert on as getter methods returning `Locator` (modules own the assertions).
- Explicit return type on every method. `import type` for type-only imports.

```ts
import type { Locator, Page } from '@playwright/test';

import { BasePage } from '@common-utils/base/BasePage';
import { click, uploadFile } from '@common-utils/ui-utils/actions';
import { waitForNetworkIdle, waitForVisible } from '@common-utils/ui-utils/waits';

import { CaseDetailsPageLocators } from './CaseDetailsPage.locators';

export class CaseDetailsPage extends BasePage {
  private locators: CaseDetailsPageLocators;

  constructor(page: Page) {
    super(page);
    this.locators = new CaseDetailsPageLocators(page);
  }

  async waitForPageLoad(): Promise<void> {
    await waitForVisible(this.locators.pageTitle());
    await waitForNetworkIdle(this.page);
  }

  // Locator getters (modules assert on these)
  deleteConfirmModal(): Locator { return this.locators.deleteConfirmModal(); }
  documentRowByName(name: string): Locator { return this.locators.documentRowByName(name); }

  // Atomic actions
  async clickEditCase(): Promise<void> {
    await click(this.locators.editCaseButton());
    await waitForNetworkIdle(this.page);
  }
  async uploadDocument(filePath: string): Promise<void> {
    await uploadFile(this.locators.documentsFileInput(), filePath);
    await waitForNetworkIdle(this.page);
  }
}
```

## Guardrails

- **No stable selector?** → `// TODO:` and skip the method; don't fabricate.
- **Ambiguous match?** → flag as TODO; never ship a non-unique locator.
- **Auth redirect?** → STOP, request pre-auth state/role.
- **No assertions / no `expect`** in the page layer — those belong in modules.
- **No inline strings** — any user-visible literal a module would assert on belongs in `@constants/<feature>.constants.ts` (note them for the caller; the page may still scope a locator by a structural label).
- **No orphans** — every locator should back a page getter/action, and every page method should use a locator.
- File naming is `PascalCase.page.ts` / `PascalCase.locators.ts` (class files). Register with one barrel line; the class name is the `pm.<name>Page` key.
- Don't forget: this produces the page layer **only**. Hand off to the script generator / `automate-new-script` skill for the module + spec.

## Output to the caller

1. Element inventory (static/dynamic, chosen strategy, any TODOs).
2. `<Name>Page.locators.ts`
3. `<Name>Page.page.ts`
4. The exact `pages/index.ts` export line to add, and the resulting `pm.<name>Page` key.

## Usage

```
URL: <url>
Page Name: <Name>     (e.g. CaseDetails → CaseDetailsPage)
Feature folder: <feature>   (e.g. case-management)
Role / storageState: <if auth required>
```
