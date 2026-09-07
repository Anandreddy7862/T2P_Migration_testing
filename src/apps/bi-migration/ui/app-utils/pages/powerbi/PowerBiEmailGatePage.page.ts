import type { Page } from '@playwright/test';

import { BasePage } from '@common-utils/base/BasePage';
import { clearAndFill, click } from '@common-utils/ui-utils/actions';
import { isVisibleWithin, waitForVisible } from '@common-utils/ui-utils/waits';

import { PowerBiEmailGatePageLocators } from './PowerBiEmailGatePage.locators';

/**
 * Power BI's pre-auth email gate.
 *
 * THE TRAP: it renders only AFTER the redirect from the report url, so it must
 * be waited for rather than probed once - a flow that checks immediately sees
 * nothing, moves on, and then hangs looking for a password field.
 *
 * Submitting forwards the address to Entra as `login_hint`, which is why the
 * Entra email step is usually skipped afterwards.
 */
export class PowerBiEmailGatePage extends BasePage {
  private locators: PowerBiEmailGatePageLocators;

  constructor(page: Page) {
    super(page);
    this.locators = new PowerBiEmailGatePageLocators(page);
  }

  async waitForPageLoad(): Promise<void> {
    await waitForVisible(this.locators.emailInput());
  }

  async isDisplayed(): Promise<boolean> {
    return isVisibleWithin(this.locators.emailInput());
  }

  async submitEmail(username: string): Promise<void> {
    await clearAndFill(this.locators.emailInput(), username);
    await click(this.locators.submitButton());
  }
}
