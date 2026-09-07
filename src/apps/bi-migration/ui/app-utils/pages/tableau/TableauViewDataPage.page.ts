import type { Locator, Page } from '@playwright/test';

import { BasePage } from '@common-utils/base/BasePage';
import { isVisibleWithin, waitForVisible } from '@common-utils/ui-utils/waits';

import { TableauViewDataPageLocators } from './TableauViewDataPage.locators';

/**
 * The View Data window for a single visual.
 *
 * Constructed against the NEW page Tableau opens, not the authoring page. The
 * download fires on this page, so the wait for it must be registered here.
 */
export class TableauViewDataPage extends BasePage {
  private locators: TableauViewDataPageLocators;

  constructor(page: Page) {
    super(page);
    this.locators = new TableauViewDataPageLocators(page);
  }

  async waitForPageLoad(): Promise<void> {
    await waitForVisible(this.locators.panelContent());
  }

  async isDisplayed(): Promise<boolean> {
    return isVisibleWithin(this.locators.panelContent(), 2_000);
  }

  /**
   * Tableau appends "(N marks)" to the window title when a mark selection is
   * active, and the export is then filtered to that selection rather than the
   * whole visual.
   */
  private static readonly SELECTION_SUFFIX = /\(\s*\d+\s+marks?\s*\)/i;

  /**
   * The worksheet name, taken from the tab title "View Data: <name>".
   *
   * The popup opens titled "Hybrid Popup Window" and is renamed a moment later,
   * so reading it immediately names every download after the popup instead of
   * the visual. Any "(N marks)" suffix is stripped so filenames stay stable.
   */
  async readVisualTitle(timeout = 15_000): Promise<string> {
    await this.page.waitForFunction(() => document.title.startsWith('View Data:'), undefined, { timeout }).catch(
      () => undefined,
    );
    const title = await this.page.title();
    return title.replace(/^View Data:\s*/i, '').replace(TableauViewDataPage.SELECTION_SUFFIX, '').trim() || 'untitled';
  }

  /**
   * Clicks Download only. The event fires on the opener tab, so the caller arms
   * the wait there - see TableauAuthoringPage.captureDownload().
   */
  async clickDownload(): Promise<void> {
    await this.locators.downloadButton().first().click({ timeout: 15_000 });
  }

  async close(): Promise<void> {
    await this.page.close();
  }

  downloadButton(): Locator {
    return this.locators.downloadButton();
  }
}
