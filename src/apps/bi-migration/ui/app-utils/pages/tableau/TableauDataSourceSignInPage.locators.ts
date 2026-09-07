import type { FrameLocator, Locator, Page } from '@playwright/test';

/**
 * The document a "Sign in to reconnect" dialog can be rendered in.
 *
 * `Page` for authoring, `FrameLocator` for the published view - see the class
 * comment for why both are needed.
 */
export type DataSourceDialogScope = Page | FrameLocator;

/**
 * Locators for Tableau's "Sign in to reconnect" dialog - the credential prompt
 * for a workbook's LIVE data source connection (Snowflake on this workbook).
 *
 * Two measured facts shape this file.
 *
 * 1. The dialog is raised in TWO DIFFERENT DOCUMENTS during one extraction run:
 *    on the published view it renders inside the viz iframe, and after Edit
 *    navigates to /authoring/... it renders in the top document - with the
 *    fields empty again, because answering it on the published view does not
 *    carry over. Locators therefore take the scope as a parameter instead of
 *    being bound to one document. They cannot simply be OR-ed together:
 *    Playwright rejects a frame locator inside a composite locator
 *    ("Frame locators are not allowed inside composite locators").
 *
 * 2. Selectors are `data-tb-test-id` rather than `getBy*` DELIBERATELY, against
 *    the usual locator priority. The inputs carry no accessible name - their
 *    `<label>` elements are rendered EMPTY - so `getByLabel` matches nothing,
 *    and their `id`s are regenerated per render
 *    (`id="tableau-ui-1788500214699"`), so an id selector is worthless. The
 *    test ids are the only stable handle the dialog offers.
 */
export class TableauDataSourceSignInPageLocators {
  private readonly viz: FrameLocator;

  constructor(private page: Page) {
    this.viz = this.page.frameLocator(TableauDataSourceSignInPageLocators.VIZ_FRAME);
  }

  /** The viz iframe has no id, name or class - the src is the only handle. */
  static readonly VIZ_FRAME = 'iframe[src*="/views/"]';

  private static readonly DIALOG = '[data-tb-test-id="tabbed-auth-dialog-test-id-Dialog-Content"]';
  private static readonly USERNAME = '[data-tb-test-id="auth-component-username-text-field-TextInput"]';
  private static readonly PASSWORD = '[data-tb-test-id="auth-component-password-text-field-TextInput"]';
  private static readonly REMEMBER = '[data-tb-test-id="auth-component-remember-password-check-box-CheckBox"]';
  private static readonly SIGN_IN = '[data-tb-test-id="auth-component-sign-in-button-Button"]';
  private static readonly ERROR = '[data-tb-test-id="relational-dialog-error-section-error-details"]';

  /** On the published view the dialog renders inside the viz iframe. */
  publishedViewScope = (): DataSourceDialogScope => this.viz;

  /** In authoring there is no iframe - the dialog is in the top document. */
  authoringScope = (): DataSourceDialogScope => this.page;

  dialog = (scope: DataSourceDialogScope): Locator =>
    scope.locator(TableauDataSourceSignInPageLocators.DIALOG).first();

  usernameInput = (scope: DataSourceDialogScope): Locator =>
    scope.locator(TableauDataSourceSignInPageLocators.USERNAME).first();

  passwordInput = (scope: DataSourceDialogScope): Locator =>
    scope.locator(TableauDataSourceSignInPageLocators.PASSWORD).first();

  rememberPasswordCheckbox = (scope: DataSourceDialogScope): Locator =>
    scope.locator(TableauDataSourceSignInPageLocators.REMEMBER).first();

  signInButton = (scope: DataSourceDialogScope): Locator =>
    scope.locator(TableauDataSourceSignInPageLocators.SIGN_IN).first();

  /** Rejected credentials land here, e.g. "The username or password is not valid." */
  errorDetails = (scope: DataSourceDialogScope): Locator =>
    scope.locator(TableauDataSourceSignInPageLocators.ERROR).first();
}
