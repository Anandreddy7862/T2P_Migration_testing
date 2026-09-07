import { expect, type Locator } from '@playwright/test';

/**
 * Typed assertion wrappers.
 *
 * Pages and modules must not import `expect` directly - every assertion goes
 * through here and every wrapper demands a human-readable `message`, so a
 * failure names the business rule that broke rather than a selector.
 */

export async function assertVisible(locator: Locator, message: string, timeout = 30_000): Promise<void> {
  await expect(locator, message).toBeVisible({ timeout });
}

export function assertUrlDoesNotMatch(actualUrl: string, pattern: RegExp, message: string): void {
  expect(actualUrl, message).not.toMatch(pattern);
}

export function assertTrue(condition: boolean, message: string): void {
  expect(condition, message).toBe(true);
}
