import type { Locator, Page } from '@playwright/test';

/**
 * Locators for the Entra ID password screen.
 *
 * The `:not([aria-hidden="true"]):not(.moveOffScreen)` filters are load bearing.
 * Entra keeps a DECOY `input[name="loginfmt"]` on this page - parked off screen,
 * aria-hidden, holding the display name. Playwright counts it as visible (it has
 * a box, it is just outside the view), so an unfiltered locator makes a flow
 * think it is on the email step and then hang clicking an element the footer
 * intercepts.
 */
export class EntraPasswordPageLocators {
  constructor(private page: Page) {}

  passwordInput = (): Locator =>
    this.page
      .locator('#i0118:not([aria-hidden="true"])')
      .or(this.page.locator('input[type="password"]:not([aria-hidden="true"])'))
      .first();

  signInButton = (): Locator =>
    this.page.getByRole('button', { name: /sign in/i }).or(this.page.locator('#idSIButton9')).first();

  errorText = (): Locator => this.page.locator('#passwordError, #usernameError, [role="alert"]').first();
}
