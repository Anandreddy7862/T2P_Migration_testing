import type { Locator, Page } from '@playwright/test';

/**
 * Locators for the "View Data" window, which Tableau opens as a NEW TAB titled
 * "View Data: <worksheet name>" - the only place the visual names itself.
 */
export class TableauViewDataPageLocators {
  constructor(private page: Page) {}

  panelContent = (): Locator =>
    this.page.locator('//div[contains(@class,"ViewDataPanelContent__tabContent")]').first();

  downloadButton = (): Locator => this.page.locator('button[data-tb-test-id="download-data-Button"]').first();
}
