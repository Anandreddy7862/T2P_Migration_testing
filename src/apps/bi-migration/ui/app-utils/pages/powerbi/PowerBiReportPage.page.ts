import type { Download, Locator, Page } from '@playwright/test';

import { BasePage } from '@common-utils/base/BasePage';
import { isVisibleWithin, waitForNetworkIdle, waitForVisible } from '@common-utils/ui-utils/waits';

import { PowerBiReportPageLocators } from './PowerBiReportPage.locators';

/** Hosts that mean we are still in the auth flow rather than in the app. */
export const ENTRA_URL_PATTERN = /login\.microsoftonline\.com|login\.live\.com|\/singleSignOn|\/signin|\/oauth2/i;

/** One entry of the report's page-tab strip. */
export interface ReportPageTab {
  index: number;
  name: string;
}

/**
 * A loaded Power BI report - the only trustworthy proof that a sign-in finished,
 * and the surface the visual-data export is driven from.
 *
 * Why the canvas and not the url: "Stay signed in?" sits on the Microsoft login
 * host, so a url check alone declares victory one click early; and the app bar
 * appears before the report resolves. The rendered canvas is the point at which
 * a session is genuinely usable.
 */
export class PowerBiReportPage extends BasePage {
  private locators: PowerBiReportPageLocators;

  constructor(page: Page) {
    super(page);
    this.locators = new PowerBiReportPageLocators(page);
  }

  async waitForPageLoad(): Promise<void> {
    await waitForVisible(this.locators.reportCanvas());
    await waitForNetworkIdle(this.page);
  }

  /** Signed in and in the app: off the auth hosts with app chrome present. */
  async isDisplayed(): Promise<boolean> {
    if (ENTRA_URL_PATTERN.test(this.page.url())) return false;
    return isVisibleWithin(this.locators.appChrome());
  }

  /** Blocks until the canvas renders; used by the hand-driven sign-in. */
  async waitForCanvas(timeout: number): Promise<void> {
    await waitForVisible(this.locators.reportCanvas(), timeout);
  }

  /**
   * Step 1: every visual on the current page has finished loading.
   *
   * A report page mounts its visuals progressively, so the chart count climbs
   * while the canvas is already visible - counting too early sees 1 of 3 and the
   * run then silently skips two visuals. The count is therefore read until it
   * stops changing, which needs no knowledge of how many visuals a report holds.
   */
  async waitForVisualsLoaded(settleMs = 800, timeout = 30_000): Promise<number> {
    await waitForVisible(this.locators.reportCanvas(), timeout);

    // Short budget, not the full timeout: a Power BI report polls for the whole
    // time it is open, so networkidle usually never fires and simply burns its
    // budget on every page switch. The settle loop below is the real signal.
    await waitForNetworkIdle(this.page, 10_000);

    const deadline = Date.now() + timeout;
    let previous = -1;
    let current = await this.locators.charts().count();

    while (current !== previous && Date.now() < deadline) {
      previous = current;
      await this.page.waitForTimeout(settleMs);
      current = await this.locators.charts().count();
    }
    return current;
  }

  // ------------------------------------------------------------- report pages

  /** Step 2: how many pages the report holds. */
  async countPages(): Promise<number> {
    await waitForVisible(this.locators.pageTabs().first());
    return this.locators.pageTabs().count();
  }

  async listPages(): Promise<ReportPageTab[]> {
    await waitForVisible(this.locators.pageTabs().first());
    const tabs = this.locators.pageTabs();
    const total = await tabs.count();
    const found: ReportPageTab[] = [];

    for (let index = 0; index < total; index += 1) {
      const name = ((await tabs.nth(index).textContent()) ?? '').replace(/\s+/g, ' ').trim();
      found.push({ index, name: name || `Page ${index + 1}` });
    }
    return found;
  }

  /** Step 3: open one report page and wait for its visuals. */
  async openPageByIndex(index: number): Promise<number> {
    await this.locators.pageTabs().nth(index).click({ timeout: 20_000 });
    return this.waitForVisualsLoaded();
  }

  // ------------------------------------------------------------------ visuals

  async countCharts(): Promise<number> {
    return this.locators.charts().count();
  }

  /** Step 4: left click the visual, which raises its header toolbar. */
  async selectVisual(index: number): Promise<void> {
    const chart = this.locators.charts().nth(index);
    await chart.scrollIntoViewIfNeeded({ timeout: 5_000 }).catch(() => undefined);
    await chart.click({ timeout: 15_000 });
  }

  /**
   * Step 5: the toolbar and 3-dot button of THIS visual are on screen.
   *
   * Both are scoped to the chart's own container, so this cannot pass against
   * the previously selected visual's header - which is still mounted at this
   * point and is what a page-level `.first()` would find.
   */
  async waitForVisualToolbar(index: number, timeout = 15_000): Promise<void> {
    await waitForVisible(this.locators.visualToolbar(index), timeout);
    await waitForVisible(this.locators.visualMenuButton(index), timeout);
  }

  /** Step 6: open the 3-dot menu of THIS visual. */
  async clickVisualMenu(index: number): Promise<void> {
    await this.locators.visualMenuButton(index).click({ timeout: 15_000 });
  }

  /** Step 7: the menu list, then Export data inside it. */
  async waitForVisualMenu(timeout = 15_000): Promise<void> {
    await waitForVisible(this.locators.visualMenu(), timeout);
  }

  async clickExportData(): Promise<void> {
    await waitForVisible(this.locators.exportDataMenuItem(), 15_000);
    await this.locators.exportDataMenuItem().click({ timeout: 15_000 });
  }

  /**
   * Arms the download wait on this page and runs the caller's trigger.
   *
   * Unlike Tableau's View Data, Export data is an IN-PAGE dialog - no new tab
   * opens (measured: the context held one page before and after), and the
   * download fires on this same page.
   */
  async captureDownload(trigger: () => Promise<void>, timeout = 120_000): Promise<Download> {
    const [download] = await Promise.all([this.page.waitForEvent('download', { timeout }), trigger()]);
    return download;
  }

  reportCanvas(): Locator {
    return this.locators.reportCanvas();
  }

  appChrome(): Locator {
    return this.locators.appChrome();
  }

  pageTabs(): Locator {
    return this.locators.pageTabs();
  }

  charts(): Locator {
    return this.locators.charts();
  }

  visualMenuButton(index: number): Locator {
    return this.locators.visualMenuButton(index);
  }

  exportDataMenuItem(): Locator {
    return this.locators.exportDataMenuItem();
  }
}
