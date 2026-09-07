import type { Locator, Page } from '@playwright/test';

/**
 * Locators for "Verify your identity" - the list of registered second factors.
 *
 * The tiles carry Entra's own stable method codes in `data-value`, which is far
 * more durable than matching display text:
 *   PhoneAppNotification = push        PhoneAppOTP = authenticator code
 *   OneWaySMS = text message           TwoWayVoiceMobile = phone call
 */
export class EntraMfaMethodPickerPageLocators {
  constructor(private page: Page) {}

  methodList = (): Locator =>
    this.page.locator('[data-value="PhoneAppOTP"], [data-value="PhoneAppNotification"]').first();

  /** Dynamic: one method tile by its Entra method code. */
  methodByCode = (code: string): Locator => this.page.locator(`[data-value="${code}"]`).first();
}
