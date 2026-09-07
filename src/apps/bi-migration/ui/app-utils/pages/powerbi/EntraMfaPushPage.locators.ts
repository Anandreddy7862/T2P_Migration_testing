import type { Locator, Page } from '@playwright/test';

/**
 * Locators for the Entra "Approve sign in request" screen (push / number
 * matching).
 *
 * This screen cannot be got past by automation - the approval must come from the
 * enrolled phone, which is precisely what number matching exists to enforce. The
 * locators exist to RECOGNISE it and surface the number a human must enter.
 */
export class EntraMfaPushPageLocators {
  constructor(private page: Page) {}

  approvalPrompt = (): Locator =>
    this.page
      .getByText(/approve sign.?in request|open your authenticator app|enter the number shown/i)
      .or(this.page.locator('#idDiv_RemoteNGC_PageTitle'))
      .first();

  /** The 2-digit number the phone must be told, under number matching. */
  matchingNumber = (): Locator => this.page.locator('#idRemoteNGC_DisplaySign, [data-testid="displaySign"]').first();
}
