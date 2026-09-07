import type { Page } from '@playwright/test';

import { BasePage } from '@common-utils/base/BasePage';
import { check } from '@common-utils/ui-utils/actions';
import { isVisibleWithin, waitForVisible } from '@common-utils/ui-utils/waits';

import { EntraMfaCodePageLocators } from './EntraMfaCodePage.locators';

/**
 * The Entra "Enter code" screen.
 *
 * Recognition only: the code has to be read off a device, and this tenant blocks
 * the third-party authenticator apps that would make it automatable. The module
 * ticks "remember this device" and then waits for a human.
 */
export class EntraMfaCodePage extends BasePage {
  private locators: EntraMfaCodePageLocators;

  constructor(page: Page) {
    super(page);
    this.locators = new EntraMfaCodePageLocators(page);
  }

  async waitForPageLoad(): Promise<void> {
    await waitForVisible(this.locators.codeInput());
  }

  async isDisplayed(): Promise<boolean> {
    return isVisibleWithin(this.locators.codeInput());
  }

  async rememberThisDevice(): Promise<void> {
    await check(this.locators.rememberDeviceCheckbox());
  }
}
