import type { Locator, Page } from '@playwright/test';

/**
 * Locators for Tableau web authoring - `/t/<site>/authoring/<workbook>/<sheet>`.
 *
 * Reached by clicking Edit, which navigates the whole page, so unlike the
 * published view NOTHING here is inside an iframe.
 *
 * Note `.tabDashboard` matches only DASHBOARD tabs in the bottom bar, not the
 * worksheet tabs beside them - which is exactly what a dashboard count wants.
 */
export class TableauAuthoringPageLocators {
  constructor(private page: Page) {}

  /** The bottom tab bar. Exists only in authoring mode. */
  bottomTabBar = (): Locator => this.page.locator('//div[contains(@class,"tabAuthTabNavTabs")]').first();

  /**
   * The "Tableau Agent can help!" coach mark that authoring pops up over the
   * top-right of the canvas. Harmless on its own, but it is an overlay sitting
   * above the workspace, so it is dismissed before interacting with visuals.
   *
   * The `.and(...)` is load-bearing. The data source "Sign in to reconnect"
   * dialog carries a `title="Close dialog"` button, which matches /close/i and
   * sits EARLIER in the DOM than any coach mark - so `.first()` picked it, and
   * dismissing the coach mark silently cancelled the credential prompt. Every
   * visual then rendered "No data to visualise with current filters" and the
   * run downloaded empty csvs while reporting success. Excluding the auth
   * dialog's test-id prefix keeps this locator to actual coach marks.
   */
  agentPopupCloseButton = (): Locator =>
    this.page
      .getByRole('button', { name: /close/i })
      .or(this.page.locator('[data-tb-test-id*="coachmark"] button, .tab-coachmark button'))
      .and(this.page.locator('button:not([data-tb-test-id*="tabbed-auth-dialog"])'))
      .first();

  dashboardTabs = (): Locator => this.page.locator('.tabDashboard');

  visualizationContainers = (): Locator => this.page.locator("div[data-tb-test-id='VisualizationContainer']");

  visualAxisLocator = (): Locator => this.page.locator("div[data-tb-test-id='VisualizationContainer']").first();

  visualTitleLocator =(): Locator => this.page.locator("[data-tb-test-id='VisualizationContainer'] .tab-textRegion-boundary");

  downloadButton = (): Locator=> this.page.getByRole("button",{name:"Download"});

  loadingIcon = (): Locator => this.page.getByRole('img', { name: 'Loading...' });

  downlaodMenu =(): Locator => this.page.locator(".tabMenuContent");

  clickDataOption =(): Locator => this.page.locator('//div//span[@class="tabMenuItemName"][contains(text(),"Data")]');

  /**
   * The modal glass Tableau raises while a menu is open. It covers the whole
   * page and intercepts every pointer event, so the NEXT right-click lands on
   * the glass instead of the next visual. Escape does not dismiss it - clicking
   * the glass does.
   */
  modalGlass = (): Locator => this.page.locator('div.tab-glass.clear-glass');
}
