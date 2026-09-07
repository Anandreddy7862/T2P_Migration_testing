import type { Page } from '@playwright/test';

import { BasePage } from '@common-utils/base/BasePage';
import { clickIfVisible } from '@common-utils/ui-utils/actions';
import { isVisibleWithin, waitForVisible } from '@common-utils/ui-utils/waits';

import { EntraMfaMethodPickerPageLocators } from './EntraMfaMethodPickerPage.locators';
import { ENTRA_MFA_METHOD } from '@constants/powerbi.constants';

/** "Verify your identity" - choose which registered second factor to use. */
export class EntraMfaMethodPickerPage extends BasePage {
  private locators: EntraMfaMethodPickerPageLocators;

  constructor(page: Page) {
    super(page);
    this.locators = new EntraMfaMethodPickerPageLocators(page);
  }

  async waitForPageLoad(): Promise<void> {
    await waitForVisible(this.locators.methodList());
  }

  async isDisplayed(): Promise<boolean> {
    return isVisibleWithin(this.locators.methodList());
  }

  /** Returns whether the method was offered and chosen. */
  async chooseMethod(methodCode: string): Promise<boolean> {
    return clickIfVisible(this.locators.methodByCode(methodCode), 5_000);
  }

  async choosePushNotification(): Promise<boolean> {
    return this.chooseMethod(ENTRA_MFA_METHOD.push);
  }
}
