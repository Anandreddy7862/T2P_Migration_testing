import type { Locator, Page } from '@playwright/test';

import { BasePage } from '@common-utils/base/BasePage';
import { clearAndFill, click } from '@common-utils/ui-utils/actions';
import { isVisibleWithin, waitForVisible } from '@common-utils/ui-utils/waits';

import { TableauSignInPageLocators } from './TableauSignInPage.locators';

/**
 * A login field that is not there within this budget means the page moved on.
 * The flow re-observes and retries, so waiting the global 60s actionTimeout
 * would only delay that.
 */
const LOGIN_FIELD_TIMEOUT_MS = 10_000;

/** Step 1 of the Tableau Cloud sign-in: the username. */
export class TableauSignInPage extends BasePage {
  private locators: TableauSignInPageLocators;

  constructor(page: Page) {
    super(page);
    this.locators = new TableauSignInPageLocators(page);
  }

  async waitForPageLoad(): Promise<void> {
    await waitForVisible(this.locators.emailInput());
  }

  /** Whether this screen is the one currently on show. */
  async isDisplayed(): Promise<boolean> {
    return isVisibleWithin(this.locators.emailInput());
  }

  async submitUsername(username: string): Promise<void> {
    await clearAndFill(this.locators.emailInput(), username, LOGIN_FIELD_TIMEOUT_MS);
    await click(this.locators.signInButton());
  }

  emailInput(): Locator {
    return this.locators.emailInput();
  }
}
