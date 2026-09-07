import type { Locator, Page } from '@playwright/test';

import { BasePage } from '@common-utils/base/BasePage';
import { isVisibleWithin, waitForDomReady } from '@common-utils/ui-utils/waits';

import { TableauHomePageLocators } from './TableauHomePage.locators';

/** Hosts that mean we are still signing in rather than signed in. */
export const TABLEAU_LOGIN_URL_PATTERN =
  /sso\.online\.tableau\.com|identity\.idp\.tableau\.com|idp\/SSO|prelogin|\/signin|\/login/i;

/** A signed-in Tableau page: the site home or a viz. */
export class TableauHomePage extends BasePage {
  private locators: TableauHomePageLocators;

  constructor(page: Page) {
    super(page);
    this.locators = new TableauHomePageLocators(page);
  }

  async waitForPageLoad(): Promise<void> {
    await waitForDomReady(this.page);
  }

  /**
   * POSITIVE proof of a session, never the absence of a sign-in form.
   *
   * "Off the login hosts and no field on screen" looks equivalent but is not:
   * immediately after `goto` the browser still sits on the target url with
   * nothing rendered, before the redirect to SSO fires. Treating that as signed
   * in makes the whole sign-in a no-op that reports success and saves an
   * anonymous session.
   *
   * So we require something only an authenticated page renders, and ALL THREE
   * landing screens have to be covered:
   *  - a published view embeds the viz in an iframe
   *  - a site home renders the global nav in the main document
   *  - web authoring renders its own menu bar and no iframe at all
   *
   * Leaving authoring out is not hypothetical: a live session on
   * /authoring/<workbook>/<sheet> - signed in, workbook loaded, Publish button
   * on screen - was reported as an unrecognised sign-in screen and failed the
   * setup after six passes, because neither of the other two markers exists
   * there.
   */
  async isDisplayed(): Promise<boolean> {
    if (TABLEAU_LOGIN_URL_PATTERN.test(this.page.url())) return false;

    await waitForDomReady(this.page);
    if (await isVisibleWithin(this.locators.anySignInField(), 250)) return false;

    // The viz-viewer toolbar is the definitive signal and is checked first.
    if (await this.hasVizViewerToolbar()) return true;

    // Fallbacks for the two screens that have no viz toolbar at all.
    return (
      (await isVisibleWithin(this.locators.appChrome(), 1_000)) ||
      (await isVisibleWithin(this.locators.authoringChrome(), 1_000))
    );
  }

  /**
   * The published-view toolbar, checked inside the viz iframe first and then on
   * the main document. Finding it means the credentials were accepted and the
   * viz rendered - the strongest proof of a live session available.
   *
   * The default timeout is deliberately SHORT because this runs inside a polling
   * loop. A generous wait here is paid on every pass that does not match: with a
   * 15s default, each poll of a url that has no viz iframe cost ~19s instead of
   * ~1s, turning a sign-in into a 90-second one. Callers that check once - the
   * final assertion - pass a longer timeout explicitly.
   */
  async hasVizViewerToolbar(timeout = 1_000): Promise<boolean> {
    if (await isVisibleWithin(this.locators.vizViewerToolbarInFrame(), timeout)) return true;
    return isVisibleWithin(this.locators.vizViewerToolbar(), 1_000);
  }

  /** Only meaningful for callers holding the viz iframe scope. */
  appChrome(): Locator {
    return this.locators.appChrome();
  }

  authoringChrome(): Locator {
    return this.locators.authoringChrome();
  }

  vizViewerToolbar(): Locator {
    return this.locators.vizViewerToolbarInFrame();
  }

  vizFrame(): Locator {
    return this.locators.vizFrame();
  }
}
