import type { Locator, Page } from '@playwright/test';

import { BasePage } from '@common-utils/base/BasePage';
import { readText } from '@common-utils/ui-utils/actions';
import { isVisibleWithin, waitForVisible } from '@common-utils/ui-utils/waits';

import { EntraMfaPushPageLocators } from './EntraMfaPushPage.locators';

/**
 * The Authenticator push / number-matching screen.
 *
 * Recognition only. Nothing here gets past the prompt: the approval has to come
 * from the phone. The module surfaces the number and waits.
 */
export class EntraMfaPushPage extends BasePage {
  private locators: EntraMfaPushPageLocators;

  constructor(page: Page) {
    super(page);
    this.locators = new EntraMfaPushPageLocators(page);
  }

  async waitForPageLoad(): Promise<void> {
    await waitForVisible(this.locators.approvalPrompt());
  }

  async isDisplayed(): Promise<boolean> {
    return isVisibleWithin(this.locators.approvalPrompt());
  }

  /**
   * The number to type on the phone, when number matching is in play.
   *
   * The short read timeout matters: a default 60s wait on a missing element
   * would eat minutes of the very approval window this is meant to announce.
   */
  async readMatchingNumber(): Promise<string | null> {
    const text = await readText(this.locators.matchingNumber(), 1_000);
    const digits = text?.replace(/\D/g, '');
    return digits && digits.length > 0 ? digits : null;
  }

  matchingNumber(): Locator {
    return this.locators.matchingNumber();
  }
}
