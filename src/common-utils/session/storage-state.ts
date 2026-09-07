import * as fs from 'fs';

import { EnvConfig } from '../helpers/EnvConfig';

/** The two products this framework signs into. */
export type Platform = 'tableau' | 'powerbi';

interface StorageStateFile {
  cookies: CookieEntry[];
  origins: unknown[];
}

interface CookieEntry {
  name: string;
  domain?: string;
  /** Unix seconds; -1 means a session cookie that dies with the browser. */
  expires?: number;
}

export interface SessionInfo {
  exists: boolean;
  authCookieCount: number;
  /** Auth cookies with no expiry. Playwright restores them, but the SERVER may
   *  already have dropped the session behind them. */
  sessionScopedCount: number;
  expiresAt: Date | null;
  hoursLeft: number | null;
  usable: boolean;
  reason: string;
}

const EMPTY: StorageStateFile = { cookies: [], origins: [] };

/**
 * Cookies that actually carry the login. Everything else in a storageState is
 * analytics and consent noise that outlives the session by a year, so any
 * "latest expiry wins" reading reports a fantasy (_ga expires in 13 months
 * while the Tableau session cookie dies with the browser).
 */
const AUTH_COOKIES: Record<Platform, RegExp> = {
  tableau: /^(workgroup_session_id|JSESSIONID|auth0|auth0_compat|tableau_session|XSRF-TOKEN)$/i,
  powerbi: /^(ESTSAUTHPERSISTENT|ESTSAUTH|ESTSAUTHLIGHT|SignInStateCookie|buid|ESTSSC|FedAuth)$/i,
};

function storageStatePath(platform: Platform): string {
  return platform === 'tableau' ? EnvConfig.tableau.storageState : EnvConfig.powerBi.storageState;
}

function read(file: string): StorageStateFile {
  if (!fs.existsSync(file)) return { ...EMPTY };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as StorageStateFile;
    return { cookies: parsed.cookies ?? [], origins: parsed.origins ?? [] };
  } catch {
    return { ...EMPTY };
  }
}

/**
 * Cheap pre-flight on a saved session, so an expired login fails in seconds
 * with a clear message instead of surfacing as an empty screen minutes in.
 *
 * CAVEAT: cookie expiry is not session validity. Tableau invalidates its
 * server-side session on its own idle timeout while the cookie still looks
 * fine, and Entra can revoke early via Conditional Access. `usable: true`
 * therefore means "worth trying", never "guaranteed".
 */
export function describeSession(platform: Platform): SessionInfo {
  const file = storageStatePath(platform);
  const absent = (reason: string): SessionInfo => ({
    exists: fs.existsSync(file),
    authCookieCount: 0,
    sessionScopedCount: 0,
    expiresAt: null,
    hoursLeft: null,
    usable: false,
    reason,
  });

  if (!fs.existsSync(file)) return absent(`no saved session at ${file}`);

  const authCookies = read(file).cookies.filter((cookie) => AUTH_COOKIES[platform].test(cookie.name));
  if (authCookies.length === 0) {
    return absent('saved file holds no authentication cookies - the sign-in did not complete');
  }

  const persistent = authCookies
    .map((cookie) => cookie.expires ?? -1)
    .filter((expiry) => expiry > 0)
    .sort((left, right) => left - right);

  if (persistent.length === 0) {
    return {
      exists: true,
      authCookieCount: authCookies.length,
      sessionScopedCount: authCookies.length,
      expiresAt: null,
      hoursLeft: null,
      usable: true,
      reason:
        platform === 'powerbi'
          ? 'auth cookies are session-scoped - answer "Stay signed in?" with Yes for a lasting session'
          : 'auth cookies are session-scoped - the server may have expired the session already',
    };
  }

  const latest = persistent[persistent.length - 1] * 1000;
  const hoursLeft = (latest - Date.now()) / 3_600_000;

  return {
    exists: true,
    authCookieCount: authCookies.length,
    sessionScopedCount: authCookies.length - persistent.length,
    expiresAt: new Date(latest),
    hoursLeft: Number(hoursLeft.toFixed(1)),
    usable: hoursLeft > 0,
    reason:
      hoursLeft > 0
        ? `auth cookies valid for about ${formatDuration(hoursLeft)}`
        : `auth cookies expired ${formatDuration(-hoursLeft)} ago`,
  };
}

function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}
