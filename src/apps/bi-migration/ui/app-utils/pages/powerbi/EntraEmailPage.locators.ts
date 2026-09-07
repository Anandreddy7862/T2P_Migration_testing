import type { Locator, Page } from '@playwright/test';

/**
 * Locators for the Entra ID email step. Usually skipped, because the Power BI
 * gate forwards the address as `login_hint`.
 *
 * Same decoy caveat as the password screen: the off-screen aria-hidden
 * `loginfmt` input must be excluded or it will be matched instead.
 */
export class EntraEmailPageLocators {
  constructor(private page: Page) {}

  emailInput = (): Locator =>
    this.page
      .locator('#i0116:not([aria-hidden="true"])')
      .or(this.page.locator('input[name="loginfmt"]:not([aria-hidden="true"]):not(.moveOffScreen)'))
      .first();

  nextButton = (): Locator =>
    this.page.getByRole('button', { name: /next/i }).or(this.page.locator('#idSIButton9')).first();
}
