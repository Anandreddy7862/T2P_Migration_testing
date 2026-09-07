import type { Locator, Page } from '@playwright/test';

/**
 * Locators for the Tableau identity provider - `identity.idp.tableau.com/login`.
 *
 * Carries BOTH an email box and a password box. The email arrives EMPTY even
 * though the previous screen collected it (it is in the url as `login_hint`,
 * just not populated), so both must be filled - see the page class.
 */
export class TableauCredentialsPageLocators {
  constructor(private page: Page) {}

  emailInput = (): Locator => this.page.getByLabel(/email|username/i).or(this.page.locator('#email')).first();

  /** The IdP names the field `login_password`, not `password`. */
  passwordInput = (): Locator =>
    this.page
      .getByLabel(/password/i)
      .or(this.page.locator('#password'))
      .or(this.page.locator('input[name="login_password"]'))
      .first();

  signInButton = (): Locator =>
    this.page.getByRole('button', { name: /sign in/i }).or(this.page.locator('#signInButton')).first();

  errorBanner = (): Locator => this.page.locator('.tb-alert-danger, [role="alert"], .error-message').first();
}
