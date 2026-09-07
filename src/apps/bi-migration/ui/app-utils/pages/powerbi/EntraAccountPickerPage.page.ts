import type { Page } from '@playwright/test';

import { BasePage } from '@common-utils/base/BasePage';
import { click, clickIfVisible } from '@common-utils/ui-utils/actions';
import { isVisibleWithin, waitForVisible } from '@common-utils/ui-utils/waits';

import { EntraAccountPickerPageLocators } from './EntraAccountPickerPage.locators';

/** "Pick an account" - shown when the browser already knows several. */
export class EntraAccountPickerPage extends BasePage {
  private locators: EntraAccountPickerPageLocators;

  constructor(page: Page) {
    super(page);
    this.locators = new EntraAccountPickerPageLocators(page);
  }

  async waitForPageLoad(): Promise<void> {
    await waitForVisible(this.locators.tileList());
  }

  async isDisplayed(): Promise<boolean> {
    return isVisibleWithin(this.locators.tileList());
  }

  /** Picks our account's tile, else "Use another account". */
  async chooseAccount(account: string): Promise<boolean> {
    if (await isVisibleWithin(this.locators.tileByAccount(account), 2_000)) {
      await click(this.locators.tileByAccount(account));
      return true;
    }
    return clickIfVisible(this.locators.useAnotherAccountTile(), 5_000);
  }
}
