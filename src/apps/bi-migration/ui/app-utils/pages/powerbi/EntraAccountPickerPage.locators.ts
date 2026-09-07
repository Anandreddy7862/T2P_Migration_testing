import type { Locator, Page } from '@playwright/test';

/** Locators for the Entra "Pick an account" tile list. */
export class EntraAccountPickerPageLocators {
  constructor(private page: Page) {}

  tileList = (): Locator => this.page.locator('#tilesHolder, [data-test-id="accountTile"]').first();

  /** Dynamic: the tile for one account, scoped to the tile list. */
  tileByAccount = (account: string): Locator =>
    this.tileList().locator('div[role="button"], .tile-container').filter({ hasText: account }).first();

  useAnotherAccountTile = (): Locator =>
    this.page.getByText(/use another account/i).or(this.page.locator('#otherTile')).first();
}
