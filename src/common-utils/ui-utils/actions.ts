import type { Locator } from '@playwright/test';

import { waitForVisible } from './waits';

/** Shared low-level actions. Page objects act through these, never inline. */

export async function click(locator: Locator, timeout = 30_000): Promise<void> {
  await waitForVisible(locator, timeout);
  try {
    await locator.click({ timeout });
  } catch {
    // Vendor login pages park footers and overlays over controls; a DOM-level
    // click bypasses the intercept without changing what is being clicked.
    //
    // The timeout MUST be forwarded. Without it this inherits the global
    // actionTimeout (60s), so an element that vanished mid-click stalls for a
    // full minute before failing - which is how a disappearing overlay took out
    // a whole extraction run.
    await locator.dispatchEvent('click', undefined, { timeout });
  }
}

/** Clicks only if the control is present. Returns whether it clicked. */
export async function clickIfVisible(locator: Locator, timeout = 3_000): Promise<boolean> {
  if (!(await locator.isVisible({ timeout }).catch(() => false))) return false;
  await locator.click({ timeout: 10_000 }).catch(() => locator.dispatchEvent('click'));
  return true;
}

export async function clearAndFill(locator: Locator, value: string, timeout = 30_000): Promise<void> {
  await waitForVisible(locator, timeout);
  // Focusing is a nicety - some login pages cover the input, and the fill is
  // what actually matters, so a failed click must not block it.
  await locator.click({ timeout: 5_000 }).catch(() => undefined);

  // The timeout MUST be passed on. Without it these inherit the global
  // actionTimeout (60s), so one fill against an element the page has already
  // navigated away from costs a full minute - and in an observational flow that
  // retries anyway, the minute is pure waste.
  await locator.fill('', { timeout });
  await locator.fill(value, { timeout });
}

export async function check(locator: Locator, timeout = 10_000): Promise<void> {
  if (!(await locator.isVisible({ timeout: 700 }).catch(() => false))) return;
  await locator.check({ timeout }).catch(() => undefined);
}

export async function readText(locator: Locator, timeout = 1_000): Promise<string | null> {
  const text = await locator.textContent({ timeout }).catch(() => null);
  return text?.replace(/\s+/g, ' ').trim() ?? null;
}
