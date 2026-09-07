import type { Page } from '@playwright/test';

/**
 * Base for every page object.
 *
 * Holds only the plumbing shared by all screens. Locators live in the sibling
 * `<Name>Page.locators.ts`; assertions live in the module layer.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  /**
   * Assert-free readiness signal for the screen. Called by `navigate()`, and by
   * modules that need to wait for a screen they did not navigate to.
   */
  abstract waitForPageLoad(): Promise<void>;

  /** Opens a url and waits for this screen to be ready. */
  async navigate(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await this.waitForPageLoad();
  }

  /** Named screenshot for failure diagnosis. */
  async captureScreenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `artifacts/test-artifacts/${name}.png` });
  }
}
