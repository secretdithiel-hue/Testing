# Husay ng Soksay — Automated Registration System and Website

A Google Apps Script system that runs the UPLB Sociology Society's **Husay ng Soksay** inter-high school social science competition from one Google Sheet, and the public **website** (GitHub Pages) where people learn about the organization and the competition, register and submit their entries.

It automates registration, fees, payment receipts, referrals, discount codes, anonymous judging and announcements, all managed from one **Admin Center** menu. Registrations and entries sent through the website land in the same sheets as Google Form responses and are processed the same way.

**Current version:** V1.3 (see the CHANGELOG at the top of `src/Code.gs`)

## Features

- **Website:** home, about and history, competitions (mechanics, criteria, prizes, fee calculator), Hall of Fame, FAQ, an online registration form and an entry submission page. No Google sign-in needed.
- **Registration & pricing:** form-driven registration with generated IDs (Gen. ID / referral code), competition name normalization, bundle pricing for standard and special competitions, email and proof-of-payment validation.
- **Coupons:** Coupon Manager sheet, Member Ambassador coupons, coupon generator.
- **Referrals:** both parties get a discount; the referrer earns cashback on the first paid referral and a smaller amount on each one after that. Notification emails go out when a referral succeeds or is removed.
- **Finance:** Financial Dashboard synced from Registration, Cashback Report, Payment Verification Center (expected amount vs amount received, mismatch detection), and Combined Registration Merge (master transactions for groups).
- **Emails:** registration confirmation, Acknowledgement Receipt (AR) with the participant's website access code, referral notifications, submission acknowledgement, announcements (including scheduled ones), Gmail threading, and bulk or per-row resend tools.
- **Submissions & depersonalization:** submission form handler, participant numbers, anonymized file copies and a document PII scan for anonymous judging.
- **Admin tools:** System Introduction & Guide, System Dashboard, health checks, System Updater, column tools, Manual Response Editor, Participant Number Audit, Analytics & Finance Dashboards, Website & Online Forms.

## Repository layout

| Path | What it is |
| --- | --- |
| `src/Code.gs` | The whole system (one script file). Settings live in `SYSTEM_CONFIG` near the top; the look of the original spreadsheet is in `getOriginalLayout_()`; the website's connection is PART 26. |
| `src/appsscript.json` | Apps Script manifest: Asia/Manila time zone, V8 runtime, Gmail API and Drive API advanced services. |
| `site/` | The website, published on GitHub Pages. Plain HTML, CSS and JavaScript: nothing to build. |
| `tools/export_site_defaults.js` | Copies the settings the website needs (prices, answer options, the submission form's questions) from `Code.gs` into `site/assets/js/defaults.js`. |
| `tests/` | Node tests that run the real `Code.gs` against a small Google Sheets mock, and a browser test of the website. |
| `.github/workflows/` | `pages.yml` publishes the website; `tests.yml` runs the tests. |

The git history keeps the version before the V1.0 relabel as the first commit, so `git diff` against it shows what V1.0 changed.

## Setting up a new spreadsheet (same look as the original)

1. Create a new Google Sheet.
2. Make copies of the **registration** and **submission** Google Forms, and in each copy open **Responses → Link to Sheets** and choose the new spreadsheet. Google adds two "Form Responses" tabs.
3. In the sheet open **Extensions → Apps Script**, replace `Code.gs` with `src/Code.gs`, and add the **Gmail API** and **Drive API** under **Services** (or paste `src/appsscript.json` into the manifest under **Project Settings → Show "appsscript.json"**).
4. Save, reload the sheet, and run **Admin Center → 🏗️ BUILD BUILD BUILD**. It:
   - renames the form tabs to **Registration Form** and **Submission Form** and adds the system columns;
   - creates the other tabs in the original order (Participant Database, Financial Dashboard, the four judges' sheets, Coupon Manager) and the hidden System Logs, Admin Audit Log and Merge Ledger;
   - applies the original header text, colours, Google Sans font, column widths, frozen rows, alternating row colours and dropdowns;
   - sets the time zone (Asia/Manila) and locale (en_US) and installs the form-submit and edit triggers as you.
5. Fill in the Drive folder IDs in `SYSTEM_CONFIG.DEPERSONALIZATION.ANON_FOLDERS` if you use anonymized copies, add coupon codes, then submit one test registration.

Linked the forms after building? Run BUILD again: it swaps the empty placeholder tabs for the form tabs. BUILD never reformats a sheet that already has responses, and it does not add triggers to a spreadsheet that already has them.

To push from this repo with [clasp](https://github.com/google/clasp) instead, run `clasp clone <scriptId> --rootDir src` once, then `clasp push`.

## The website

The website has eight pages: home, about (the organization and its history), competitions (mechanics, judging criteria, prizes, fees and a fee calculator), Hall of Fame, FAQ, **Register**, **Submit entry**, and a "page not found" page.

**How the forms reach the spreadsheet.** The script is published as a web app. When someone registers on the website, the web app writes a new row into **Registration Form** exactly as the Google Form would (same columns, the same answer wording such as `BUNDLE A: 1 Competition + Film Making (₱649)`, uploads as `https://drive.google.com/open?id=` links) and runs the same processing as a form response: Gen ID, pricing, coupon and referral, the Finance row and the confirmation email. Entries work the same way in **Submission Form** (participant numbers, anonymized copies, the acknowledgement email). The `SYS_SOURCE` column marks the rows that came from the website. A Google Form with file-upload questions cannot be filled in by a script, so the row is written directly; the Google Forms keep working alongside the website.

**Submitting entries.** The Acknowledgement Receipt (sent when the Finance team marks a payment as PAID) now also contains the participant's **access code** and an **Open my submission page** button. On the website people sign in with their email and that code; they can have the code emailed again. Files up to 20 MB upload directly; longer videos are sent as a Google Drive link, and the script keeps its own copy.

**Preview mode.** Until the web app address is filled in, the website runs in preview mode: every page works, the forms can be tried out, and a banner says that nothing is sent.

### Putting the website online (once)

1. **Publish the script as a web app.** In the spreadsheet open **Extensions → Apps Script → Deploy → New deployment**. Choose the type **Web app**, set **Execute as: Me** and **Who has access: Anyone**, then **Deploy** and allow the permissions. Copy the **Web app URL** (it ends in `/exec`). It is also shown in **Admin Center → 🌐 Website & Online Forms**.
2. **Connect the website.** In `site/assets/js/config.js` paste the address into `apiUrl: ""`, and commit.
3. **Turn on GitHub Pages.** In the GitHub repository open **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
4. **Publish.** Merge into `main`. The **Website** workflow (`.github/workflows/pages.yml`) publishes the `site/` folder; the address appears in **Settings → Pages**. It runs again whenever something in `site/` changes on `main`, and can be started by hand from the **Actions** tab.
5. **Set up the forms in the spreadsheet:** **Admin Center → 🌐 Website & Online Forms**:
   - **Website address:** the address from step 4. This puts the access code and the personal submission link in every receipt email.
   - **Online registration / Online entry submission:** *Closed*, *Open now*, or *Automatic* (open between the two dates, Asia/Manila time). The website shows a countdown while a form is about to open.
   - **Payment accounts** shown on the registration page (mode, account name, number), the **dates** shown on the website, and the links to the **registration form template** and the **event primer**.

After changing the script later, publish the new version: **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**. The address stays the same.

### The website's address

GitHub Pages names a site after the account and the repository that publish it. As it is now, this repository would publish at `https://secretdithiel-hue.github.io/Testing/`. To publish at **`https://husayngsoksay.github.io`** instead:

1. **Create a free GitHub organization named `husayngsoksay`:** on GitHub click your profile picture → **Your organizations → New organization → Free**. GitHub tells you right away if the name is taken; any other name works the same way (the address follows it).
2. **Move this repository into it:** **Settings → General → Danger Zone → Transfer ownership**, new owner `husayngsoksay`. The history, the pull request and the settings move along, and old links redirect.
3. **Rename the repository to `husayngsoksay.github.io`:** **Settings → General → Repository name**. A repository with exactly that name publishes at the organization's root address.
4. Follow **Putting the website online** above (steps 3 and 4), then enter the new address in **Admin Center → Website & Online Forms**.

An organization also keeps the website in the Society's hands: add the officers under the organization's **People**, so the site does not depend on one person's account.

For an address like `husayngsoksay.com` (or `.org`, `.ph`), buy the domain from a domain registrar, enter it in **Settings → Pages → Custom domain**, and add the DNS records GitHub lists there. GitHub Pages still hosts the site for free.

Nothing in the website needs to change for a new address: every link inside it is relative, and the Website workflow tells the "page not found" page where the site starts.

### Editing the website

- **Texts:** the HTML files in `site/` (each page repeats the same header and footer). The data privacy statement and the ethical use pledge shown on the registration page are in `site/register.html`: replace them with the official wording of the Google Form if it differs. The answers saved in the sheet are always the form's exact answers (`SYSTEM_CONFIG.WEBSITE.ANSWERS`).
- **Hall of Fame:** `site/assets/js/archive-data.js` (one entry per edition). Student names are left out on purpose; add them only with consent.
- **Next edition, contact details, Facebook page link:** `site/assets/js/config.js`. Set `facebookUrl` to the page's own address.
- **Look:** `site/assets/css/style.css` (colours and fonts are at the top). Logos are in `site/assets/img/`.
- **Prices, competitions, answer options:** change `SYSTEM_CONFIG` in `Code.gs` as usual, then run `node tools/export_site_defaults.js` so the website's built-in copy matches (the tests check this). The live website reads these from the spreadsheet anyway; the copy is used in preview mode.

### Protection against misuse

- Files: only the listed file types, checked by their content; registration documents up to 10 MB with a daily total; entry files only from signed-in, paid participants; Drive links only for the video questions, only for videos, up to 4 GB.
- Forms: a hidden field and a minimum fill-in time stop simple bots; one website registration per email; an hourly cap on website registrations and entries; a repeated request (double click, dropped connection) never creates a second row.
- Access codes: wrong codes lock that email for 10 minutes after 8 tries. The code is derived from a secret kept in the script's properties.
- If the forms are ever flooded, set them to **Closed** in **Website & Online Forms**; it takes effect immediately. **Remove unused uploads** there moves files that never became part of a registration or entry to the trash.

### Trying the website on your computer

```sh
node tests/web_test_server.js 8080            # http://localhost:8080, connected to the real Code.gs on a mock spreadsheet
PREVIEW=1 node tests/web_test_server.js 8080  # the same in preview mode
```

## Design

The look was designed in Canva in the style of the **HNS Event Primer 2025**, then rebuilt in code:

- Dashboard mockup: https://canva.link/xsao2f81m0rtfpp
- Email mockup: https://canva.link/x8fk5sd3hbxnsxu

Brand colours and fonts live in `SYSTEM_CONFIG.BRAND`: royal indigo `#1a00ab`, yellow `#fbd23f`, cream `#f6efdc`, Lilita One for titles and Poppins for text.

- **Website:** cream ruled paper, thick indigo outlines with offset shadows, yellow ribbons and label tags, sticker icons for the four competitions, a HUSAY ng SOKSAY wordmark, and the competitions' primer names (Naratibo ng SokSay, Alingawngaw ng SokSay, Tatak SokSay: Imahe ng Lipunan, Salaysay, SokSay: Kwento ng Lipunan). Works on phones, with keyboards and screen readers, and with reduced motion.
- **Dialogs:** cream ruled paper with yellow halftone corners, a HUSAY NG SOKSAY wordmark block, page titles on a yellow ribbon, paper cards with thick indigo outlines and yellow label tags, indigo table headers, yellow pill tabs and indigo buttons. Every dialog passes through `withGuideLink_()`, which applies it (`applyAdminBrandTheme_()`, `getAdminBrandCss_()`, `fixLowContrast_()`). Set `SYSTEM_CONFIG.BRAND.ADMIN_THEME` to `"classic"` to get the old dark dialogs back.
- **Emails:** cream page, a card with a thick indigo outline, a yellow status ribbon (for example PAYMENT CONFIRMED), section titles as indigo tags, soft-yellow referral-code boxes and totals on a yellow highlight. Gmail cannot load web fonts, so titles show in Arial Black there.
- **Spreadsheet tabs** keep the original sheet's look (`getOriginalLayout_()`).

## Making changes

- Prices, rules, sheet names, columns and email wording: edit `SYSTEM_CONFIG`.
- Competitions: edit `SYSTEM_CONFIG.COMPETITIONS` (and its price, prefix and submission columns). The Full System Health Check reports any mismatch.
- Menu tools: edit `getAdminMenuDefinition_()` only.
- The look a new build gets: edit `getOriginalLayout_()`.
- The website's limits and answer wording: `SYSTEM_CONFIG.WEBSITE`.
- Record every change in the **CHANGELOG** in the header of `src/Code.gs` (V1.3, V2.0, …).

## Tests

The script tests need Node.js 18 or later and nothing else:

```sh
node tests/run_builder_test.js src/Code.gs   # BUILD BUILD BUILD reproduces the original layout
node tests/run_fix_tests.js src/Code.gs      # behaviour of the V1.1 bug fixes
node tests/run_theme_tests.js src/Code.gs    # the Canva design of dialogs and emails
node tests/run_web_api_tests.js src/Code.gs  # the website API: rows, wording, uploads, access codes, limits
```

The website test drives Chromium through a registration and two entries and checks the rows they produce. It needs Playwright (`npm install --no-save playwright && npx playwright install chromium`):

```sh
node tests/run_site_e2e.js
```

`tests/original_layout.json` holds the original spreadsheet's tab names, header rows, column widths, colours and dropdowns (no participant data). The mock covers only the Apps Script calls these paths use, so test any change in a copy of the real spreadsheet before using it live. GitHub runs all of these on every pull request (`.github/workflows/tests.yml`).
