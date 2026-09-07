import type { Locator, Page } from '@playwright/test';

import { BasePage } from '@common-utils/base/BasePage';
import { clickIfVisible } from '@common-utils/ui-utils/actions';
import { isVisibleWithin, waitForHidden, waitForVisible } from '@common-utils/ui-utils/waits';

import { PowerBiExportDataPageLocators } from './PowerBiExportDataPage.locators';

/**
 * The Export data dialog for one visual.
 *
 * Constructed against the REPORT page, not a new one: Export data raises an
 * in-page dialog and fires the download on the same page, so nothing here needs
 * a popup to be awaited.
 */
export class PowerBiExportDataPage extends BasePage {
  private locators: PowerBiExportDataPageLocators;

  constructor(page: Page) {
    super(page);
    this.locators = new PowerBiExportDataPageLocators(page);
  }

  async waitForPageLoad(): Promise<void> {
    await waitForVisible(this.locators.formatDropdown(), 30_000);
  }

  async isDisplayed(): Promise<boolean> {
    return isVisibleWithin(this.locators.formatDropdown(), 2_000);
  }

  /** Step 8: open the file-format dropdown. */
  async openFormatDropdown(): Promise<void> {
    await waitForVisible(this.locators.formatDropdown(), 30_000);
    await this.locators.formatDropdown().click({ timeout: 15_000 });
  }

  /** Step 9: the format list is on screen. */
  async waitForFormatOptions(timeout = 15_000): Promise<void> {
    await waitForVisible(this.locators.formatOptions(), timeout);
  }

  /** Step 10: pick csv, then export. */
  async selectCsvFormat(): Promise<void> {
    await waitForVisible(this.locators.csvOption(), 15_000);
    await this.locators.csvOption().click({ timeout: 15_000 });
  }

  /**
   * Clicks Export only. The caller arms the download wait on the report page -
   * see PowerBiReportPage.captureDownload().
   */
  async clickExport(): Promise<void> {
    await waitForVisible(this.locators.exportButton(), 15_000);
    await this.locators.exportButton().click({ timeout: 15_000 });
  }

  /**
   * Dismisses the dialog.
   *
   * Best effort on purpose: the dialog closes itself once the export starts, so
   * on the happy path there is nothing left to click. It matters on the failure
   * path, where a dialog left open covers the next visual.
   */
  async close(): Promise<void> {
    await clickIfVisible(this.locators.closeButton(), 2_000);
    await waitForHidden(this.locators.formatDropdown(), 10_000).catch(() => undefined);
  }

  formatDropdown(): Locator {
    return this.locators.formatDropdown();
  }

  formatOptions(): Locator {
    return this.locators.formatOptions();
  }

  csvOption(): Locator {
    return this.locators.csvOption();
  }

  exportButton(): Locator {
    return this.locators.exportButton();
  }
}
