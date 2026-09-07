import { test, type Page } from '@playwright/test';

import { EnvConfig, required } from '@common-utils/helpers/EnvConfig';
import { assertTrue, assertUrlDoesNotMatch } from '@common-utils/ui-utils/assertions';
import { waitForDomReady } from '@common-utils/ui-utils/waits';
import { TABLEAU_ASSERTIONS, TABLEAU_AUTH_TYPE, TABLEAU_MESSAGES } from '@constants/tableau.constants';
import { PageManager } from '@pages/PageManager';
import { TABLEAU_LOGIN_URL_PATTERN } from '@pages/tableau/TableauHomePage.page';

/** The screens the Tableau sign-in can present. */
type TableauScreen = 'home' | 'signIn' | 'siteUri' | 'credentials' | 'unknown';

const MAX_SCREENS = 6;

/**
 * Tableau sign-in business flow.
 *
 * Owns sequencing and assertions; every locator lives in the page layer.
 *
 * The sequencing is observational rather than fixed: each pass asks which screen
 * is actually displayed and hands off to it. Tableau's flow is not fixed - the
 * site-URI screen appears only when the site cannot be resolved from the url, and
 * Tableau Server merges the two credential steps into one - so a hardcoded order
 * breaks on the variant you did not test against.
 */
export class TableauLoginModule {
  private readonly pm: PageManager;

  constructor(private readonly page: Page) {
    this.pm = new PageManager(page);
  }

  /** Signs in and leaves the browser on the target url. */
  async signIn(startUrl: string = EnvConfig.tableau.startUrl): Promise<void> {
    return test.step('Sign in to Tableau', async () => {
      if (!startUrl) throw new Error('Set TABLEAU_START_URL (or TABLEAU_BASE_URL) in .env');

      // Tableau Public vizzes are readable anonymously - there is no form.
      if (this.isTableauPublic(startUrl)) {
        console.log(TABLEAU_MESSAGES.publicNoSignIn);
        await this.pm.tableauHomePage.navigate(startUrl);
        return;
      }

      const username = required('TABLEAU_USERNAME');
      const password = required('TABLEAU_PASSWORD');

      await this.page.goto(startUrl, { waitUntil: 'domcontentloaded' });

      let lastActionError: Error | null = null;

      for (let attempt = 1; attempt <= MAX_SCREENS; attempt += 1) {
        const screen = await this.currentScreen();

        if (screen === 'home') {
          console.log(TABLEAU_MESSAGES.sessionEstablished);
          return;
        }

        try {
          switch (screen) {
            case 'signIn':
              await this.pm.tableauSignInPage.submitUsername(username);
              break;
            case 'siteUri':
              assertTrue(Boolean(EnvConfig.tableau.site), TABLEAU_ASSERTIONS.siteRequired);
              await this.pm.tableauSiteUriPage.submitSiteUri(EnvConfig.tableau.site);
              break;
            case 'credentials':
              await this.pm.tableauCredentialsPage.signIn(username, password);
              break;
            default:
              await this.failUnrecognisedScreen();
          }
        } catch (error) {
          // The page can navigate mid-action - Tableau's SAML hop completes on
          // its own once the IdP recognises the session, tearing the form out
          // from under a fill. Re-observe instead of failing: the next pass sees
          // whatever screen is actually there now, and the loop bound plus the
          // final throw keep this terminating.
          lastActionError = error as Error;
        }

        await waitForDomReady(this.page);
        await this.assertNotRejected();
      }

      await this.failUnrecognisedScreen(
        lastActionError
          ? `gave up after ${MAX_SCREENS} sign-in screens; last action failed with: ${lastActionError.message}`
          : `gave up after ${MAX_SCREENS} sign-in screens`,
      );
    });
  }

  /**
   * Asserts the browser is genuinely signed in.
   *
   * On a published-view url the assertion is the viz-viewer toolbar: it only
   * renders once the credentials were accepted AND the viz loaded. Other urls
   * (site home, web authoring) never render it, so those fall back to their own
   * chrome via isDisplayed().
   */
  async assertSignedIn(): Promise<void> {
    return test.step('Assert Tableau is signed in', async () => {
      assertUrlDoesNotMatch(this.page.url(), TABLEAU_LOGIN_URL_PATTERN, TABLEAU_ASSERTIONS.signedIn);

      // One-shot confirmation, so it can afford to wait for the viz to render.
      if (await this.pm.tableauHomePage.hasVizViewerToolbar(20_000)) {
        console.log(TABLEAU_MESSAGES.toolbarConfirmed);
        return;
      }
      assertTrue(await this.pm.tableauHomePage.isDisplayed(), TABLEAU_ASSERTIONS.signedIn);
    });
  }

  /**
   * Detection order is deliberate:
   *  1. siteUri     - its lone text box would fool a field-based check
   *  2. credentials - a visible password box settles it
   *  3. signIn      - email box with no password box
   *  4. home        - off the login hosts with no field showing
   */
  private async currentScreen(timeoutMs = 45_000): Promise<TableauScreen> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      if (await this.pm.tableauSiteUriPage.isDisplayed()) return 'siteUri';
      if (await this.pm.tableauCredentialsPage.isDisplayed()) return 'credentials';
      if (await this.pm.tableauSignInPage.isDisplayed()) return 'signIn';
      if (await this.pm.tableauHomePage.isDisplayed()) return 'home';
    }
    return 'unknown';
  }

  private async assertNotRejected(): Promise<void> {
    const error = await this.pm.tableauCredentialsPage.readErrorMessage();
    if (!error) return;

    await this.pm.tableauCredentialsPage.captureScreenshot('tableau-login-error');
    throw new Error(
      `Tableau sign-in rejected: ${error}\n` +
        'Check TABLEAU_USERNAME / TABLEAU_PASSWORD in .env. If the account uses SSO or MFA, ' +
        'this scripted sign-in cannot complete it.',
    );
  }

  private isTableauPublic(url: string): boolean {
    return EnvConfig.tableau.authType === TABLEAU_AUTH_TYPE.public || /public\.tableau\.com/i.test(url);
  }

  private async failUnrecognisedScreen(reason = 'unrecognised sign-in screen'): Promise<never> {
    await this.pm.tableauHomePage.captureScreenshot('tableau-login-failed');
    throw new Error(
      `Tableau sign-in did not complete (${reason}).\n` +
        `  url: ${this.page.url()}\n` +
        'Screenshot: artifacts/test-artifacts/tableau-login-failed.png\n' +
        'If this is a new screen, add a page object under app-utils/pages/tableau/ and register it in the barrel.',
    );
  }

  /** Persists cookies + localStorage for later runs. */
  async saveSession(): Promise<string> {
    return test.step('Save the Tableau session', async () => {
      assertUrlDoesNotMatch(
        this.page.url(),
        TABLEAU_LOGIN_URL_PATTERN,
        'refusing to save an unauthenticated Tableau session',
      );
      await this.page.context().storageState({ path: EnvConfig.tableau.storageState });
      return EnvConfig.tableau.storageState;
    });
  }
}
