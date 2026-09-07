import type { Locator, Page } from '@playwright/test';

import { BasePage } from '@common-utils/base/BasePage';
import { clearAndFill, click, readText } from '@common-utils/ui-utils/actions';
import { isVisibleWithin, waitForVisible } from '@common-utils/ui-utils/waits';

import { EntraPasswordPageLocators } from './EntraPasswordPage.locators';

/** The Entra ID "Enter password" screen. */
export class EntraPasswordPage extends BasePage {
  private locators: EntraPasswordPageLocators;

  constructor(page: Page) {
    super(page);
    this.locators = new EntraPasswordPageLocators(page);
  }

  async waitForPageLoad(): Promise<void> {
    await waitForVisible(this.locators.passwordInput());
  }

  async isDisplayed(): Promise<boolean> {
    return isVisibleWithin(this.locators.passwordInput());
  }

  async submitPassword(password: string): Promise<void> {
    await clearAndFill(this.locators.passwordInput(), password);
    await click(this.locators.signInButton());
  }

  async readErrorMessage(): Promise<string | null> {
    if (!(await isVisibleWithin(this.locators.errorText(), 300))) return null;
    return readText(this.locators.errorText());
  }

  errorText(): Locator {
    return this.locators.errorText();
  }
}
