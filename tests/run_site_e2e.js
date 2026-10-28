// End-to-end: a person registers and submits entries through the website in Chromium; the
// website talks to the real Code.gs (on the mock spreadsheet) through tests/web_test_server.js.
// Checks the rows the website produced and every page for script errors and sideways scrolling.
// usage: node tests/run_site_e2e.js [screenshotDir]
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { start } = require('./web_test_server');

const shotDir = process.argv[2] || '';
let failures = 0, checks = 0;
function ok(label, cond, extra) { checks++; if (!cond) { failures++; console.log('FAIL ' + label + (extra !== undefined ? '\n   ' + JSON.stringify(extra).slice(0, 500) : '')); } }

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const fileOf = (name, buf, mime) => ({ name, mimeType: mime, buffer: buf });

async function shot(page, name) {
  if (!shotDir) return;
  fs.mkdirSync(shotDir, { recursive: true });
  await page.waitForTimeout(400);   // let smooth scrolling finish
  await page.screenshot({ path: path.join(shotDir, name + '.png') });
}

async function newPage(browser, viewport) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 404/.test(m.text())) page.errors.push(m.text()); });
  return page;
}

(async () => {
  const { server, env, port } = await start({ setup: (e) => { e.C.WEBSITE.LIMITS.MIN_FILL_SECONDS = 1; } });
  const base = 'http://localhost:' + port + '/';
  const launch = process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } } : {};
  const browser = await chromium.launch(launch);
  const R = env.C.COLS.REG, SUB = env.C.COLS.SUB;
  const reg = env.ss.getSheetByName('Registration Form');
  const sub = env.ss.getSheetByName('Submission Form');

  // ---- every page: no script errors, no sideways scrolling ----------------------------------
  for (const vp of [{ width: 1280, height: 900 }, { width: 360, height: 780 }, { width: 320, height: 640 }]) {
    const page = await newPage(browser, vp);
    for (const p of ['index', 'about', 'competitions', 'archive', 'faq', 'register', 'submit']) {
      await page.goto(base + p + '.html', { waitUntil: 'networkidle' });
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      ok(p + ' at ' + vp.width + 'px: no sideways scrolling', sw <= vp.width, sw);
    }
    ok('pages at ' + vp.width + 'px: no script errors', page.errors.length === 0, page.errors);
    await page.context().close();
  }

  // ---- home: live status and fee calculator --------------------------------------------------
  {
    const page = await newPage(browser);
    await page.goto(base + 'index.html', { waitUntil: 'networkidle' });
    ok('status bar says registration is open', /registration for the 5th Husay ng SokSay is open/i.test(await page.textContent('#statusbar')));
    await page.goto(base + 'competitions.html#film', { waitUntil: 'networkidle' });
    ok('competitions: #film opens the film tab', await page.isVisible('#film') && !(await page.isVisible('#essay')));
    for (const v of ['ESSAY', 'SPEECH', 'FILM']) await page.click('[data-calc] label.choice:has(input[value="' + v + '"])');
    ok('calculator: 2 + film = ₱899', /₱899/.test(await page.textContent('[data-calc-out]')));
    ok('calculator links to register with the picks', (await page.getAttribute('[data-calc-go]', 'href')) === 'register.html?pick=ESSAY,SPEECH,FILM');
    await page.context().close();
  }

  // ---- registration ------------------------------------------------------------------------------
  const email = 'maria.santos@example.com';
  let genId = '';
  {
    const page = await newPage(browser);
    await page.goto(base + 'register.html?pick=ESSAY,FILM', { waitUntil: 'networkidle' });
    await page.click('#btn-next');
    ok('step 1 refuses missing consents', (await page.locator('.field.has-error').count()) >= 3);
    await page.check('#consentPrivacy');
    await page.check('#consentPledge');
    await page.fill('#email', email);
    await shot(page, 'reg_1');
    await page.click('#btn-next');

    await page.fill('#name', 'Maria Santos');
    await page.click('label.choice:has(input[name="sex"][value="Female"])');
    await page.fill('#age', '17');
    await page.selectOption('#region', 'National Capital Region (NCR)');
    await page.fill('#contact', '0917 555 0101');
    await page.fill('#facebook', 'https://www.facebook.com/maria.santos');
    await page.click('#btn-next');

    await page.fill('#school', 'Quezon City Science High School');
    await page.selectOption('#gradeLevel', 'Grade 12 (SHS)');
    await page.fill('#guardianName', 'Rosa Santos');
    await page.fill('#guardianContact', '0918 555 0102');
    await page.selectOption('#guardianRel', 'Mother');
    await page.click('#btn-next');
    ok('step 3 asks for the uploads', (await page.locator('#up-school.has-error, #up-id.has-error').count()) === 2);
    await page.setInputFiles('#dz-PROOF_OF_SCHOOL', fileOf('school-id.png', PNG, 'image/png'));
    await page.setInputFiles('#dz-VALID_ID', fileOf('valid-id.pdf', PDF, 'application/pdf'));
    await page.waitForSelector('#up-school .dropzone.done');
    await page.waitForSelector('#up-id .dropzone.done');
    await shot(page, 'reg_3');
    await page.click('#btn-next');

    ok('?pick= preselected essay and film', await page.isChecked('#comp-choices input[value="ESSAY"]') && await page.isChecked('#comp-choices input[value="FILM"]'));
    ok('bundle total shown', /₱649/.test(await page.textContent('#total-box-3')));
    await page.fill('#couponCode', 'sok-ana');
    await page.click('[data-check="coupon"]');
    await page.waitForSelector('#couponCode-status.ok');
    ok('coupon lowers the total', /₱624/.test(await page.textContent('#total-box-3')));
    await page.fill('#refCode', 'REF-NOTREAL1');
    await page.click('#btn-next');
    await page.waitForSelector('#refCode-status.bad');
    ok('unknown referral code blocks the step', await page.isVisible('.wiz-panel[data-step="3"].active'));
    await page.fill('#refCode', '');
    await shot(page, 'reg_4');
    await page.click('#btn-next');

    ok('payment accounts listed', /0917 000 1111/.test(await page.textContent('#pay-accounts')));
    await page.click('#pay-accounts .copy >> nth=0');
    ok('copying an account picks its payment mode', await page.isChecked('input[name="payMode"][value="GCash"]'));
    await page.setInputFiles('#dz-PAY_PROOF', fileOf('gcash.png', PNG, 'image/png'));
    await page.setInputFiles('#dz-REG_FORM', fileOf('registration-form.pdf', PDF, 'application/pdf'));
    await page.waitForSelector('#up-pay .dropzone.done');
    await page.waitForSelector('#up-regform .dropzone.done');
    await shot(page, 'reg_5');
    await page.click('#btn-next');

    const review = await page.textContent('#review');
    ok('review shows the answers', /Maria Santos/.test(review) && /BUNDLE A: 1 Competition \+ Film Making/.test(review) && /SOK-ANA/.test(review) && /₱624/.test(review), review.slice(0, 300));
    await shot(page, 'reg_6');
    await page.click('#btn-send');
    await page.waitForSelector('#reg-done:not([hidden])', { timeout: 60000 });
    genId = (await page.textContent('#done-genid')).trim();
    ok('Gen ID shown', /^REF-[A-Z0-9]{8}$/.test(genId), genId);
    ok('fee shown on the success screen', /₱624/.test(await page.textContent('#done-total')));
    await shot(page, 'reg_done');
    ok('registration: no script errors', page.errors.length === 0, page.errors);
    await page.context().close();

    const row = reg.getLastRow();
    const v = reg.getRange(row, 1, 1, reg.getLastColumn()).getValues()[0];
    ok('sheet: email', v[R.EMAIL - 1] === email, v[R.EMAIL - 1]);
    ok('sheet: consent answers', v[2] === env.C.WEBSITE.ANSWERS.PRIVACY_CONSENT && v[3] === env.C.WEBSITE.ANSWERS.PLEDGE);
    ok('sheet: answers as typed', v[R.NAME - 1] === 'Maria Santos' && v[R.SEX - 1] === 'Female' && v[R.AGE - 1] === 17 && v[R.CONTACT - 1] === '0917 555 0101' && v[R.GUARDIAN_REL - 1] === 'Mother', v.slice(4, 14));
    ok('sheet: bundle and competitions', v[R.COMPETITION_COUNT - 1] === 'BUNDLE A: 1 Competition + Film Making (₱649)' && v[R.COMPETITION - 1] === 'Essay Writing Competition, Short Film Making');
    ok('sheet: four uploads as form links', [15, 16, R.PAY_PROOF, R.REG_FORM].every((c) => /^https:\/\/drive\.google\.com\/open\?id=/.test(v[c - 1])));
    ok('sheet: coupon and total', v[R.COUPON_INPUT - 1] === 'SOK-ANA' && v[R.TOTAL_FEE - 1] === 624, [v[R.COUPON_INPUT - 1], v[R.TOTAL_FEE - 1]]);
    ok('sheet: Gen ID matches the page', v[R.GEN_ID - 1] === genId);
  }

  // ---- registration is closed -----------------------------------------------------------------
  {
    env.ctx.saveWebsiteSettings({ siteUrl: 'https://example.github.io/Testing/', registration: { STATUS: 'auto', OPENS: '2099-01-16T08:00', CLOSES: '2099-02-12T23:59' }, submission: { STATUS: 'open' } });
    const page = await newPage(browser);
    await page.goto(base + 'register.html', { waitUntil: 'networkidle' });
    ok('closed: the form is hidden', !(await page.isVisible('#reg-form')) && await page.isVisible('#reg-closed'));
    ok('closed: says when it opens', /opens on January 16, 2099/i.test(await page.textContent('#reg-closed')));
    ok('closed: countdown shown', await page.isVisible('#reg-closed [data-countdown]'));
    await shot(page, 'reg_closed');
    await page.context().close();
    env.ctx.saveWebsiteSettings({ siteUrl: 'https://example.github.io/Testing/', registration: { STATUS: 'open' }, submission: { STATUS: 'open' } });
  }

  // ---- submission ------------------------------------------------------------------------------
  {
    const access = env.ctx.webAccessCode_(email, genId);
    const page = await newPage(browser);
    await page.goto(base + 'submit.html', { waitUntil: 'networkidle' });
    await page.fill('#si-email', email);
    await page.fill('#si-code', 'zzzz9999');
    ok('access code is formatted while typing', (await page.inputValue('#si-code')) === 'ZZZZ-9999');
    await page.click('#signin-form button[type="submit"]');
    await page.waitForSelector('#si-error:not([hidden])');
    ok('wrong code refused', /don't match/.test(await page.textContent('#si-error')));

    // the personal link from the receipt email signs in by itself
    await page.goto(base + 'submit.html#email=' + encodeURIComponent(email) + '&access=' + access, { waitUntil: 'networkidle' });
    await page.waitForSelector('#view-dash:not([hidden])');
    ok('personal link: signed in', /Hi, Maria!/.test(await page.textContent('#dash-hello')));
    ok('personal link: code removed from the address bar', !/access=/.test(page.url()));
    ok('unpaid: submit buttons disabled', await page.isDisabled('[data-open="ESSAY"]') && /haven't confirmed your payment/.test(await page.textContent('#dash-pay')));
    await shot(page, 'sub_unpaid');

    // the Finance team marks the payment
    const fin = env.ss.getSheetByName('Financial Dashboard');
    const fc = env.ctx.ColumnManager.getFinanceCols(fin);
    for (let r = 2; r <= fin.getLastRow(); r++) if (fin.getRange(r, fc.Email).getValue() === email) fin.getRange(r, fc.Status).setValue('PAID');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#view-dash:not([hidden])');
    ok('session kept after reload', /Hi, Maria!/.test(await page.textContent('#dash-hello')));
    ok('paid: essay can be submitted', !(await page.isDisabled('[data-open="ESSAY"]')));
    await shot(page, 'sub_dash');

    await page.click('[data-open="ESSAY"]');
    await page.waitForSelector('#view-entry:not([hidden])');
    ok('entry form prefilled', (await page.inputValue('[data-key="ESSAY_NAME"]')) === 'Maria Santos' && (await page.inputValue('[data-key="ESSAY_SCHOOL"]')) === 'Quezon City Science High School' && (await page.inputValue('[data-key="ESSAY_REGION"]')) === 'National Capital Region (NCR)');
    ok('question text from the form header is not shown raw', !/\(For Essay Writing Competition\)/.test(await page.textContent('#entry-fields')));
    await page.click('#entry-send');
    ok('entry: missing title, file and consents flagged', (await page.locator('#view-entry .field.has-error').count()) >= 4);
    await page.check('#e-privacy');
    await page.check('#e-pledge');
    await page.fill('[data-key="ESSAY_TITLE"]', 'Ang Kwento ng Aming Barangay');
    await page.setInputFiles('#dz-ESSAY_FILE', fileOf('essay.png', PNG, 'image/png'));
    ok('wrong file type refused before uploading', /can't be used here/.test(await page.textContent('#entry-fields')));
    await page.setInputFiles('#dz-ESSAY_FILE', fileOf('essay.pdf', PDF, 'application/pdf'));
    await page.waitForSelector('.dropzone.done');
    await shot(page, 'sub_entry');
    await page.click('#entry-send');
    await page.waitForSelector('#view-done:not([hidden])', { timeout: 60000 });
    const num = (await page.textContent('#done-num')).trim();
    ok('participant number shown', /^ES-\d{4}$/.test(num), num);
    await shot(page, 'sub_done');
    const sv = sub.getRange(sub.getLastRow(), 1, 1, sub.getLastColumn()).getValues()[0];
    ok('sheet: essay row', sv[SUB.EMAIL - 1] === email && sv[SUB.COMPETITION_TYPE - 1] === 'Essay Writing Competition' && sv[SUB.ESSAY_TITLE - 1] === 'Ang Kwento ng Aming Barangay' && sv[41] === 'No', [sv[1], sv[4], sv[19], sv[41]]);

    // the film arrives as a Google Drive link
    await page.click('#done-back');
    ok('essay now marked as submitted', /Submitted/.test(await page.textContent('#dash-comps')));
    await page.click('[data-open="FILM"]');
    await page.waitForSelector('#view-entry:not([hidden])');
    await page.check('#e-privacy');
    await page.check('#e-pledge');
    await page.fill('[data-key="FILM_MEMBERS"]', 'Maria Santos\nJuan Dela Cruz');
    await page.click('label.choice:has(input[data-key="FILM_CONSENT"][value="Yes"])');
    await page.fill('[data-key="FILM_TITLE"]', 'Tahanan');
    await page.fill('[data-key="FILM_ROLES"]', 'Maria Santos – Director\nJuan Dela Cruz – Editor');
    await page.click('#dz-FILM_FILE >> xpath=ancestor::div[contains(@class,"field")]//button[@data-mode="link"]');
    const src = env.drive.makeFile('tahanan.mp4', [0, 0, 0, 24, 102, 116, 121, 112], 'video/mp4', null);
    await page.fill('.link-box input', 'https://drive.google.com/file/d/' + src.id + '/view?usp=sharing');
    await page.click('#entry-send');
    await page.waitForSelector('#view-done:not([hidden])', { timeout: 60000 });
    ok('film participant number', /^FM-\d{4}$/.test((await page.textContent('#done-num')).trim()));
    const fv = sub.getRange(sub.getLastRow(), 1, 1, sub.getLastColumn()).getValues()[0];
    ok('sheet: film row with our copy of the video', fv[SUB.COMPETITION_TYPE - 1] === 'Short Film Competition' && fv[SUB.FILM_CONSENT - 1] === 'Yes' && /^https:\/\/drive\.google\.com\/open\?id=/.test(fv[SUB.FILM_FILE - 1]) && fv[SUB.FILM_FILE - 1].indexOf(src.id) < 0);
    ok('submission: no script errors', page.errors.length === 0, page.errors);
    await page.context().close();
  }

  // ---- phone width: the wizard still works ------------------------------------------------------
  {
    const page = await newPage(browser, { width: 360, height: 780 });
    await page.goto(base + 'register.html', { waitUntil: 'networkidle' });
    await page.click('.nav-toggle');
    ok('phone: menu opens', await page.isVisible('#site-nav a[href="faq.html"]'));
    await page.keyboard.press('Escape');
    ok('phone: Escape closes the menu', !(await page.isVisible('#site-nav a[href="faq.html"]')));
    await shot(page, 'phone_register');
    await page.context().close();
  }

  await browser.close();
  server.close();

  // ---- preview mode (no apiUrl yet) ---------------------------------------------------------------
  const pv = await start({ preview: true });
  const browser2 = await chromium.launch(launch);
  {
    const page = await newPage(browser2);
    await page.goto('http://localhost:' + pv.port + '/register.html', { waitUntil: 'networkidle' });
    ok('preview: banner explains nothing is sent', /Preview mode/.test(await page.textContent('#reg-banner')));
    ok('preview: status bar says so', /Preview/.test(await page.textContent('#statusbar')));
    const rows = pv.env.ss.getSheetByName('Registration Form').getLastRow();
    await page.goto('http://localhost:' + pv.port + '/submit.html', { waitUntil: 'networkidle' });
    await page.fill('#si-email', 'someone@example.com');
    await page.fill('#si-code', 'ABCD2345');
    await page.click('#signin-form button[type="submit"]');
    await page.waitForSelector('#view-dash:not([hidden])');
    ok('preview: sign-in works without the spreadsheet', /Hi, Juan!/.test(await page.textContent('#dash-hello')));
    ok('preview: nothing reached the spreadsheet', pv.env.ss.getSheetByName('Registration Form').getLastRow() === rows);
    ok('preview: no script errors', page.errors.length === 0, page.errors);
    await page.context().close();
  }
  await browser2.close();
  pv.server.close();

  console.log((failures ? failures + ' FAILED' : 'ALL PASSED') + ' (' + checks + ' checks)');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
