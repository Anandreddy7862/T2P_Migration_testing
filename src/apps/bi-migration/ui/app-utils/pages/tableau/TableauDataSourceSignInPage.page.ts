import type { Page } from '@playwright/test';

import { BasePage } from '@common-utils/base/BasePage';
import { check, click, clearAndFill, readText } from '@common-utils/ui-utils/actions';
import { isVisibleWithin, waitForHidden } from '@common-utils/ui-utils/waits';
import { TABLEAU_DATASOURCE } from '@constants/tableau.constants';

import type { DataSourceDialogScope } from './TableauDataSourceSignInPage.locators';
import { TableauDataSourceSignInPageLocators } from './TableauDataSourceSignInPage.locators';

/**
 * Tableau's "Sign in to reconnect" dialog for a workbook's LIVE data source.
 *
 * The prompt is OPTIONAL - a connection whose password Tableau has stored never
 * raises it - so every method here is written to report absence rather than to
 * wait for something that will not come.
 *
 * It is also raised in two different documents in one run (published view, then
 * authoring), so the scope is resolved per call rather than fixed in the
 * constructor.
 *
 * Locators and low-level actions only. The module owns the assertions.
 */
export class TableauDataSourceSignInPage extends BasePage {
  private locators: TableauDataSourceSignInPageLocators;

  constructor(page: Page) {
    super(page);
    this.locators = new TableauDataSourceSignInPageLocators(page);
  }

  /**
   * Waits for the prompt, tolerating its absence.
   *
   * Deliberately NOT a hard wait: an already-authenticated connection shows no
   * dialog at all, and that is a pass, not a timeout.
   */
  async waitForPageLoad(): Promise<void> {
    await this.isPrompted();
  }

  /**
   * The document that would hold the dialog on the CURRENT page.
   *
   * Decided from the url rather than by probing both documents. The published
   * view (`/#/site/.../views/...`) renders the viz - and any dialog over it -
   * inside an iframe, while Edit navigates the whole page to
   * `/t/<site>/authoring/...` where nothing is framed. One url test replaces
   * two sequential visibility probes, so an absent prompt costs one timeout
   * instead of two.
   */
  private scope(): DataSourceDialogScope {
    return this.page.url().includes('/authoring/')
      ? this.locators.authoringScope()
      : this.locators.publishedViewScope();
  }

  /**
   * Whether Tableau is asking for data source credentials, waiting up to
   * `timeout` for the dialog to be raised.
   *
   * This WAITS, and that is the whole point. `Locator.isVisible({ timeout })`
   * does not wait - the option caps how long the check may take, not how long
   * to wait for visibility, so it answers from the DOM as it stands
   * (measured: false in 63ms against a 15s option). A run that probed that way
   * looked for the dialog 0.4s after the viz toolbar appeared, concluded
   * nothing was prompting, and typed no credentials at all - then sat waiting
   * for a dialog that had appeared 0.4s later to close on its own.
   */
  async isPrompted(timeout: number = TABLEAU_DATASOURCE.promptTimeoutMs): Promise<boolean> {
    return this.locators
      .dialog(this.scope())
      .waitFor({ state: 'visible', timeout })
      .then(() => true)
      .catch(() => false);
  }

  /**
   * Fills both fields, ticks Remember Password when asked, and clicks Sign In.
   *
   * Returns whether it submitted - false means no dialog was raised inside the
   * wait, so there was nothing to answer.
   */
  async submitCredentials(username: string, password: string, rememberPassword = false): Promise<boolean> {
    if (!(await this.isPrompted())) return false;
    const scope = this.scope();

    await clearAndFill(this.locators.usernameInput(scope), username);
    await clearAndFill(this.locators.passwordInput(scope), password);

    if (rememberPassword) await check(this.locators.rememberPasswordCheckbox(scope));

    await click(this.locators.signInButton(scope));
    return true;
  }

  /**
   * Waits for the dialog to go away, which is how Tableau signals that the
   * connection reconnected.
   *
   * Throws if it stays up, and does so ON PURPOSE. A dialog that never closes
   * means the credentials were refused, and the run that follows is the
   * dangerous kind of failure: every visual still has a container, so the
   * extraction completes and writes one empty csv per visual while reporting
   * success. Better to stop here, with Tableau's own rejection text attached.
   *
   * Safe to call when nothing was prompted - `waitFor({ state: 'hidden' })`
   * passes immediately for an element that does not exist.
   */
  async waitForDialogToClose(timeout: number = TABLEAU_DATASOURCE.reconnectTimeoutMs): Promise<void> {
    const dialog = this.locators.dialog(this.scope());

    try {
      await waitForHidden(dialog, timeout);
    } catch (error) {
      const reason = await this.readErrorMessage();
      throw new Error(
        `${TABLEAU_DATASOURCE.dialogTitle} did not close within ${timeout}ms - Tableau refused the data ` +
          `source credentials (TABLEAU_DATASOURCE_USERNAME / TABLEAU_DATASOURCE_PASSWORD)` +
          `${reason ? `. Tableau said: ${reason}` : ''}`,
        { cause: error },
      );
    }
  }

  /** The rejection text Tableau put in the dialog, or null if there is none. */
  async readErrorMessage(): Promise<string | null> {
    const error = this.locators.errorDetails(this.scope());
    if (!(await isVisibleWithin(error, 2_000))) return null;
    return readText(error, 2_000);
  }
}
