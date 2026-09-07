import type { Locator, Page } from '@playwright/test';

/**
 * Locators for `sso.online.tableau.com/public/idp/SSO` - "Sign in to Tableau
 * Cloud". A single email box; the password is collected on the next screen.
 *
 * Built-in `getBy*` first, with the verified id as an `or()` fallback so a
 * label change on either side keeps the locator working.
 */
export class TableauSignInPageLocators {
  constructor(private page: Page) {}

  emailInput = (): Locator => this.page.getByLabel(/username|email/i).or(this.page.locator('#email')).first();

  signInButton = (): Locator =>
    this.page.getByRole('button', { name: /sign in/i }).or(this.page.locator('#login-submit')).first();
}
