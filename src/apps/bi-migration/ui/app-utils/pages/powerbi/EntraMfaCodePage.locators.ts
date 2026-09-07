import type { Locator, Page } from '@playwright/test';

/** Locators for the Entra "Enter code" screen (type=tel, name=otc). */
export class EntraMfaCodePageLocators {
  constructor(private page: Page) {}

  codeInput = (): Locator =>
    this.page
      .getByLabel(/code/i)
      .or(this.page.locator('#idTxtBx_SAOTCC_OTC'))
      .or(this.page.locator('input[name="otc"]'))
      .first();

  /** "Don't ask again for N days" - ticking it lengthens the saved session. */
  rememberDeviceCheckbox = (): Locator =>
    this.page.locator('#idChkBx_SAOTCC_TD, input[type="checkbox"][name="rememberMFA"]').first();
}
