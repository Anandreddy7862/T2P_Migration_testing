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

  visualizationContainers = (): Locator => this.page.locator("//div[@data-tb-test-id='VisualizationContainer'][.//div[contains(@class,'tab-clip-focusbox')][not(contains(@aria-label,'No data to visuali'))]]");

  visualAxisLocator = (): Locator => this.page.locator("div[data-tb-test-id='VisualizationContainer']").first();

  visualTitleLocator =(): Locator => this.page.locator("//div[@data-tb-test-id='VisualizationContainer'][.//div[contains(@class,'tab-clip-focusbox')][not(contains(@aria-label,'No data to visuali'))]]");

  downloadButton = (): Locator=> this.page.getByRole("button",{name:"Download"});

  loadingIcon = (): Locator => this.page.getByRole('img', { name: 'Loading...' });

  downlaodMenu =(): Locator => this.page.locator(".tabMenuContent");

  clickDataOption =(): Locator =>
  this.page
    .locator('[data-test-id="tabMenuItem"]')
    .filter({ hasText: 'Data' });

  /**
   * The modal glass Tableau raises while a menu is open. It covers the whole
   * page and intercepts every pointer event, so the NEXT right-click lands on
   * the glass instead of the next visual. Escape does not dismiss it - clicking
   * the glass does.
   */
  modalGlass = (): Locator => this.page.locator('div.tab-glass.clear-glass');

  /**
   * The worksheet shell that owns one visual.
   *
   * There is no ancestor to walk to: measured on the Enrollment by Demographics
   * dashboard, the `VisualizationContainer` div CARRIES the tiled-viewer
   * classes itself - `class="tab-tiledViewer placeholder tab-widget"` - and its
   * parent is `div.tab-zone-padding`. So
   * `ancestor::div[contains(@class,"tab-tiledViewer")][1]` resolves to ZERO
   * elements (the ancestor axis excludes self), while `closest()` appears to
   * work only because closest() DOES include self.
   *
   * The scoping this exists for still holds - `#tab-vizStatus` appears 10 times
   * on the page, once per unfiltered container, so it must never be queried
   * unscoped - it is just already satisfied by the container itself.
   */
  visualContainer = (index: number): Locator => this.visualTitleLocator().nth(index);

  /**
   * Tableau's aria-live region for one visual, announcing selection changes.
   *
   * Measured wording: `""` before any interaction, `"Mark selected. Press Enter
   * to navigate tooltip interactions."`, `"Header selected. …"` when the click
   * lands on an axis label, and `"Mark deselected."` once cleared.
   *
   * Both SELECTED forms filter what View Data exports, but only the data-point
   * one is acted on here - see `isMarkSelected()` for why, and for what covers
   * the header case instead.
   */
  visualStatusRegion = (index: number): Locator => this.visualContainer(index).locator('#tab-vizStatus');
}
