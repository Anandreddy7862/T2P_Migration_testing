import type { Locator, Page } from '@playwright/test';

/**
 * Locators for a loaded Power BI report.
 *
 * The per-visual controls are deliberately built RELATIVE to a chart element
 * rather than taken from the page. `.vcMenuBtn` is not unique while a report is
 * being worked through: selecting a visual leaves the previously selected one's
 * header mounted, so the page holds two buttons and DOM order puts the OLD
 * visual first. Measured on a three-chart page:
 *
 *   chart 0 -> 1 button on the page
 *   chart 1 -> 1 button
 *   chart 2 -> 2 buttons, and `.first()` belonged to chart 1
 *
 * which is exactly how chart 2 exported chart 1's data. Scoping to the chart's
 * own container returns 1 button in every case, with no dependence on visual
 * titles or on any particular report's layout.
 */
export class PowerBiReportPageLocators {
  constructor(private page: Page) {}

  reportCanvas = (): Locator =>
    this.page.locator('.exploration-container, .explorationContainer, #embedWrapperID, .reportContainer').first();

  appChrome = (): Locator =>
    this.page.locator('[data-testid="app-bar"], #appBar, .appBar, [aria-label="Navigation"]').first();

  // ------------------------------------------------------------- report pages

  /** The page tabs down the left of the report. One per report page. */
  pageTabs = (): Locator => this.page.locator('button[data-testid="pages-navigation-list-items"]');

  // ------------------------------------------------------------------ visuals

  /**
   * Chart visuals on the current report page.
   *
   * Power BI names the element after the visual type - `visual-lineChart`,
   * `visual-clusteredColumnChart` - so matching "Chart" selects charts and skips
   * cards, slicers and tables.
   */
  charts = (): Locator => this.page.locator("//div[@data-testid='visual-content-desc' and not(contains(@class,'visual-slicer'))]/ancestor::div[@data-testid='visual-style']//div[@data-testid='visual-title']//h3");

  /**
   * Dynamic: the container that OWNS one chart.
   *
   * `div.visualContainer` is the nearest ancestor holding both the chart and its
   * own header - verified by walking the chain from a chart element, where it is
   * the first level to report one `.vcMenuBtn` inside it.
   */
  visualContainer = (index: number): Locator =>
    this.charts().nth(index).locator('xpath=ancestor::div[contains(@class,"visualContainer")][1]');

  /** Dynamic: the header toolbar belonging to one chart. */
  visualToolbar = (index: number): Locator => this.visualContainer(index).locator('div[role="toolbar"]').first();

  /** Dynamic: the "More options" 3-dot button belonging to one chart. */
  visualMenuButton = (index: number): Locator => this.visualContainer(index).locator('.vcMenuBtn').first();

  // -------------------------------------------------------------- visual menu

  /** The 3-dot menu. Rendered in a page-level portal, so it cannot be scoped. */
  visualMenu = (): Locator => this.page.locator('pbi-menu[id="pbiMenuId"]').first();

  exportDataMenuItem = (): Locator => this.page.locator('button[title="Export data"]').first();
}
