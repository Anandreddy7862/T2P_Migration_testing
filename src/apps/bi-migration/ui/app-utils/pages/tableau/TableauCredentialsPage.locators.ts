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

  /**
   * The IdP names the field `login_password`, not `password`.
   *
   * Every branch is narrowed with `and(input[type="password"])`, and that guard
   * is load-bearing. Tableau's "Sign in to reconnect" data source dialog puts a
   * "Remember Password" CHECKBOX on the authoring page, and a bare
   * `getByLabel(/password/i)` resolves to it - that dialog's real password box
   * carries an EMPTY <label>, so the checkbox is the only thing the label match
   * can find. Without the guard the screen probe reads an already-signed-in
   * authoring page as the credentials screen and the sign-in flow spins trying
   * to `fill()` a checkbox.
   */
  passwordInput = (): Locator =>
    this.page
      .getByLabel(/password/i)
      .or(this.page.locator('#password'))
      .or(this.page.locator('input[name="login_password"]'))
      .and(this.page.locator('input[type="password"]'))
      .first();

  signInButton = (): Locator =>
    this.page.getByRole('button', { name: /sign in/i }).or(this.page.locator('#signInButton')).first();

  errorBanner = (): Locator => this.page.locator('.tb-alert-danger, [role="alert"], .error-message').first();
}
