import { storageState, test } from '@fixtures';

/**
 * Downloads the data behind every visual, on every page of the report.
 *
 * Runs against the saved Power BI session, so it never signs in itself - this
 * tenant's MFA cannot be automated, so the session comes from
 * `npm run auth:powerbi:manual`.
 */
test.use({ storageState: storageState.powerBi });

test.describe('Power BI visual data extraction', () => {
  test(
    'should download the data behind every visual on every report page',
    { tag: ['@powerbi'] },
    async ({ uiModuleManager }) => {
      test.setTimeout(30 * 60 * 1000);
      const extractor = uiModuleManager.powerBiVisualData;

      await test.step('Given the Power BI downloads folder is empty', () => extractor.clearDownloadsFolder());

      await test.step('When the report is opened and all visuals have loaded', () => extractor.openReport());

      await test.step('Then the number of report pages is extracted', () => extractor.countPages());

      await test.step('Then the data behind every visual is downloaded for every page', () =>
        extractor.extractAllPages(),
      );
    },
  );
});
