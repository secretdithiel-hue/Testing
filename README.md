# Husay ng Soksay — Automated Registration System

A Google Apps Script system that runs the UPLB Sociology Society's **Husay ng Soksay** inter-high school social science competition from one Google Sheet. It automates registration, fees, payment receipts, referrals, discount codes, anonymous judging and announcements, all managed from one **Admin Center** menu.

**Current version:** V1.2 (see the CHANGELOG at the top of `src/Code.gs`)

## Features

- **Registration & pricing:** form-driven registration with generated IDs (Gen. ID / referral code), competition name normalization, bundle pricing for standard and special competitions, email and proof-of-payment validation.
- **Coupons:** Coupon Manager sheet, Member Ambassador coupons, coupon generator.
- **Referrals:** both parties get a discount; the referrer earns cashback on the first paid referral and a smaller amount on each one after that. Notification emails go out when a referral succeeds or is removed.
- **Finance:** Financial Dashboard synced from Registration, Cashback Report, Payment Verification Center (expected amount vs amount received, mismatch detection), and Combined Registration Merge (master transactions for groups).
- **Emails:** registration confirmation, Acknowledgement Receipt (AR), referral notifications, submission acknowledgement, announcements (including scheduled ones), Gmail threading, and bulk or per-row resend tools.
- **Submissions & depersonalization:** submission form handler, participant numbers, anonymized file copies and a document PII scan for anonymous judging.
- **Admin tools:** System Introduction & Guide, System Dashboard, health checks, System Updater, column tools, Manual Response Editor, Participant Number Audit, Analytics & Finance Dashboards.

## Repository layout

| Path | What it is |
| --- | --- |
| `src/Code.gs` | The whole system (one script file). Settings live in `SYSTEM_CONFIG` near the top; the look of the original spreadsheet is in `getOriginalLayout_()`. |
| `src/appsscript.json` | Apps Script manifest: Asia/Manila time zone, V8 runtime, Gmail API and Drive API advanced services. |
| `tests/` | Node tests that run the real `Code.gs` against a small Google Sheets mock. |

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

## Design

The look was designed in Canva in the style of the **HNS Event Primer 2025**, then rebuilt in code:

- Dashboard mockup: https://canva.link/xsao2f81m0rtfpp
- Email mockup: https://canva.link/x8fk5sd3hbxnsxu

Brand colours and fonts live in `SYSTEM_CONFIG.BRAND`: royal indigo `#1a00ab`, yellow `#fbd23f`, cream `#f6efdc`, Lilita One for titles and Poppins for text.

- **Dialogs:** cream ruled paper with yellow halftone corners, a HUSAY NG SOKSAY wordmark block, page titles on a yellow ribbon, paper cards with thick indigo outlines and yellow label tags, indigo table headers, yellow pill tabs and indigo buttons. Every dialog passes through `withGuideLink_()`, which applies it (`applyAdminBrandTheme_()`, `getAdminBrandCss_()`, `fixLowContrast_()`). Set `SYSTEM_CONFIG.BRAND.ADMIN_THEME` to `"classic"` to get the old dark dialogs back.
- **Emails:** cream page, a card with a thick indigo outline, a yellow status ribbon (for example PAYMENT CONFIRMED), section titles as indigo tags, soft-yellow referral-code boxes and totals on a yellow highlight. Gmail cannot load web fonts, so titles show in Arial Black there.
- **Spreadsheet tabs** keep the original sheet's look (`getOriginalLayout_()`).

## Making changes

- Prices, rules, sheet names, columns and email wording: edit `SYSTEM_CONFIG`.
- Competitions: edit `SYSTEM_CONFIG.COMPETITIONS` (and its price, prefix and submission columns). The Full System Health Check reports any mismatch.
- Menu tools: edit `getAdminMenuDefinition_()` only.
- The look a new build gets: edit `getOriginalLayout_()`.
- Record every change in the **CHANGELOG** in the header of `src/Code.gs` (V1.2, V2.0, …).

## Tests

Requires Node.js 18 or later; no packages to install.

```sh
node tests/run_builder_test.js src/Code.gs   # BUILD BUILD BUILD reproduces the original layout
node tests/run_fix_tests.js src/Code.gs      # behaviour of the V1.1 bug fixes
node tests/run_theme_tests.js src/Code.gs    # the Canva design of dialogs and emails
```

`tests/original_layout.json` holds the original spreadsheet's tab names, header rows, column widths, colours and dropdowns (no participant data). The mock covers only the Apps Script calls these paths use, so test any change in a copy of the real spreadsheet before using it live.
