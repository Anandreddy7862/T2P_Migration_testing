import * as path from 'path';

import * as dotenv from 'dotenv';

import type { TraceMode } from './trace.types';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const str = (key: string, fallback = ''): string => process.env[key]?.trim() || fallback;

const num = (key: string, fallback: number): number => {
  const parsed = process.env[key] === undefined ? Number.NaN : Number(process.env[key]);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const bool = (key: string, fallback: boolean): boolean => {
  const raw = process.env[key]?.trim().toLowerCase();
  if (raw === undefined || raw === '') return fallback;
  return raw === 'true' || raw === '1' || raw === 'yes';
};

/**
 * Fails with an actionable message instead of letting `undefined` reach a
 * `.fill()` halfway through a sign-in.
 */
export function required(key: string): string {
  const value = str(key);
  if (!value) {
    throw new Error(`Missing required environment variable "${key}". Copy .env.example to .env and set it.`);
  }
  return value;
}

/**
 * Typed view over `.env`. The authoritative list of keys is here, not in
 * `.env.example`.
 */
export class EnvConfig {
  static readonly tableau = {
    baseUrl: str('TABLEAU_BASE_URL'),
    /**
     * Sign in on this url. QUOTE IT in .env - Tableau view urls contain '#',
     * which starts a comment in a .env file, so an unquoted value is silently
     * truncated and you land on the pod root instead of the site.
     */
    startUrl: str('TABLEAU_START_URL') || str('TABLEAU_BASE_URL'),
    username: str('TABLEAU_USERNAME'),
    password: str('TABLEAU_PASSWORD'),
    /** tableau-cloud | tableau-server | tableau-public */
    authType: str('TABLEAU_AUTH_TYPE', 'tableau-cloud'),
    /** The segment after /site/ in a dashboard url. */
    site: str('TABLEAU_SITE'),
    /**
     * The account the workbook's LIVE connection uses (Snowflake here),
     * answered into Tableau's "Sign in to reconnect" dialog.
     *
     * NOT the Tableau login. Without it every visual renders "No data to
     * visualise with current filters" and the extraction downloads empty CSVs.
     */
    datasource: {
      username: str('TABLEAU_DATASOURCE_USERNAME'),
      password: str('TABLEAU_DATASOURCE_PASSWORD'),
      /**
       * Ticks "Remember Password", which stores the credential against the
       * Tableau user server-side. Off by default - it changes account state,
       * not just this browser session.
       */
      rememberPassword: bool('TABLEAU_DATASOURCE_REMEMBER_PASSWORD', false),
    },
    storageState: path.resolve(process.cwd(), 'auth/tableau.json'),
  };

  static readonly powerBi = {
    baseUrl: str('POWERBI_BASE_URL', 'https://app.powerbi.com'),
    startUrl: str('POWERBI_START_URL') || str('POWERBI_BASE_URL', 'https://app.powerbi.com'),
    username: str('POWERBI_USERNAME'),
    password: str('POWERBI_PASSWORD'),
    /** How long a headed run may block on an interactive MFA prompt. */
    mfaWaitMs: num('MFA_WAIT_MS', 180_000),
    /** Budget for the whole hand-driven sign-in. */
    manualLoginMs: num('MANUAL_LOGIN_MS', 600_000),
    storageState: path.resolve(process.cwd(), 'auth/powerbi.json'),
  };

  static readonly isHeadless = bool('HEADLESS', true);
  static readonly slowMo = num('SLOW_MO', 0);
  static readonly defaultTimeout = num('DEFAULT_TIMEOUT', 60_000);
  static readonly navigationTimeout = num('NAV_TIMEOUT', 90_000);
  static readonly retries = num('RETRIES', process.env.CI ? 2 : 0);
  static readonly workers = num('WORKERS', 1);
  static readonly trace = str('TRACE', 'retain-on-failure') as TraceMode;
}
