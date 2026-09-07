import type { Page } from '@playwright/test';

import { BasePage } from '@common-utils/base/BasePage';
import { click } from '@common-utils/ui-utils/actions';
import { isVisibleWithin, waitForNetworkIdle, waitForVisible } from '@common-utils/ui-utils/waits';

import { TableauVizViewerPageLocators } from './TableauVizViewerPage.locators';

/**
 * The published view of a Tableau workbook, before entering authoring.
 *
 * Clicking Edit does not open a panel - it NAVIGATES to `/authoring/...` as a
 * full page, and from that point nothing is inside an iframe any more. Callers
 * must switch to the authoring page object afterwards.
 */
export class TableauVizViewerPage extends BasePage {
  private locators: TableauVizViewerPageLocators;

  constructor(page: Page) {
    super(page);
    this.locators = new TableauVizViewerPageLocators(page);
  }

  async waitForPageLoad(): Promise<void> {
    await waitForVisible(this.locators.vizFrameElement());
    await waitForVisible(this.locators.toolbar());
  }

  async isDisplayed(): Promise<boolean> {
    return isVisibleWithin(this.locators.toolbar(), 2_000);
  }

  /** Navigates the whole page into web authoring. */
  async openEditMode(): Promise<void> {
    await click(this.locators.editButton());
  }
}
