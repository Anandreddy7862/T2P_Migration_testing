import type { Locator, Page } from '@playwright/test';

/**
 * Locators for "Stay signed in?" (KMSI).
 *
 * This screen lives on `login.microsoftonline.com`, so any flow that waits for
 * the url to leave that host waits forever while a single click would finish the
 * sign-in. Answering Yes is what issues the persistent cookie - the difference
 * between a session that survives for weeks and one that dies with the browser.
 */
export class EntraStaySignedInPageLocators {
  constructor(private page: Page) {}

  prompt = (): Locator =>
    this.page.getByText(/stay signed in\?/i).or(this.page.locator('#KmsiDescription, #kmsiTitle')).first();

  yesButton = (): Locator =>
    this.page.getByRole('button', { name: /^yes$/i }).or(this.page.locator('#idSIButton9')).first();
}
