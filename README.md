# Tableau + Power BI Sign-In Framework

Playwright + TypeScript framework that signs into **Tableau Cloud** and **Power BI**, saves the session, and reuses it — so anything built on top never touches a login form again.

Both flows are **verified against the live products**, and every non-obvious selector is documented with *why* it is what it is.

Everything is TypeScript — including the CLI script, which runs through `tsx` with no build step.

---

## 1. Structure (Page Object Model)

One page object per **screen**. Each class owns its own locators and the actions
available on that screen; a **flow** class owns only the sequencing; **fixtures**
hand them to the specs. A screen changing touches exactly one class.

```
T2P_Migration_testing/
├── playwright.config.ts        # 3 sign-in projects
├── .env.example                # copy to .env and fill in credentials
│
├── src/
│   ├── core/
│   │   ├── BasePage.ts         # base for every page object: locator resolution,
│   │   │                       #   isDisplayed() helpers, clicks, fills, retry
│   │   └── logger.ts
│   │
│   ├── pages/                  # ⭐ ONE PAGE OBJECT PER SCREEN
│   │   ├── tableau/
│   │   │   ├── TableauSignInPage.ts        # sso.online.tableau.com  (email)
│   │   │   ├── TableauSiteUriPage.ts       # "Tell us where to sign in"
│   │   │   ├── TableauCredentialsPage.ts   # identity.idp.tableau.com (email+pwd)
│   │   │   └── TableauHomePage.ts          # signed-in proof
│   │   └── powerbi/
│   │       ├── PowerBiEmailGatePage.ts     # app.powerbi.com/singleSignOn
│   │       ├── EntraSignInPages.ts         # email / password / account picker /
│   │       │                               #   "Stay signed in?"
│   │       ├── EntraMfaPages.ts            # push / method picker / code entry
│   │       └── PowerBiReportPage.ts        # signed-in proof (canvas)
│   │
│   ├── flows/                  # ⭐ SEQUENCING ONLY - no locators
│   │   ├── TableauLoginFlow.ts
│   │   └── PowerBiLoginFlow.ts
│   │
│   ├── fixtures/pageFixtures.ts  # tableauLogin / powerBiLogin / page objects
│   ├── config/env.ts             # typed .env loader + required() guard
│   └── utils/storageState.ts   # session save + lifetime inspection
│
├── tests/
│   ├── auth/tableau.setup.ts          # scripted  -> .auth/tableau.json
│   ├── auth/powerbi.setup.ts          # scripted  -> .auth/powerbi.json
│   └── auth/powerbi.manual.setup.ts   # hand-driven, for un-automatable MFA
│
├── scripts/session-report.ts   # npm run session - session lifetimes (via tsx)
│
└── .auth/                      # saved sessions (git-ignored)
```

### The contract

Every page object exposes:

| Member | Purpose |
| --- | --- |
| `private readonly <name> = [...]` | Locator candidates for one element, most specific first. A vendor UI change is one line, in the class that owns that screen. |
| `isDisplayed()` | Is this screen on show? The flows compose these to decide where they are. |
| action methods | `submitUsername()`, `submitPassword()`, `chooseVerificationCode()`, … |
| `readError()` | The screen's own rejection message, where it has one. |

Flows never contain a selector. Specs never construct a page object — they take
a fixture:

```ts
setup('authenticate to Tableau', async ({ tableauLogin }) => {
  await tableauLogin.login(env.tableau.startUrl);
  await tableauLogin.saveSession();
});
```

Flows are **observational, not sequential**: each pass asks which screen is
displayed and dispatches to it. Neither vendor's flow is fixed — Tableau's
site-URI screen appears only sometimes, Power BI's gate is tenant-dependent, the
Entra email step is usually skipped, and MFA may be push, a code, or absent — so
a hardcoded order breaks on the first variant you did not test against.

Page objects are also addressable individually for single-screen assertions:

```ts
expect(await powerBiLogin.emailGatePage.isDisplayed()).toBe(true);
```

## 2. Setup

```bash
npm install
cp .env.example .env      # then fill in the values below
```

| Variable | Meaning |
| --- | --- |
| `TABLEAU_BASE_URL` | e.g. `https://prod-in-a.online.tableau.com` |
| `TABLEAU_START_URL` | Sign in on this url — a *dashboard* url lands on the right site/tenant |
| `TABLEAU_USERNAME` / `TABLEAU_PASSWORD` | Tableau Cloud credentials |
| `TABLEAU_AUTH_TYPE` | `tableau-cloud`, `tableau-server`, or `tableau-public` (skips login) |
| `POWERBI_START_URL` | Report url to sign in on |
| `POWERBI_USERNAME` / `POWERBI_PASSWORD` | Entra ID credentials |
| `HEADLESS` | `false` to watch it, or to complete MFA by hand |

---

## 3. Running

```bash
npm run auth:tableau           # scripted Tableau sign-in
npm run auth:powerbi           # scripted Entra ID sign-in
npm run auth:powerbi:manual    # hand-driven sign-in (MFA that needs your phone)
npm run auth                   # both scripted flows

npm run session                # how much life each saved session has left
```

Sessions land in `.auth/*.json`. Point a `storageState` at those files from any downstream project and it starts already signed in.

---

## 4. How each sign-in works

The screens below each have their own page object; the flow classes decide which one to hand off to. Both vendors hide a trap that a fixed sequence walks straight into.

### Tableau

```
prod-*.online.tableau.com/#/site/<site>/views/...
   -> sso.online.tableau.com/public/idp/SSO      #email + #login-submit
   -> identity.idp.tableau.com/login             #email + #password + #signInButton
   -> the dashboard
```

**The trap:** the second page ships the email box **empty**, even though the first page already collected the address (it is in the url as `login_hint`, just not populated). Filling only the password submits a blank username, and Tableau answers with its generic *"The sign-in was unsuccessful. Try again."* — which reads exactly like a wrong password. So the credentials page re-fills **both** fields.

**Second trap:** on a viz url the toolbar and global nav render **inside the viz iframe**, so a page-level check for `.tabToolbar` finds nothing even when signed in. "Signed in" is therefore decided from the url, not from those markers.

Tableau Server is usually one page with both fields — `TableauCredentialsPage` covers that too. Tableau Public needs no sign-in at all.

### Power BI

```
app.powerbi.com/<report>
   -> /singleSignOn        "Enter your work or school email"  #email + #submitBtn
   -> login.microsoftonline.com   email -> Next  (often skipped: login_hint)
   -> password  #i0118 + #idSIButton9
   -> MFA
   -> "Stay signed in?"  -> Yes
   -> the report
```

**Trap 1:** the `/singleSignOn` gate is Power BI's own form, not Entra's — plain `#email`, different markup — and it renders *after* the redirect, so it must be waited for, not probed once.

**Trap 2:** Entra keeps a **decoy** `input[name="loginfmt"]` on the password page — off-screen, `aria-hidden`, holding the display name. Playwright counts it as visible, so an unfiltered selector thinks it is on the email step and hangs clicking an element the footer intercepts. Hence `:not([aria-hidden="true"]):not(.moveOffScreen)`.

**Trap 3:** *"Stay signed in?"* lives on `login.microsoftonline.com`, so anything waiting for the url to leave that host waits forever while one click would finish the job. It gets its own page object (`EntraStaySignedInPage`).

---

## 5. Power BI MFA

None of Microsoft's second factors can be completed by automation:

| Method | Why not |
| --- | --- |
| Authenticator **push** / number matching | Approval must come from the enrolled phone. Number matching exists specifically to defeat scripted sign-ins. |
| **Verification code** | Has to be read off a device. Automating it needs an enrolment secret, and this tenant blocks third-party authenticator apps. |
| SMS / voice call | Same reason as push. |

Entra's password-grant (ROPC) flow is documented to fail whenever MFA is required, so there is no API shortcut either.

So the supported path is **sign in once by hand, then reuse the session**:

```bash
npm run auth:powerbi:manual    # ONCE: you sign in and approve on your phone
npm run session                # confirm what you got
```

That project automates **nothing** about the login on purpose — you type the password and approve the push. It waits (`MANUAL_LOGIN_MS`, default 10 min) until the report canvas is genuinely on screen, then saves the session. Answer **Yes** to *"Stay signed in?"*: that is what makes it persist. In practice this yields a **90-day** Entra session, so it is one approval every few weeks.

The MFA page objects ([EntraMfaPages.ts](src/pages/powerbi/EntraMfaPages.ts)) still recognise the push, method-picker and code screens — they surface the matching number to enter and tick *"don't ask again"* — but they exist to tell you what to do, not to get past it. A headless run that meets MFA fails immediately pointing at `auth:powerbi:manual` rather than hanging.

For fully unattended CI, ask your Entra admin for a Conditional Access exclusion for an automation account scoped to the runner's IP, or to enable third-party OATH tokens (which would make code-based MFA automatable again).

---

## 6. Session lifetime

```
platform  usable  authCk  expires           left    detail
tableau   yes     5       2026-08-25 04:44  72h     auth cookies valid for about 3d
powerbi   yes     5       2026-11-20 04:31  2160h   auth cookies valid for about 90d
```

[describeSession()](src/utils/storageState.ts) counts only cookies that actually carry the login. This matters: a storageState is full of analytics and consent cookies that outlive the session by a year, so a naive "latest expiry wins" reading reports a fantasy — `_ga` expires in 13 months while Tableau's session cookie dies with the browser.

**Cookie expiry is not session validity.** Tableau Cloud can drop the server-side session on its own idle timeout while the cookie still looks healthy, and Entra can revoke early via Conditional Access. So `usable: true` means "worth trying", never "guaranteed".

Because of that, the two platforms are treated differently:

- **Tableau** signs in **fresh every run** by default — its login is scripted and needs no human, so paying ~30s beats guessing. `REUSE_AUTH=true` opts into reuse.
- **Power BI** **reuses** its saved session by default, because re-authenticating may need your phone. `FORCE_REAUTH=true` overrides.

`npm run session` exits non-zero when something needs re-auth, so it works as a CI pre-flight.

---

## 7. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `Could not locate "..."` | Vendor UI changed. The error lists every selector tried — add the new one at the top of that array in the page object that owns the screen (`src/pages/...`) |
| `Tableau sign-in rejected: The sign-in was unsuccessful` | Wrong credentials — or a blank username was submitted (see §4) |
| `sign-in needs you to ... but this run is headless` | Use `npm run auth:powerbi:manual` |
| `Refusing to save an unauthenticated session` | The flow ended on a login url. The screenshot in `artifacts/test-artifacts/` shows which screen |
| Session expired sooner than expected | Conditional Access sign-in frequency, or *"Stay signed in?"* was answered No |
