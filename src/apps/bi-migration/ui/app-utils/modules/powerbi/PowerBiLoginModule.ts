import { test, type Page } from '@playwright/test';

import { EnvConfig, required } from '@common-utils/helpers/EnvConfig';
import { assertTrue, assertUrlDoesNotMatch } from '@common-utils/ui-utils/assertions';
import { waitForDomReady } from '@common-utils/ui-utils/waits';
import { POWERBI_MESSAGES } from '@constants/powerbi.constants';
import { PageManager } from '@pages/PageManager';
import { ENTRA_URL_PATTERN } from '@pages/powerbi/PowerBiReportPage.page';

/** The screens the Power BI / Entra sign-in can present. */
type PowerBiScreen =
  | 'app'
  | 'emailGate'
  | 'accountPicker'
  | 'entraEmail'
  | 'entraPassword'
  | 'staySignedIn'
  | 'mfaCode'
  | 'mfaMethods'
  | 'mfaPush'
  | 'unknown';

const MAX_SCREENS = 8;

/**
 * Power BI / Entra ID sign-in business flow.
 *
 * Owns sequencing and assertions; every locator lives in the page layer.
 *
 * Observational rather than fixed, because a tenant's screens are not fixed: the
 * Power BI gate may or may not appear, the Entra email step is usually skipped
 * (the gate forwards a `login_hint`), and MFA may be push, a code, or absent.
 *
 * MFA cannot be completed by automation here - push and number matching need the
 * enrolled phone, and third-party authenticator apps are blocked by tenant
 * policy - so the flow surfaces what the phone must confirm and waits. A headless
 * run fails fast with instructions instead of hanging. For routine use, sign in
 * once via the manual setup and let the saved session carry later runs.
 */
export class PowerBiLoginModule {
  private readonly pm: PageManager;

  constructor(private readonly page: Page) {
    this.pm = new PageManager(page);
  }

  async signIn(startUrl: string = EnvConfig.powerBi.startUrl): Promise<void> {
    return test.step('Sign in to Power BI', async () => {
      const username = required('POWERBI_USERNAME');
      const password = required('POWERBI_PASSWORD');

      await this.page.goto(startUrl, { waitUntil: 'domcontentloaded' });

      let lastActionError: Error | null = null;

      for (let attempt = 1; attempt <= MAX_SCREENS; attempt += 1) {
        const screen = await this.currentScreen();

        if (screen === 'app') {
          console.log(`${POWERBI_MESSAGES.sessionEstablished} (${this.page.url()})`);
          return;
        }

        try {
          switch (screen) {
            case 'emailGate':
              await this.pm.powerBiEmailGatePage.submitEmail(username);
              break;
            case 'accountPicker':
              assertTrue(
                await this.pm.entraAccountPickerPage.chooseAccount(username),
                'the account picker should offer our account or "Use another account"',
              );
              break;
            case 'entraEmail':
              await this.pm.entraEmailPage.submitEmail(username);
              break;
            case 'entraPassword':
              await this.pm.entraPasswordPage.submitPassword(password);
              break;
            case 'staySignedIn':
              await this.pm.entraStaySignedInPage.staySignedIn();
              break;
            case 'mfaCode':
              await this.handleCodeScreen();
              break;
            case 'mfaMethods':
              await this.handleMethodPicker();
              break;
            case 'mfaPush':
              await this.handlePushScreen();
              break;
            default:
              await this.failUnrecognisedScreen();
          }
        } catch (error) {
          // The auth chain redirects on its own schedule and can tear a form out
          // from under an action. Re-observe rather than fail; the loop bound and
          // the final throw keep this terminating.
          lastActionError = error as Error;
        }

        await waitForDomReady(this.page);
        await this.assertNotRejected();
      }

      await this.failUnrecognisedScreen(
        lastActionError
          ? `gave up after ${MAX_SCREENS} auth screens; last action failed with: ${lastActionError.message}`
          : `gave up after ${MAX_SCREENS} auth screens`,
      );
    });
  }

  /**
   * Detection order is deliberate:
   *  1. emailGate    - Power BI's own form; its plain text input would also
   *     satisfy looser Entra locators
   *  2. staySignedIn - carries no input of its own, and unhandled it strands the
   *     flow one click from done
   *  3. MFA screens before the password screen - the code box is a text input a
   *     looser password locator must never claim
   */
  private async currentScreen(timeoutMs = 60_000): Promise<PowerBiScreen> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      if (await this.pm.powerBiEmailGatePage.isDisplayed()) return 'emailGate';
      if (await this.pm.entraStaySignedInPage.isDisplayed()) return 'staySignedIn';
      if (await this.pm.entraMfaCodePage.isDisplayed()) return 'mfaCode';
      if (await this.pm.entraMfaMethodPickerPage.isDisplayed()) return 'mfaMethods';
      if (await this.pm.entraMfaPushPage.isDisplayed()) return 'mfaPush';
      if (await this.pm.entraPasswordPage.isDisplayed()) return 'entraPassword';
      if (await this.pm.entraEmailPage.isDisplayed()) return 'entraEmail';
      if (await this.pm.entraAccountPickerPage.isDisplayed()) return 'accountPicker';
      if (await this.pm.powerBiReportPage.isDisplayed()) return 'app';
    }
    return 'unknown';
  }

  // ------------------------------------------------------------------- MFA

  private async handleCodeScreen(): Promise<void> {
    // Ticking "don't ask again" first makes the resulting session last longer.
    await this.pm.entraMfaCodePage.rememberThisDevice();
    await this.waitForHuman('type the verification code from your Authenticator app');
  }

  private async handleMethodPicker(): Promise<void> {
    // Push is the only method worth choosing: a code would have to be typed by a
    // human anyway, so it buys nothing over the push prompt.
    assertTrue(
      await this.pm.entraMfaMethodPickerPage.choosePushNotification(),
      'the MFA method picker should offer the Authenticator push',
    );
  }

  private async handlePushScreen(): Promise<void> {
    const digits = await this.pm.entraMfaPushPage.readMatchingNumber();
    console.log(digits ? POWERBI_MESSAGES.numberMatching(digits) : POWERBI_MESSAGES.pushSent);
    await this.waitForHuman(digits ? `enter ${digits} in Microsoft Authenticator` : 'approve the notification');
  }

  /**
   * Blocks until something moves. Deliberately NOT a url-only wait: approval
   * lands on "Stay signed in?", which is still on the Microsoft host, so a url
   * watch would time out with the sign-in one click from finished.
   */
  private async waitForHuman(action: string): Promise<void> {
    if (EnvConfig.isHeadless) {
      await this.pm.powerBiReportPage.captureScreenshot('powerbi-mfa-blocked');
      throw new Error(
        `Power BI sign-in needs you to ${action}, but this run is headless.\n` +
          `Sign in once by hand and later runs reuse that session:\n    ${POWERBI_MESSAGES.manualSignInCommand}`,
      );
    }

    const waitMs = EnvConfig.powerBi.mfaWaitMs;
    console.log(`waiting up to ${Math.round(waitMs / 1000)}s for you to ${action} in the open browser...`);

    await Promise.race([
      this.page.waitForURL((url) => !/login\.microsoftonline\.com/i.test(url.href), { timeout: waitMs }),
      this.pm.entraStaySignedInPage.prompt().waitFor({ state: 'visible', timeout: waitMs }),
    ]).catch(() => console.warn('MFA wait timed out - continuing so the real state gets reported'));
  }

  // ------------------------------------------------------------ assertions

  private async assertNotRejected(): Promise<void> {
    const error = await this.pm.entraPasswordPage.readErrorMessage();
    if (!error) return;

    await this.pm.entraPasswordPage.captureScreenshot('powerbi-login-error');
    throw new Error(`Power BI sign-in rejected: ${error}`);
  }

  private async failUnrecognisedScreen(reason = 'unrecognised screen'): Promise<never> {
    await this.pm.powerBiReportPage.captureScreenshot('powerbi-login-failed');
    throw new Error(
      `Power BI sign-in did not complete (${reason}).\n` +
        `  url: ${this.page.url()}\n` +
        'Screenshot: artifacts/test-artifacts/powerbi-login-failed.png\n' +
        'If this is a new screen, add a page object under app-utils/pages/powerbi/ and register it in the barrel.',
    );
  }

  async saveSession(): Promise<string> {
    return test.step('Save the Power BI session', async () => {
      assertUrlDoesNotMatch(this.page.url(), ENTRA_URL_PATTERN, 'refusing to save an unauthenticated Power BI session');
      await this.page.context().storageState({ path: EnvConfig.powerBi.storageState });
      return EnvConfig.powerBi.storageState;
    });
  }
}
