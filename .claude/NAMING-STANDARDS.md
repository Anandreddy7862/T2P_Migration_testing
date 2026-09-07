# Naming Standards

This document defines the naming conventions for folders, files, and code identifiers in this Playwright/TypeScript automation repository. It is the single source of truth — when in doubt, follow what is written here.

---

## 1. Folders

| Folder type | Convention | Examples |
|---|---|---|
| App / top-level domain | `kebab-case` | `comply-platform`, `common-utils` |
| Functional layer (single word) | `lowercase` | `api`, `ui`, `tests`, `pages`, `modules`, `services`, `data`, `fixtures`, `constants` |
| Feature / domain (multi-word) | `kebab-case` | `audit-log`, `data-records`, `restricted-security-list`, `gift-and-entertainment`, `csi-admin` |
| Test groupings inside `tests/` | `kebab-case` (mirror feature folder) | `tests/audit-log/`, `tests/preclearance/rules/` |

**Rules**

- Never use `camelCase` or `PascalCase` for folders.
- No spaces, no underscores.
- One spelling per concept across the entire repo (see §7).

---

## 2. Files

| File type | Convention | Example |
|---|---|---|
| Test specs | `kebab-case.spec.ts` | `add-new-user.spec.ts` |
| Page Object class | `PascalCase.page.ts` | `LoginPage.page.ts` |
| Locator definitions | `PascalCase.locators.ts` | `LoginPage.locators.ts` |
| Module / helper class | `PascalCase.ts` | `EnvConfig.ts` |
| Utility / function-only file | `kebab-case.ts` | `date-utils.ts` |
| Setup / fixture file | `kebab-case.setup.ts` or `.fixture.ts` | `auth.setup.ts` |
| Config files | `kebab-case` (or tool-mandated) | `playwright.config.ts`, `eslint.config.mjs` |
| Test data JSON | `kebab-case.json` | `compliance-test-data.json` |
| Type-only declaration | `kebab-case.types.ts` | `report-filters.types.ts` |
| Barrel export | `index.ts` | always lowercase `index.ts` |

**Rule of thumb:** if the file's *primary* export is a class → `PascalCase`. Otherwise → `kebab-case`.

---

## 3. Code identifiers (inside files)

| What | Convention | Example |
|---|---|---|
| Classes, types, interfaces, enums | `PascalCase` | `class LoginPage`, `type UserRole`, `enum StorageRole` |
| Functions, methods, variables | `camelCase` | `getUserByEmail()`, `const baseUrl` |
| Constants (compile-time) | `UPPER_SNAKE_CASE` | `const MAX_RETRIES = 3` |
| Booleans | `is/has/can/should…` prefix | `isLoaded`, `hasAccess`, `canEdit` |
| Private members | no leading `_` unless required | `private cache` (preferred) |
| Generic type params | `T`, `TKey`, `TValue` | `Map<TKey, TValue>` |
| Acronyms in identifiers | treat as a word | `HttpClient` (not `HTTPClient`), `csiAdmin` (not `CSIAdmin`) |

---

## 4. Imports & path aliases

- Aliases use `@kebab-case/*` and live in [tsconfig.json](../tsconfig.json).
- Current aliases: `@common-utils`, `@common-components`, `@api-data`, `@comply-platform`, `@fixtures`, `@modules`, `@pages`, `@data`, `@constants`.
- Always prefer alias imports over deep relative paths.
  - Good: `import { LoginPage } from '@pages/login/LoginPage.page';`
  - Bad:  `import { LoginPage } from '../../../app-utils/pages/login/LoginPage.page';`

---

## 5. Test names

- Use plain English, sentence case.
- Do not bake ticket IDs into the test title — put them in `test.info().annotations` or a JSDoc `@ticket` tag.
- Pattern: `should <expected behavior> when <condition>`

```ts
// Good
test('should reject login when password is empty', ...);

// Bad
test('Test_LoginInvalid_PTCCFOUR-12345', ...);
```

---

## 6. Ticket / external references

- Do not bake Jira IDs into folder or file names.
- Keep IDs in `test.info().annotations` or a JSDoc `@ticket` comment at the top of the spec.
- Folder and file names should describe **behavior**, not project tracker IDs.

---

## 7. Disambiguation rules (the ones that bite you)

1. **One spelling per concept across the entire repo.** If `pages/` calls it `data-records`, `tests/` must also call it `data-records`. Never both.
2. **Plural vs singular.** Plural for collections (`users/`, `reports/`, `tests/`); singular for a single-entity domain (`audit-log/`, `dashboard/`). Do not mix `report/` and `reports/`.
3. **Case sensitivity.** Treat the filesystem as case-sensitive even on Windows. `LoginPage.ts` and `loginpage.ts` would be different files on Linux CI; never let both exist.
4. **No abbreviations except universal ones.** OK: `id`, `url`, `api`, `ui`, `csv`, `json`. Not OK: `usr`, `cfg`, `mgr`, `tmpl`. Spell it out.
5. **Folder name = the thing, not the layer.** `pages/login/` not `pages/login-page/`. The `pages/` folder already conveys the layer.

---

## 8. Compliance status

As of the last sweep, the repository is fully compliant with this standard: all folders use `kebab-case` (or single-word `lowercase` for layers), the top-level app folder is `comply-platform`, and the `@comply-platform/*` alias matches its folder.

When adding new folders, run a quick check before committing:

```powershell
Get-ChildItem src -Recurse -Directory | Where-Object { $_.Name -cmatch '[a-z][A-Z]' }
```

If anything is returned, rename it before merging.

---

## 9. Summary cheat-sheet

```
folders ............... kebab-case        (audit-log, data-records)
single-word layers .... lowercase         (api, ui, tests, pages)
class files ........... PascalCase.ts     (LoginPage.page.ts)
non-class files ....... kebab-case.ts     (date-utils.ts, add-new-user.spec.ts)
classes/types ......... PascalCase        (class LoginPage)
functions/vars ........ camelCase         (getUserByEmail)
constants ............. UPPER_SNAKE_CASE  (MAX_RETRIES)
booleans .............. is/has/can/should (isLoaded, hasAccess)
aliases ............... @kebab-case/*     (@common-utils, @comply-platform)
```
