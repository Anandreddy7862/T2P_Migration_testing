import type { Locator, Page } from '@playwright/test';

import { BasePage } from '@common-utils/base/BasePage';
import { clearAndFill, click, readText } from '@common-utils/ui-utils/actions';
import { isVisibleWithin, waitForVisible } from '@common-utils/ui-utils/waits';

import { TableauCredentialsPageLocators } from './TableauCredentialsPage.locators';

/**
 * A login field that is not there within this budget means the page moved on.
 * The flow re-observes and retries, so waiting the global 60s actionTimeout
 * would only delay that.
 */
const LOGIN_FIELD_TIMEOUT_MS = 10_000;

/**
 * The Tableau identity-provider screen: email + password together.
 *
 * THE TRAP: it arrives with the email box empty. Filling only the password
 * submits a blank username, and Tableau answers with its generic "The sign-in
 * was unsuccessful. Try again." - which reads exactly like a wrong password and
 * sends you hunting for the wrong bug. `signIn()` always fills both.
 *
 * Tableau Server typically presents one page with both fields too, so this page
 * object covers that variant as well.
 */
export class TableauCredentialsPage extends BasePage {
  private locators: TableauCredentialsPageLocators;

  constructor(page: Page) {
    super(page);
    this.locators = new TableauCredentialsPageLocators(page);
  }

  async waitForPageLoad(): Promise<void> {
    await waitForVisible(this.locators.passwordInput());
  }

  /** A visible password box means this screen wants the full credentials. */
  async isDisplayed(): Promise<boolean> {
    return isVisibleWithin(this.locators.passwordInput());
  }

  async signIn(username: string, password: string): Promise<void> {
    if (await isVisibleWithin(this.locators.emailInput())) {
      await clearAndFill(this.locators.emailInput(), username, LOGIN_FIELD_TIMEOUT_MS);
    }
    await clearAndFill(this.locators.passwordInput(), password, LOGIN_FIELD_TIMEOUT_MS);
    await click(this.locators.signInButton());
  }

  /** The rejection text, when the screen is showing one. */
  async readErrorMessage(): Promise<string | null> {
    if (!(await isVisibleWithin(this.locators.errorBanner(), 300))) return null;
    return readText(this.locators.errorBanner());
  }

  errorBanner(): Locator {
    return this.locators.errorBanner();
  }
}
