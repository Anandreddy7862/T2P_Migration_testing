import type { Locator, Page } from '@playwright/test';

/**
 * Locators for Power BI's own pre-auth gate - `app.powerbi.com/singleSignOn`.
 *
 * "Enter your work or school email, we'll check if you need to create a new
 * account." NOT the Entra ID form: different markup, a plain `#email` text input
 * and `#submitBtn`. Some tenants skip it entirely.
 */
export class PowerBiEmailGatePageLocators {
  constructor(private page: Page) {}

  emailInput = (): Locator =>
    this.page.getByPlaceholder(/enter email/i).or(this.page.locator('#email')).or(this.page.locator('input.pbi-text-input')).first();

  submitButton = (): Locator =>
    this.page.getByRole('button', { name: /^submit$/i }).or(this.page.locator('#submitBtn')).first();
}
