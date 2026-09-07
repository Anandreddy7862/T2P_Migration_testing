import { test, type Page } from '@playwright/test';

import { EnvConfig } from '@common-utils/helpers/EnvConfig';
import { assertTrue, assertVisible } from '@common-utils/ui-utils/assertions';
import { clearDirectory, ensureDir, saveCapturedDownload, slugify } from '@common-utils/ui-utils/downloads';
import type {
  ReportExtraction,
  ReportPageExtraction,
  VisualExtraction,
} from '@bi-migration/ui/app-utils/data/visual-extraction.types';
import { POWERBI_ASSERTIONS, POWERBI_DOWNLOADS } from '@constants/powerbi.constants';
import { PageManager } from '@pages/PageManager';

/**
 * Downloads the underlying data of every visual on every page of a Power BI
 * report - the Power BI half of the migration comparison.
 *
 * The route is Power BI's own: select a visual -> its 3-dot menu -> Export data
 * -> csv -> Export. Three things about it differ from the Tableau side and shape
 * this module:
 *
 *  1. Export data raises an IN-PAGE dialog. Nothing opens a new tab, so there is
 *     no popup to await, and the download fires on the report page itself.
 *  2. The format dropdown defaults to xlsx-with-live-connection, which carries
 *     no data rows. Choosing csv is part of the flow, not a preference.
 *  3. A visual's 3-dot button is NOT unique on the page - the previously
 *     selected visual keeps its header, and DOM order puts it first. Every
 *     per-visual control is therefore scoped to the visual being processed; see
 *     PowerBiReportPage.locators.
 *
 * Errors are collected per visual rather than thrown, so one visual that cannot
 * be exported cannot abandon the rest of the report.
 */
export class PowerBiVisualDataModule {
  private readonly pm: PageManager;

  constructor(private readonly page: Page) {
    this.pm = new PageManager(page);
  }

  /**
   * Empties downloads/powerbi so a run never mixes fresh data with stale.
   *
   * Called ONCE at the start of a run, not per page - clearing per page would
   * delete the pages already extracted in the same run.
   */
  async clearDownloadsFolder(): Promise<void> {
    return test.step('Clear the Power BI downloads folder', () => {
      const removed = clearDirectory(POWERBI_DOWNLOADS.dir);
      console.log(`cleared ${POWERBI_DOWNLOADS.dir} (${removed} entr${removed === 1 ? 'y' : 'ies'} removed)`);
      return Promise.resolve();
    });
  }

  /** Step 1: open the report and wait for all of its visuals to load. */
  async openReport(startUrl: string = EnvConfig.powerBi.startUrl): Promise<void> {
    return test.step('Open the Power BI report', async () => {
      await this.page.goto(startUrl, { waitUntil: 'domcontentloaded' });
      await this.pm.powerBiReportPage.waitForPageLoad();
      await this.pm.powerBiReportPage.waitForVisualsLoaded();
    });
  }

  /** Step 2: how many pages the report holds. */
  async countPages(): Promise<number> {
    return test.step('Count the pages in the report', async () => {
      const pages = await this.pm.powerBiReportPage.listPages();
      console.log(`report pages (${pages.length}): ${pages.map((entry) => entry.name).join(' | ')}`);
      assertTrue(pages.length > 0, POWERBI_ASSERTIONS.pagesFound);
      return pages.length;
    });
  }

  /** Step 3: open one page. Its visuals are re-counted after the switch. */
  async openPage(index: number): Promise<void> {
    await test.step(`Open report page at index ${index}`, async () => {
      await this.pm.powerBiReportPage.openPageByIndex(index);
    });
  }

  /**
   * Steps 4-10 for every visual on one report page.
   *
   * The visuals are counted AFTER the page is opened: switching pages re-renders
   * the canvas, so a count taken on one page says nothing about the next.
   */
  async extractAllVisuals(pageIndex = 0): Promise<ReportPageExtraction> {
    await this.openPage(pageIndex);

    const pages = await this.pm.powerBiReportPage.listPages();
    const pageName = pages[pageIndex]?.name ?? `Page ${pageIndex + 1}`;

    const visualCount = await this.pm.powerBiReportPage.countCharts();
    const targetDir = ensureDir(`${POWERBI_DOWNLOADS.dir}/${slugify(pageName)}`);
    const visuals: VisualExtraction[] = [];

    for (let index = 0; index < visualCount; index += 1) {
      visuals.push(
        await test.step(`Extract data for visual ${index}`, () => this.extractVisual(index, pageName, targetDir)),
      );
    }

    const extracted = visuals.filter((visual) => visual.filePath !== null).length;
    return { page: pageName, visualCount, extracted, failed: visuals.length - extracted, visuals };
  }

  /**
   * Steps 3-10 for EVERY page of the report, not just the first.
   *
   * Each page gets its own folder under downloads/powerbi/, so a report with two
   * pages holding a same-named visual cannot overwrite itself.
   */
  async extractAllPages(): Promise<ReportExtraction> {
    const pages = await this.pm.powerBiReportPage.listPages();
    const results: ReportPageExtraction[] = [];

    for (const reportPage of pages) {
      results.push(await this.extractAllVisuals(reportPage.index));
    }

    return { pageCount: pages.length, pages: results };
  }

  /**
   * The export sequence for ONE visual:
   *
   *   left click -> wait for its toolbar and 3-dot -> click the 3-dot ->
   *   wait for the menu -> Export data -> wait for the format dropdown ->
   *   open it -> wait for the options -> pick csv -> Export
   *
   * On failure the dialog is dismissed. That is not cosmetic: a dialog left open
   * covers the canvas, so the next visual's left click lands on the overlay and
   * every remaining visual fails too.
   */
  private async extractVisual(index: number, pageName: string, targetDir: string): Promise<VisualExtraction> {
    const report = this.pm.powerBiReportPage;
    const dialog = this.pm.powerBiExportDataPage;

    try {
      await report.selectVisual(index);
      await report.waitForVisualToolbar(index);
      await assertVisible(report.visualMenuButton(index), POWERBI_ASSERTIONS.visualToolbarVisible);

      await report.clickVisualMenu(index);
      await report.waitForVisualMenu();
      await assertVisible(report.exportDataMenuItem(), POWERBI_ASSERTIONS.exportDataVisible);
      await report.clickExportData();

      await dialog.waitForPageLoad();
      await dialog.openFormatDropdown();
      await dialog.waitForFormatOptions();
      await assertVisible(dialog.csvOption(), POWERBI_ASSERTIONS.csvOptionVisible);
      await dialog.selectCsvFormat();

      // The dialog and the report share one page, so the wait is armed on the
      // report page while the click happens on the dialog.
      const download = await report.captureDownload(() => dialog.clickExport());

      // Power BI names the file after the visual it exported, so this is what the
      // saved file is called. It is a LABEL only - the index above is what
      // decided which visual was exported.
      const label = download.suggestedFilename().replace(/\.[^.]+$/, '');
      const saved = await saveCapturedDownload(download, { targetDir, baseName: `${index}_${label}` });

      await dialog.close();
      return { dashboard: pageName, index, title: label, filePath: saved.filePath };
    } catch (error) {
      await dialog.close().catch(() => undefined);
      return {
        dashboard: pageName,
        index,
        title: `visual ${index}`,
        filePath: null,
        error: (error as Error).message,
      };
    }
  }
}
