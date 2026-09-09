import { test, type Page } from '@playwright/test';

import { EnvConfig } from '@common-utils/helpers/EnvConfig';
import { assertTrue, assertVisible } from '@common-utils/ui-utils/assertions';
import { clearDirectory, ensureDir, saveCapturedDownload, slugify } from '@common-utils/ui-utils/downloads';
import type {
  DashboardExtraction,
  VisualExtraction,
  WorkbookExtraction,
} from '@bi-migration/ui/app-utils/data/visual-extraction.types';
import { TABLEAU_ASSERTIONS, TABLEAU_DOWNLOADS } from '@constants/tableau.constants';
import { PageManager } from '@pages/PageManager';
import { TableauViewDataPage } from '@pages/tableau/TableauViewDataPage.page';
/**
 * Downloads the underlying data of every visual on a Tableau dashboard.
 *
 * The route is Tableau's own: published view -> Edit -> dashboard tab ->
 * right-click a visual -> View Data -> Download. Two things about that route
 * shape this module:
 *
 *  1. The published view lives in an IFRAME, but Edit navigates the whole page
 *     to /authoring/..., after which nothing is framed. Two page objects,
 *     switched at that boundary.
 *  2. View Data opens a NEW TAB, and the download fires on that tab - so the
 *     new page has to be awaited from the context and driven separately.
 *
 * Every container is attempted, including legend strips and worksheets collapsed
 * to zero height. Those are expected to fail, and their geometry is recorded
 * alongside the error so a reviewer can see WHY rather than wondering where a
 * visual went.
 */
export class TableauVisualDataModule {
  private readonly pm: PageManager;

  constructor(private readonly page: Page) {
    this.pm = new PageManager(page);
  }

  /**
   * Empties downloads/tableau so a run never mixes fresh data with stale.
   *
   * Called ONCE at the start of a run, not per dashboard - clearing per
   * dashboard would delete the dashboards already extracted in the same run.
   */
  async clearDownloadsFolder(): Promise<void> {
    return test.step('Clear the Tableau downloads folder', () => {
      const removed = clearDirectory(TABLEAU_DOWNLOADS.dir);
      console.log(`cleared ${TABLEAU_DOWNLOADS.dir} (${removed} entr${removed === 1 ? 'y' : 'ies'} removed)`);
      return Promise.resolve();
    });
  }

  /** Step 1: open the published view of the workbook. */
  async openWorkbook(startUrl: string = EnvConfig.tableau.startUrl): Promise<void> {
    return test.step('Open the published view of the workbook', async () => {
      await this.page.goto(startUrl, { waitUntil: 'domcontentloaded' });
      await this.pm.tableauVizViewerPage.waitForPageLoad();
    });
  }

  /**
   * Answers Tableau's "Sign in to reconnect" prompt for the workbook's live
   * data source (Snowflake), if it is showing.
   *
   * Call it at BOTH navigation boundaries. The prompt is raised twice in one
   * run - once on the published view and again once Edit has entered authoring,
   * the second time with the fields empty - because answering it on the
   * published view does not carry into the authoring session.
   *
   * On the published view it is not merely cosmetic to answer: the dialog
   * raises a modal glass over the viz, and the Edit button sits UNDER it, so
   * edit mode cannot be entered until the prompt is cleared.
   *
   * A no-op when nothing is prompting, which is the normal case once the
   * credential has been remembered against the Tableau account.
   */
  async signInToSnowflake(username: string, password: string): Promise<void> {
    await test.step('Sign in to the workbook data source', async () => {
      await this.pm.tableauDataSourceSignInPage.submitCredentials(username,password);
      await this.pm.tableauDataSourceSignInPage.waitForDialogToClose();
      });
  }

  /** Step 2: enter web authoring from the published view. */
  async enterEditMode(): Promise<void> {
    await test.step('Enter edit mode', async () => {
      await this.pm.tableauVizViewerPage.openEditMode();
      await this.pm.tableauAuthoringPage.waitForPageLoad();
    });
  }

  /**
   * Steps 1-2 end to end: published view -> data source sign-in -> authoring ->
   * data source sign-in AGAIN.
   *
   * The second sign-in is not a retry of the first. Tableau raises the prompt
   * once per document and the published-view answer does not carry into the
   * authoring session, so authoring asks again in its own document with the
   * fields empty. Measured: signing in on the published view, waiting for all
   * four visuals to draw, then clicking Edit still lands on an authoring canvas
   * showing the dialog and 8 "No data to visualise with current filters"
   * placeholders, and waiting there does not clear it.
   *
   * Skipping it is silent rather than loud: every container still exists, so
   * the extraction runs to completion and downloads a csv per visual - all of
   * them empty.
   */
  async openWorkbookInEditMode(startUrl: string = EnvConfig.tableau.startUrl): Promise<void> {
    const { username, password } = EnvConfig.tableau.datasource;

    await this.openWorkbook(startUrl);
    await this.signInToSnowflake(username, password);
    await this.enterEditMode();
    await this.signInToSnowflake(username, password);
    await this.waitForVisualsRendered();
  }

  /**
   * Blocks until the authoring canvas has actually plotted data, so extraction
   * cannot start against placeholder containers.
   */
  async waitForVisualsRendered(): Promise<void> {
    return test.step('Wait for the dashboard visuals to render', async () => {
      await this.pm.tableauAuthoringPage.waitForVisualsRendered();
    });
  }

  /** Step 3: the bottom bar only exists in authoring mode. */
  async assertBottomBarVisible(): Promise<void> {
    return test.step('Assert the bottom dashboard bar is visible', async () => {
      assertTrue(await this.pm.tableauAuthoringPage.isDisplayed(), TABLEAU_ASSERTIONS.bottomBarVisible);
    });
  }

  /** Step 4: how many dashboards the workbook holds. */
  async countDashboards(): Promise<number> {
    return test.step('Count the dashboards in the bottom bar', async () => {
      const dashboards = await this.pm.tableauAuthoringPage.listDashboards();
      console.log(`dashboards (${dashboards.length}): ${dashboards.map((d) => d.name).join(' | ')}`);
      assertTrue(dashboards.length > 0, TABLEAU_ASSERTIONS.dashboardsFound);
      return dashboards.length;
    });
  }

  /** Steps 5-6: open one dashboard and inventory its visuals. */
  async openDashboard(index: number): Promise<void> {
    await test.step(`Open dashboard at index ${index}`, async () => {
      await this.pm.tableauAuthoringPage.openDashboardByIndex(index);
    });
  }

  /**
   * Steps 7-12 for every visual on the dashboard.
   *
   * Errors are collected per visual rather than thrown, so one unclickable
   * container cannot abandon the rest of the dashboard.
   */
  async extractAllVisuals(dashboardIndex = 0): Promise<DashboardExtraction> {
    await this.openDashboard(dashboardIndex);

    // The dashboard name is needed regardless of what openDashboard returns:
    // downloads are written to downloads/tableau/<dashboard>/.
    const dashboards = await this.pm.tableauAuthoringPage.listDashboards();
    const dashboardName = dashboards[dashboardIndex]?.name ?? `Dashboard ${dashboardIndex + 1}`;

    const containers = await this.pm.tableauAuthoringPage.describeVisualContainers();
    const targetDir = ensureDir(`${TABLEAU_DOWNLOADS.dir}/${slugify(dashboardName)}`);
    const visuals: VisualExtraction[] = [];

    for (const info of containers) {
      visuals.push(
        await test.step(`Extract data for visual ${info.index}`, () =>
          this.extractVisual(info.index, dashboardName, targetDir, `${info.width}x${info.height}`),
        ),
      );
    }

    const extracted = visuals.filter((visual) => visual.filePath !== null).length;
    return {
      dashboard: dashboardName,
      visualCount: containers.length,
      extracted,
      failed: visuals.length - extracted,
      visuals,
    };
  }

  /**
   * Steps 5-12 for EVERY dashboard in the workbook, not just the first.
   *
   * Each dashboard gets its own folder under downloads/tableau/, and each is
   * inventoried after its tab is selected - the canvas re-renders on a tab
   * switch, so a container list captured on one dashboard says nothing about the
   * next.
   */
  async extractAllDashboards(): Promise<WorkbookExtraction> {
    const dashboards = await this.pm.tableauAuthoringPage.listDashboards();
    const results: DashboardExtraction[] = [];

    for (const dashboard of dashboards) {
      // Leftover menu glass from the previous dashboard would swallow the click
      // that selects the next tab.
      results.push(await this.extractAllVisuals(dashboard.index));
    }

    return { dashboardCount: dashboards.length, dashboards: results };
  }

  /**
   * The download sequence for ONE visual:
   *
   *   left click -> right click -> wait for the menu -> assert View Data ->
   *   click View Data -> popup opens -> assert Download -> click Download ->
   *   close the popup -> wait 5s
   *
   * On failure the open menu is dismissed. That is not cosmetic: a menu left
   * open raises a glass that blocks the NEXT visual's clicks, and the next
   * visual's menu check then passes against the STALE menu - which would
   * download the wrong visual's data.
   */
  private async extractVisual(
    index: number,
    dashboardName: string,
    targetDir: string,
    geometry: string,
  ): Promise<VisualExtraction> {
    const authoring = this.pm.tableauAuthoringPage;
    let popup: Page | null = null;

    try {
      await authoring.focusVisual(index);
      await this.page.waitForTimeout(2_000);
      await authoring.deselectVisual(index);
      await authoring.clickDownloadButton()

      if (await authoring.isDataDisabled()) {
        await authoring.clearOverlays();
        return {
          dashboard: dashboardName,
          index,
          title: `container ${index}`,
          filePath: null,
          error: `Data option disabled — no underlying data (container ${geometry})`,
        };
      }

      const [opened] = await Promise.all([
        this.page.context().waitForEvent('page', { timeout: 20_000 }),
        authoring.clickData(),
      ]);
      popup = opened;
      const viewDataPage = new TableauViewDataPage(opened);

      await assertVisible(viewDataPage.downloadButton(), TABLEAU_ASSERTIONS.downloadButtonVisible);
      const title = await viewDataPage.readVisualTitle();

      // The download fires on the OPENER, so the wait is armed there while the
      // click happens on the popup.
      const download = await authoring.captureDownload(() => viewDataPage.clickDownload());
      const saved = await saveCapturedDownload(download, { targetDir, baseName: `${index}_${title}` });

      await viewDataPage.close();
      await this.page.waitForTimeout(2_000);

      return { dashboard: dashboardName, index, title, filePath: saved.filePath };
    } catch (error) {
      await popup?.close();
      await authoring.clearOverlays();
      return {
        dashboard: dashboardName,
        index,
        title: `container ${index}`,
        filePath: null,
        error: `${(error as Error).message} (container ${geometry})`,
      };
    }
  }
}
