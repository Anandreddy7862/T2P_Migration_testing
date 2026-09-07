import { describeSession } from '@common-utils/session/storage-state';
import { EnvConfig } from '@common-utils/helpers/EnvConfig';
import { test as setup } from '@fixtures';

/**
 * Establishes a Tableau session and persists it to auth/tableau.json.
 *
 * Signs in FRESH every run by default: Tableau's cookies outlive the server-side
 * session (Tableau Cloud expires that on its own idle timeout), so a "valid for
 * 2d" cookie can still land you on the SSO page. The sign-in is fully scripted
 * and needs no human, so paying ~30s beats guessing. Set REUSE_AUTH=true to
 * reuse a live session while iterating locally.
 */
setup('should establish a Tableau session', async ({ uiModuleManager }) => {
  setup.setTimeout(5 * 60 * 1000);

  const existing = describeSession('tableau');
  if (existing.usable && process.env.REUSE_AUTH === 'true') {
    setup.info().annotations.push({ type: 'skipped-login', description: existing.reason });
    return;
  }

  await setup.step('Given the Tableau dashboard url', () => Promise.resolve());
  await setup.step('When the credentials are submitted', () =>
    uiModuleManager.tableauLogin.signIn(EnvConfig.tableau.startUrl),
  );
  await setup.step('Then the session is signed in and saved', async () => {
    await uiModuleManager.tableauLogin.assertSignedIn();
    await uiModuleManager.tableauLogin.saveSession();
  });
});
