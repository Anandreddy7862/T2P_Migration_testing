import type { Locator, Page } from '@playwright/test';

/**
 * Locators for the "Which data do you want to export?" dialog.
 *
 * An IN-PAGE dialog, not a popup window - so these are built against the report
 * page itself rather than a new page.
 */
export class PowerBiExportDataPageLocators {
  constructor(private page: Page) {}

  /** The file-format dropdown, closed. */
  formatDropdown = (): Locator => this.page.locator('div[data-testid="pbi-dropdown-trigger-container"]').first();

  /** The list of formats, once the dropdown is open. */
  formatOptions = (): Locator => this.page.locator('div[class="dropdown-scroll"]').first();

  /**
   * The csv row.
   *
   * The dialog opens on ".xlsx (Excel) with live connection (500,000 row max)",
   * so this selection is not optional - skipping it exports a workbook with no
   * data rows in it. Note Power BI caps a csv export at 30,000 rows.
   */
  csvOption = (): Locator =>
    this.page
      .locator('//div[@data-testid="pbi-dropdown-item"]//span[contains(text(),".csv (30,000-row max)")]')
      .first();

  exportButton = (): Locator => this.page.locator('button[data-testid="export-btn"]').first();

  closeButton = (): Locator => this.page.locator('button[data-testid="close-btn"]').first();
}
