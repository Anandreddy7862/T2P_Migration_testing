import type { Locator, Page } from '@playwright/test';

import { BasePage } from '@common-utils/base/BasePage';
import { click } from '@common-utils/ui-utils/actions';
import { isVisibleWithin, waitForVisible } from '@common-utils/ui-utils/waits';

import { EntraStaySignedInPageLocators } from './EntraStaySignedInPage.locators';

/** "Stay signed in?" - answering Yes is what makes the session persist. */
export class EntraStaySignedInPage extends BasePage {
  private locators: EntraStaySignedInPageLocators;

  constructor(page: Page) {
    super(page);
    this.locators = new EntraStaySignedInPageLocators(page);
  }

  async waitForPageLoad(): Promise<void> {
    await waitForVisible(this.locators.prompt());
  }

  async isDisplayed(): Promise<boolean> {
    return isVisibleWithin(this.locators.prompt());
  }

  async staySignedIn(): Promise<void> {
    await click(this.locators.yesButton());
  }

  prompt(): Locator {
    return this.locators.prompt();
  }
}
