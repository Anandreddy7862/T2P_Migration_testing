/** Power BI / Entra ID sign-in constants. No UI literal belongs in a page or module. */

/**
 * Entra's own method codes, carried on the "Verify your identity" tiles as
 * `data-value`. Far more durable than matching the display text.
 */
export const ENTRA_MFA_METHOD = {
  push: 'PhoneAppNotification',
} as const;

export const POWERBI_MESSAGES = {
  pushSent: 'Authenticator push sent - approve the notification on your phone',
  numberMatching: (digits: string): string => `Authenticator NUMBER MATCHING - enter "${digits}" on your phone`,
  sessionEstablished: 'Power BI session established',
  reusingSession: 'reusing the saved Power BI session',
  manualSignInCommand: 'npm run test:auth:powerbi:manual',
} as const;

export const POWERBI_ASSERTIONS = {
  sessionUsable: 'the saved Power BI session should be usable',
  pagesFound: 'the report should expose at least one page in the page-tab strip',
  visualToolbarVisible: "the selected visual's own toolbar and 3-dot button should be visible",
  exportDataVisible: 'the visual menu should show a visible "Export data" item',
  csvOptionVisible: 'the file-format list should offer the csv option',
} as const;

/** Where extracted Power BI data lands. */
export const POWERBI_DOWNLOADS = {
  dir: 'downloads/powerbi',
} as const;
