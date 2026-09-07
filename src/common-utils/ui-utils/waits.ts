import type { Locator, Page } from '@playwright/test';

/** Shared wait helpers. Page objects wait through these, never inline. */

const DEFAULT_TIMEOUT = 30_000;

export async function waitForVisible(locator: Locator, timeout = DEFAULT_TIMEOUT): Promise<void> {
  await locator.waitFor({ state: 'visible', timeout });
}

export async function waitForHidden(locator: Locator, timeout = DEFAULT_TIMEOUT): Promise<void> {
  await locator.waitFor({ state: 'hidden', timeout });
}

/**
 * Best-effort network quiet. Canvas apps (Tableau viz, Power BI report) keep
 * polling, so this must never be the only readiness signal - pair it with a
 * visible element.
 */
export async function waitForNetworkIdle(page: Page, timeout = DEFAULT_TIMEOUT): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout }).catch(() => undefined);
}

export async function waitForDomReady(page: Page, timeout = DEFAULT_TIMEOUT): Promise<void> {
  await page.waitForLoadState('domcontentloaded', { timeout }).catch(() => undefined);
}

/** True when the locator becomes visible inside the budget, false otherwise. */
export async function isVisibleWithin(locator: Locator, timeout = 250): Promise<boolean> {
  return locator.isVisible({ timeout }).catch(() => false);
}
