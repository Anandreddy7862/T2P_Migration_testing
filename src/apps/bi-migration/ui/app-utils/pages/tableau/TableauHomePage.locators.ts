import type { Locator, Page } from '@playwright/test';

/**
 * Locators proving a Tableau session is live.
 *
 * A signed-in browser can legitimately land on THREE different screens, and each
 * renders entirely different chrome:
 *
 *   site home      -> global nav in the main document
 *   published view -> the viz in an iframe (its toolbar is INSIDE that iframe,
 *                     so a page-level lookup finds nothing even when signed in)
 *   web authoring  -> the authoring menu bar and bottom tab bar, and no iframe
 *                     at all
 *
 * Missing any one of them reports a live session as an unrecognised screen -
 * which is exactly what happened when authoring mode was left out.
 */
export class TableauHomePageLocators {
  constructor(private page: Page) {}

  /**
   * The published-view toolbar - the definitive proof of a signed-in session.
   *
   * It renders INSIDE the viz iframe, so it needs two locators: one scoped to
   * the frame (the normal case) and one on the main document, for embeds that
   * are not framed. A page-level lookup alone finds nothing on a viz url.
   */
  vizViewerToolbarInFrame = (): Locator =>
    this.page.frameLocator('iframe[src*="/views/"]').locator('div[id="viz-viewer-toolbar"]').first();

  vizViewerToolbar = (): Locator => this.page.locator('div[id="viz-viewer-toolbar"]').first();

  appChrome = (): Locator =>
    this.page.locator('[data-tb-test-id="global-nav"], .tb-global-nav, #primaryContent, .tabToolbar').first();

  /** Web authoring chrome - present only on /authoring/ urls. */
  authoringChrome = (): Locator =>
    this.page.locator('.tabAuthMenuBar, [class*="tabAuthTabNavTabs"], .tabAuthMenubarArea').first();

  /** Any sign-in field still on screen means we are not through yet. */
  anySignInField = (): Locator =>
    this.page.locator('#email, #password, input[type="password"], input[type="email"]').first();

  vizFrame = (): Locator => this.page.locator('iframe[src*="/views/"], iframe.tableauViz').first();
}
