import { describeSession } from '@common-utils/session/storage-state';
import { EnvConfig } from '@common-utils/helpers/EnvConfig';
import { POWERBI_MESSAGES } from '@constants/powerbi.constants';
import { test as setup } from '@fixtures';

/**
 * Establishes a Power BI session and persists it to auth/powerbi.json, reusing a
 * still-valid session when there is one.
 *
 * If the tenant requires an Authenticator approval this scripted sign-in cannot
 * complete it - run the manual setup once instead, and this project reuses that
 * session until it expires. FORCE_REAUTH=true overrides the reuse.
 */
setup('should establish a Power BI session', async ({ uiModuleManager }) => {
  setup.setTimeout(EnvConfig.powerBi.mfaWaitMs + 4 * 60 * 1000);

  const existing = describeSession('powerbi');
  if (existing.usable && process.env.FORCE_REAUTH !== 'true') {
    console.log(`[auth] ${POWERBI_MESSAGES.reusingSession} - ${existing.reason}`);
    setup.info().annotations.push({ type: 'skipped-login', description: existing.reason });
    return;
  }

  try {
    await setup.step('When the credentials are submitted', () =>
      uiModuleManager.powerBiLogin.signIn(EnvConfig.powerBi.startUrl),
    );
    await setup.step('Then the session is saved', () => uiModuleManager.powerBiLogin.saveSession());
  } catch (error) {
    throw new Error(
      [
        (error as Error).message,
        '',
        'If this tenant requires an Authenticator approval, sign in by hand once:',
        `    ${POWERBI_MESSAGES.manualSignInCommand}`,
        'That session is then reused automatically until it expires.',
      ].join('\n'),
    );
  }
});
