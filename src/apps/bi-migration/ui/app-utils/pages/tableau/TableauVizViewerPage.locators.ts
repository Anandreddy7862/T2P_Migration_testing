import type { FrameLocator, Locator, Page } from '@playwright/test';

/**
 * Locators for the published-view (read-only) viz - `/#/site/<site>/views/...`.
 *
 * Everything here lives INSIDE an iframe. The outer document holds only the
 * Tableau Cloud shell, so a page-level lookup for the toolbar or the edit button
 * finds nothing. All locators are therefore built from a frame locator.
 */
export class TableauVizViewerPageLocators {
  private readonly viz: FrameLocator;

  constructor(private page: Page) {
    this.viz = this.page.frameLocator(TableauVizViewerPageLocators.VIZ_FRAME);
  }

  /** The viz iframe has no id, name or class - the src is the only handle. */
  static readonly VIZ_FRAME = 'iframe[src*="/views/"]';

  vizFrameElement = (): Locator => this.page.locator(TableauVizViewerPageLocators.VIZ_FRAME).first();

  toolbar = (): Locator => this.viz.locator('div[id="viz-viewer-toolbar"]').first();

  editButton = (): Locator => this.viz.locator('button[id="edit"]').first();

  waitForVisualizationContainers = (): Locator => this.page.locator("div[data-tb-test-id='VisualizationContainer']").first();
}
