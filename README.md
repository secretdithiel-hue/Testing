# Husay ng Soksay — Automated Registration System

A Google Apps Script system that runs the UPLB Sociology Society's **Husay ng Soksay** inter-high school social science competition from one Google Sheet. It automates registration, fees, payment receipts, referrals, discount codes, anonymous judging and announcements, all managed from one **Admin Center** menu.

**Current version:** V1.0 (baseline release, October 2026)

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
| `src/Code.gs` | The whole system (one script file). Settings live in `SYSTEM_CONFIG` near the top. |
| `src/appsscript.json` | Apps Script manifest: Asia/Manila time zone, V8 runtime, Gmail API and Drive API advanced services. |

The git history keeps the version before the V1.0 relabel as the first commit, so `git diff` against it shows what V1.0 changed.

## Setup

1. Open the competition's Google Sheet → **Extensions → Apps Script**.
2. Replace the contents of `Code.gs` with `src/Code.gs` from this repo.
3. Under **Services**, add the **Gmail API** and the **Drive API** (or copy `src/appsscript.json` into the project's manifest under **Project Settings → Show "appsscript.json"**).
4. Save, reload the Sheet, and open the **Admin Center** menu. Run `createTriggers` from there (also a button in the System Dashboard) to install the `onFormSubmit` and `onEdit` triggers, then run a health check.

To push from this repo with [clasp](https://github.com/google/clasp) instead, run `clasp clone <scriptId> --rootDir src` once, then `clasp push`.

## Making changes

- Prices, rules, sheet names, columns and email wording: edit `SYSTEM_CONFIG`.
- Competitions: edit `SYSTEM_CONFIG.COMPETITIONS` (and its price, prefix and submission columns). The Full System Health Check reports any mismatch.
- Menu tools: edit `getAdminMenuDefinition_()` only.
- Record every change in the **CHANGELOG** in the header of `src/Code.gs` (V1.1, V1.2, V2.0, …).
