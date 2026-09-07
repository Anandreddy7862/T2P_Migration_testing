/** Subset of Playwright's trace option accepted from .env. */
export type TraceMode =
  | 'off'
  | 'on'
  | 'retain-on-failure'
  | 'on-first-retry'
  | 'on-all-retries'
  | 'retain-on-first-failure';
