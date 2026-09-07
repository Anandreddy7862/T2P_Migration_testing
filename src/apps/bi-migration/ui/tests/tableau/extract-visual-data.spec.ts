import { storageState, test } from '@fixtures';

/**
 * Downloads the data behind every visual, on every dashboard of the workbook.
 *
 * Runs against the saved Tableau session, so it never signs in itself.
 */
test.use({ storageState: storageState.tableau });

test.describe('Tableau visual data extraction', () => {
  test(
    'should download the data behind every visual on every dashboard',
    { tag: ['@tableau'] },
    async ({ uiModuleManager }) => {
      test.setTimeout(30 * 60 * 1000);
      const extractor = uiModuleManager.tableauVisualData;

      await test.step('Given the Tableau downloads folder is empty', async()=>{ 
        await extractor.clearDownloadsFolder()
      });
      
      await test.step('When the workbook is opened and edit mode is entered', async() =>{
        await extractor.openWorkbookInEditMode()
      });

      await test.step('Then the bottom dashboards bar is visible', async() =>{ 
        await extractor.assertBottomBarVisible()
      });

      await test.step('And the number of dashboards is extracted', async() =>{ 
        await extractor.countDashboards()
      });

      await test.step('Then the data behind every visual is downloaded for every dashboard', async() =>{
        await extractor.extractAllDashboards();
      });
    },
  );
});
