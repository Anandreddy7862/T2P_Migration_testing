import { test as base, expect } from '@playwright/test';

import { EnvConfig } from '@common-utils/helpers/EnvConfig';
import { PageManager } from '@pages/PageManager';

import { UiModuleManager } from '@modules/UiModuleManager';

/**
 * Base UI test. Specs reach modules through `uiModuleManager` and never
 * construct a page object; both registries are lazy, so nothing is instantiated
 * until a spec touches it.
 */
interface UiFixtures {
  pageManager: PageManager;
  uiModuleManager: UiModuleManager;
}

export const test = base.extend<UiFixtures>({
  pageManager: async ({ page }, use) => {
    await use(new PageManager(page));
  },
  uiModuleManager: async ({ page }, use) => {
    await use(new UiModuleManager(page));
  },
});

/** Saved sessions, one per platform, for `test.use({ storageState })`. */
export const storageState = {
  tableau: EnvConfig.tableau.storageState,
  powerBi: EnvConfig.powerBi.storageState,
} as const;

export { expect };
