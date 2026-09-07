import type { Page } from '@playwright/test';

import { BasePage } from '@common-utils/base/BasePage';
import { clearAndFill, click } from '@common-utils/ui-utils/actions';
import { isVisibleWithin, waitForVisible } from '@common-utils/ui-utils/waits';

import { EntraEmailPageLocators } from './EntraEmailPage.locators';

/** The Entra ID "Sign in" (email) screen. */
export class EntraEmailPage extends BasePage {
  private locators: EntraEmailPageLocators;

  constructor(page: Page) {
    super(page);
    this.locators = new EntraEmailPageLocators(page);
  }

  async waitForPageLoad(): Promise<void> {
    await waitForVisible(this.locators.emailInput());
  }

  async isDisplayed(): Promise<boolean> {
    return isVisibleWithin(this.locators.emailInput());
  }

  async submitEmail(username: string): Promise<void> {
    await clearAndFill(this.locators.emailInput(), username);
    await click(this.locators.nextButton());
  }
}
