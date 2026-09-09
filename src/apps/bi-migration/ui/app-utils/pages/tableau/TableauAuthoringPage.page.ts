import type { Download, Locator, Page } from '@playwright/test';
import { setTimeout } from 'timers/promises';
import { BasePage } from '@common-utils/base/BasePage';
import { click, clickIfVisible } from '@common-utils/ui-utils/actions';
import { isVisibleWithin, waitForHidden, waitForVisible } from '@common-utils/ui-utils/waits';

import { TableauAuthoringPageLocators } from './TableauAuthoringPage.locators';

/** One entry of the bottom bar's dashboard list. */
export interface DashboardTab {
  index: number;
  name: string;
}

/** Rendered geometry of a visualization container, for reporting what was found. */
export interface VisualContainerInfo {
  index: number;
  width: number;
  height: number;
  /** Charts draw their marks and axes as svg; legends and strips do not. */
  svgCount: number;
  label: string;
}

/**
 * Tableau web authoring.
 *
 * Reached by clicking Edit in the published view, which navigates the whole page
 * - so unlike the published view, nothing here sits inside an iframe.
 */
export class TableauAuthoringPage extends BasePage {
  private locators: TableauAuthoringPageLocators;

  constructor(page: Page) {
    super(page);
    this.locators = new TableauAuthoringPageLocators(page);
  }

  async waitForPageLoad(): Promise<void> {
    await waitForVisible(this.locators.bottomTabBar());
  }

  /**
   * Closes the "Tableau Agent can help!" coach mark if authoring raised one.
   * Best effort: absent on most loads, and never a reason to fail.
   */
  async dismissAgentPopup(): Promise<void> {
    await clickIfVisible(this.locators.agentPopupCloseButton());
  }

  async isDisplayed(): Promise<boolean> {
    await waitForVisible(this.locators.bottomTabBar());
    return isVisibleWithin(this.locators.bottomTabBar(), 2_000);
  }

  /**
   * Waits until a visual has actually drawn its marks.
   *
   * The bottom bar and the visualization containers both exist while the data
   * source is still disconnected - measured: 8 containers present, every one of
   * them rendering "No data to visualise with current filters" and zero axis
   * wrappers. The axis wrapper only appears once real data is plotted, so it is
   * the signal that separates a live canvas from a placeholder one, and
   * extraction must not start before it.
   */
  async waitForVisualsRendered(timeout = 90_000): Promise<void> {
    await waitForHidden(this.locators.loadingIcon(), timeout);
    await waitForVisible(this.locators.visualAxisLocator().first(), timeout);
  }

  // ------------------------------------------------------------- dashboards

  async countDashboards(): Promise<number> {
    return this.locators.dashboardTabs().count();
  }

  async listDashboards(): Promise<DashboardTab[]> {
    await waitForVisible(this.locators.bottomTabBar());
    const tabs = this.locators.dashboardTabs();
    const total = await tabs.count();
    const found: DashboardTab[] = [];

    for (let index = 0; index < total; index += 1) {
      const name = ((await tabs.nth(index).textContent()) ?? '').replace(/\s+/g, ' ').trim();
      found.push({ index, name: name || `Dashboard ${index + 1}` });
    }
    return found;
  }

  async openDashboardByIndex(index: number): Promise<void> {
    await click(this.locators.dashboardTabs().nth(index));
    await waitForHidden(this.locators.loadingIcon());
  }

  // ---------------------------------------------------------------- visuals

  /**
   * Geometry and svg content of each container, so a caller can report WHY a
   * container yielded nothing. A dashboard mixes real charts with legend strips
   * and worksheets collapsed to zero height, and they are indistinguishable by
   * class name - only the rendered box and svg content tell them apart.
   */
  async describeVisualContainers(): Promise<VisualContainerInfo[]> {
    return this.locators.visualizationContainers().evaluateAll((nodes) =>
      nodes.map((node, index) => {
        const box = node.getBoundingClientRect();
        return {
          index,
          width: Math.round(box.width),
          height: Math.round(box.height),
          svgCount: node.querySelectorAll('svg').length,
          label: (node.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40),
        };
      }),
    );
  }

  /** Step: left click on the visual. */
  async focusVisual(index: number): Promise<void> {
    //const container = this.locators.visualAxisLocator().nth(index);
    const container = this.locators.visualTitleLocator().nth(index);
    await container.scrollIntoViewIfNeeded()
    await container.click();
  }

  async clickDownloadButton(): Promise<void>{
    await waitForVisible(this.locators.downloadButton());
    await click(this.locators.downloadButton());
  }

  async clickData(): Promise<boolean> {
    await waitForVisible(this.locators.downlaodMenu());
    await waitForVisible(this.locators.clickDataOption());
  
    if (await this.isDataDisabled()) {
      return false;               // skip the click
    }
  
    await click(this.locators.clickDataOption());
    await setTimeout(1000);
    return true;
  }


  async isDataDisabled(): Promise<boolean> {
    const el = this.locators.clickDataOption();
  
    if ((await el.getAttribute('aria-disabled')) === 'true') return true;
  
    const classes = (await el.getAttribute('class')) ?? '';
    return classes.split(/\s+/).includes('tabDisabled');
  }

  /**
   * Clears any open menu and its modal glass.
   *
   * Escape is useless here - it leaves both in place. The glass has to be
   * clicked, and it can be stacked (a submenu raises its own), so this loops
   * until the DOM is clear.
   */
  async clearOverlays(): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      // VISIBILITY, not existence. Deciding on count() and then clicking through
      // the shared helper - which waits 30s for visibility - cost 30s per call
      // whenever a glass sat in the DOM without being visible. Three of those
      // per call, on every context-menu attempt, was most of an 8 minute run.
      if (!(await isVisibleWithin(this.locators.modalGlass().first(), 500 ))) return;

      // Short and tolerant: the glass is REMOVED from the DOM when dismissed, so
      // it can vanish between the check and the click. That race is success.
      await this.locators
        .modalGlass()
        .first()
        .click();
    }
  }

  /**
   * Arms the download wait on THIS page and runs the caller's trigger.
   *
   * The trigger lives on the View Data popup, but Tableau fires the download on
   * the tab that OPENED it - this one. Waiting on the popup never resolves.
   */
  async captureDownload(trigger: () => Promise<void>, timeout = 30_000): Promise<Download> {
    const [download] = await Promise.all([this.page.waitForEvent('download', { timeout }), trigger()]);
    return download;
  }

  /**
   * The clickable container for one visual, in the same FILTERED order that
   * `describeVisualContainers()` reports - so an index means the same visual to
   * every caller.
   *
   * Synchronous on purpose: building a locator resolves nothing, and returning
   * a promise here blocks the `.locator(...)` chaining that `visualContainer()`
   * needs.
   */
  visualTitle(index: number): Locator {
    return this.locators.visualTitleLocator().nth(index);
  }

  /** The `.tab-tiledViewer` worksheet shell owning that visual. */
  visualContainer(index: number): Locator {
    return this.locators.visualContainer(index);
  }

  /**
   * Whether this visual currently holds a selection that would FILTER its
   * export.
   *
   * Measured wordings of the scoped aria-live region, all four confirmed live:
   *   ""                      - untouched, nothing selected
   *   "Mark selected. …"      - a data point is selected
   *   "Header selected. …"    - an axis label is selected
   *   "Mark deselected."      - a selection was just cleared
   *
   * DATA POINTS ONLY, by design. A header selection also filters the export -
   * measured: a click announcing "Header selected." produced
   * "View Data: by IPA (1 mark)" - but it is deliberately out of scope here, so
   * this stays a precise answer to the question its name asks. The `(N marks)`
   * suffix on the View Data window title is the signal that catches a header
   * selection; see TableauViewDataPage.readVisualTitle().
   *
   * There is deliberately no aria-label fallback. The focusbox label never
   * carries "Press Escape to remove selections" in this build - measured in
   * every state - so that branch could only ever return false, and reaching it
   * cost a full action timeout per call.
   */
  async isMarkSelected(index: number): Promise<boolean> {
    const status = this.locators.visualStatusRegion(index);
    if ((await status.count()) === 0) return false;

    const text = ((await status.first().textContent()) ?? '').trim();
    return /^Mark\s+selected/i.test(text);
  }


  async deselectVisual(index: number, attempts = 3): Promise<boolean> {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      if (!(await this.isMarkSelected(index))) return true;
  
      const container = this.visualTitle(index);
      await container.scrollIntoViewIfNeeded();
      await container.click();
  
      // Let the aria-live region update before re-reading.
      await this.page.waitForTimeout(2000);
    }
  
    return !(await this.isMarkSelected(index));
  }
}
