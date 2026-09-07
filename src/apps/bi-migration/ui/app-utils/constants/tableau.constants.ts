/** Tableau sign-in constants. No UI literal belongs in a page or module. */

export const TABLEAU_AUTH_TYPE = {
  public: 'tableau-public',
} as const;

export const TABLEAU_MESSAGES = {
  publicNoSignIn: 'Tableau Public - no sign-in required, opening the viz anonymously',
  sessionEstablished: 'Tableau session established',
  toolbarConfirmed: 'Tableau sign-in confirmed by the viz-viewer toolbar',
  reusingSession: 'reusing the saved Tableau session',
} as const;

/**
 * Tableau's "Sign in to reconnect" dialog - the credential prompt for a
 * workbook's LIVE data source connection.
 *
 * Measured against the migrated workbook: the dialog is raised TWICE in one
 * run, once on the published view and again after Edit enters authoring, and
 * the second one arrives with the fields empty. Both must be answered.
 */
export const TABLEAU_DATASOURCE = {
  dialogTitle: 'Sign in to reconnect',
  /** How long the prompt is given to appear before it is judged absent. */
  promptTimeoutMs: 15_000,
  /** How long Tableau is given to reconnect after Sign In is clicked. */
  reconnectTimeoutMs: 90_000,
} as const;

export const TABLEAU_ASSERTIONS = {
  signedIn: 'Tableau should be signed in and off the sign-in hosts',
  siteRequired:
    'Tableau asked which site to sign in to, but TABLEAU_SITE is not set. ' +
    'It is the segment after /site/ in the dashboard url. Also check TABLEAU_START_URL is QUOTED - ' +
    'an unquoted url is truncated at its "#".',
  bottomBarVisible: 'the authoring bottom bar should be visible after entering edit mode',
  dashboardsFound: 'the workbook should expose at least one dashboard in the bottom bar',
  downloadButtonVisible: 'the data panel should show a visible Download button',
} as const;

/** Where extracted Tableau data lands. */
export const TABLEAU_DOWNLOADS = {
  dir: 'downloads/tableau',
} as const;
