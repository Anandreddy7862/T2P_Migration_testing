import { EnvConfig } from '@common-utils/helpers/EnvConfig';
import { describeSession } from '@common-utils/session/storage-state';
import { assertTrue } from '@common-utils/ui-utils/assertions';
import { POWERBI_ASSERTIONS } from '@constants/powerbi.constants';
import { test as setup } from '@fixtures';

/**
 * ONE-TIME INTERACTIVE SIGN-IN.
 *
 * For tenants where MFA cannot be automated: Authenticator push and number
 * matching require the enrolled phone, and third-party authenticator apps - the
 * one automatable second factor - are blocked by policy.
 *
 * This automates NOTHING about the sign-in on purpose. You type the credentials
 * and approve the push; the setup only waits until the report is genuinely on
 * screen and then captures the session, so every later run is unattended until it
 * expires. Half-automating a sign-in while a human races it is how earlier
 * attempts ended up saving anonymous sessions.
 */
setup('should capture a Power BI session from a hand-driven sign-in', async ({ page, pageManager }) => {
  const budgetMs = EnvConfig.powerBi.manualLoginMs;
  setup.setTimeout(budgetMs + 60_000);

  await page.goto(EnvConfig.powerBi.startUrl, { waitUntil: 'domcontentloaded' });

  console.log(
    [
      '',
      '='.repeat(70),
      ' SIGN IN BY HAND in the browser window that just opened.',
      '',
      `   account : ${EnvConfig.powerBi.username || '(POWERBI_USERNAME not set)'}`,
      '   1. submit the email on the Power BI gate',
      '   2. enter the password',
      '   3. approve the Authenticator prompt on your phone',
      '   4. answer "Stay signed in?" with YES  <-- this is what makes the',
      '      saved session last; answering No means re-doing this every run',
      '',
      ` Waiting up to ${Math.round(budgetMs / 60000)} minutes for the report to load...`,
      '='.repeat(70),
      '',
    ].join('\n'),
  );

  // Wait for the CANVAS, not merely for the login host to be left behind:
  // "Stay signed in?" lives on the Microsoft domain, so a url check alone would
  // declare victory one click too early.
  await pageManager.powerBiReportPage.waitForCanvas(budgetMs);
  await page.context().storageState({ path: EnvConfig.powerBi.storageState });

  const info = describeSession('powerbi');
  console.log(
    [
      '',
      `Session saved to ${EnvConfig.powerBi.storageState}`,
      `  auth cookies: ${info.authCookieCount}`,
      `  expires     : ${info.expiresAt ? info.expiresAt.toISOString() : 'unknown (session cookies only)'}`,
      `  usable for  : ${info.hoursLeft !== null ? `${Math.round(info.hoursLeft)}h` : 'unknown'}`,
      '',
    ].join('\n'),
  );

  assertTrue(info.usable, POWERBI_ASSERTIONS.sessionUsable);
  if (info.expiresAt === null) {
    console.warn('WARNING: no persistent cookie was saved - was "Stay signed in?" answered Yes?');
  }
});
