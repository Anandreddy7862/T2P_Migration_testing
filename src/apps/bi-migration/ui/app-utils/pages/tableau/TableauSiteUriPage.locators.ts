import type { Locator, Page } from '@playwright/test';

/**
 * Locators for "Tell us where to sign in" (`/public/prelogin/siteURI`).
 *
 * Tableau asks for the site URI when it cannot work out which site you want -
 * the site lives in the url FRAGMENT (`#/site/<site>/...`), which browsers never
 * send to the server.
 */
export class TableauSiteUriPageLocators {
  constructor(private page: Page) {}

  /** Detected by wording: the lone text box would fool a field-based check. */
  pageHeading = (): Locator => this.page.getByText(/tell us where to sign in|enter your site URI/i).first();

  siteUriInput = (): Locator =>
    this.page
      .getByLabel(/URI/i)
      .or(this.page.locator('#siteUrlName'))
      .or(this.page.locator('input.tb-text-box-input:not([type="email"]):not([type="password"])'))
      .first();

  continueButton = (): Locator =>
    this.page.getByRole('button', { name: /continue/i }).or(this.page.locator('#site-submit')).first();
}
