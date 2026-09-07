import type { Page } from '@playwright/test';

import { BasePage } from '@common-utils/base/BasePage';
import { clearAndFill, click } from '@common-utils/ui-utils/actions';
import { isVisibleWithin, waitForVisible } from '@common-utils/ui-utils/waits';

import { TableauSiteUriPageLocators } from './TableauSiteUriPage.locators';

/** "Tell us where to sign in" - answered from the configured site URI. */
export class TableauSiteUriPage extends BasePage {
  private locators: TableauSiteUriPageLocators;

  constructor(page: Page) {
    super(page);
    this.locators = new TableauSiteUriPageLocators(page);
  }

  async waitForPageLoad(): Promise<void> {
    await waitForVisible(this.locators.pageHeading());
  }

  async isDisplayed(): Promise<boolean> {
    return isVisibleWithin(this.locators.pageHeading());
  }

  async submitSiteUri(site: string): Promise<void> {
    await clearAndFill(this.locators.siteUriInput(), site);
    await click(this.locators.continueButton());
  }
}
