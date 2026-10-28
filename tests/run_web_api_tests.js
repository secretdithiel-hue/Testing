// Tests for the website API (PART 26): settings, uploads, registration and submission rows,
// access codes, emails and the Admin Center dialog, run against the real Code.gs.
// usage: node tests/run_web_api_tests.js src/Code.gs
'use strict';
const { makeWebEnv } = require('./web_env');

const codePath = process.argv[2];
let failures = 0, checks = 0;
function ok(label, cond, extra) { checks++; if (!cond) { failures++; console.log('FAIL ' + label + (extra !== undefined ? '\n   ' + JSON.stringify(extra).slice(0, 400) : '')); } }
function eq(label, got, want) { checks++; const a = JSON.stringify(got), b = JSON.stringify(want); if (a !== b) { failures++; console.log('FAIL ' + label + '\n   got:  ' + a + '\n   want: ' + b); } }

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF').toString('base64');
const JPG = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0, 16, 74, 70, 73, 70, 0, 1]).toString('base64');
const SESSION = 'sess_abcdefghijklmnop';
let reqN = 0;
const rid = () => 'req_' + String(++reqN).padStart(4, '0') + '_abcdefghijkl';

function openForms(env, extra) {
  env.ctx.saveWebsiteSettings(Object.assign({
    siteUrl: 'https://example.github.io/Testing/', edition: '5th',
    registration: { STATUS: 'open' }, submission: { STATUS: 'open' },
    paymentMethods: [{ mode: 'GCash', accountName: 'HNS Finance', accountNumber: '0917 000 0000' }],
    dates: [{ label: 'Registration', date: 'January 17 - February 13, 2027' }]
  }, extra || {}));
}
function upload(env, field, data, name, session, form, extra) {
  return env.post(Object.assign({ action: 'upload', session: session || SESSION, form: form || 'registration', field, name: name || field.toLowerCase() + '.pdf', data: data || PDF }, extra || {}));
}
let sesN = 0;
function registration(env, over) {
  const files = {};
  const session = 'sess_reg_' + String(++sesN).padStart(12, '0');
  ['PROOF_OF_SCHOOL', 'VALID_ID', 'PAY_PROOF', 'REG_FORM'].forEach(k => { files[k] = upload(env, k, null, null, session).fileId; });
  return Object.assign({
    action: 'register', requestId: rid(), session, elapsedMs: 95000, website: '',
    answers: {
      email: 'Juan.Dela.Cruz@Example.com', name: 'Juan Dela Cruz', sex: 'Male', age: 16,
      region: 'Region IV - A (CALABARZON)', contact: '09171234567', guardianName: 'Maria Dela Cruz',
      guardianContact: '09181234567', guardianRel: 'Mother', facebook: 'https://facebook.com/juan',
      school: 'Laguna Science High School', gradeLevel: 'Grade 11 (SHS)', adviser: '',
      competitions: ['ESSAY', 'FILM'], payMode: 'GCash', refCode: '', couponCode: 'sok-ana',
      consentPrivacy: true, consentPledge: true
    },
    files
  }, over || {});
}
function regRow(env, row) {
  const sh = env.ss.getSheetByName('Registration Form');
  return sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0];
}

const env = makeWebEnv(codePath, { webAppUrl: 'https://script.google.com/macros/s/ABC/exec' });
const { ctx, ss, C } = env;
const R = C.COLS.REG, SUB = C.COLS.SUB;
const regSheet = ss.getSheetByName('Registration Form');
const subSheet = ss.getSheetByName('Submission Form');
ss.getSheetByName('Coupon Manager').getRange(2, 1, 1, 9).setValues([['SOK-ANA', 25, '2020-01-01', '2099-12-31', 100, 0, 'ACTIVE', 'MEMBER', 'Ana']]);

// ---- 1. config and settings ------------------------------------------------------------
{
  const cfg = env.get({ action: 'config' });
  ok('1: config ok', cfg.ok, cfg);
  eq('1: registration closed by default', [cfg.registration.open, cfg.submission.open], [false, false]);
  eq('1: bundle labels are the form answers', [cfg.pricing.bundleLabels.STD_3_SPC_1, cfg.pricing.bundleLabels.STD_0_SPC_1, cfg.pricing.bundleLabels.STD_2_SPC_0],
    ['ALL IN: All Competitions (₱999)', 'FILM SPECIAL: Film Making Only (₱499)', 'STANDARD B: 2 Competitions (₱499)']);
  eq('1: competitions in form order', cfg.competitions.map(c => c.registrationName),
    ['Essay Writing Competition', 'Speech Competition', 'Mobile Phone Photography Competition', 'Short Film Making']);
  eq('1: film section = form columns 32-41', cfg.submissionForm.FILM.fields.map(f => f.key),
    ['FILM_MEMBERS', 'FILM_REGION', 'FILM_SCHOOL', 'FILM_ADVISER', 'FILM_FACEBOOK', 'FILM_CONTACT', 'FILM_CONSENT', 'FILM_TITLE', 'FILM_ROLES', 'FILM_FILE']);
  eq('1: question text from the sheet header', cfg.submissionForm.ESSAY.fields[6].label, 'TITLE OF ESSAY');
  eq('1: field types', cfg.submissionForm.PHOTO.fields.map(f => f.type), ['text', 'region', 'text', 'text', 'url', 'tel', 'text', 'text', 'file', 'file']);
  ok('1: adviser optional', cfg.submissionForm.SPEECH.fields.filter(f => !f.required).map(f => f.key).join() === 'SPEECH_ADVISER');
  ok('1: contact from the email settings', cfg.contact.email === 'husayngsoksayteam@gmail.com');

  let threw = '';
  try { ctx.saveWebsiteSettings({ registration: { STATUS: 'auto' } }); } catch (e) { threw = e.message; }
  ok('1: automatic without dates refused', /needs an opening or closing date/.test(threw), threw);
  threw = '';
  try { ctx.saveWebsiteSettings({ paymentMethods: [{ mode: 'Bitcoin', accountNumber: '1' }] }); } catch (e) { threw = e.message; }
  ok('1: unknown payment mode refused', /must be one of GCash, Maya, BPI, PNB/.test(threw), threw);
  threw = '';
  try { ctx.saveWebsiteSettings({ siteUrl: 'http://x.com' }); } catch (e) { threw = e.message; }
  ok('1: http site address refused', /https/.test(threw), threw);

  ctx.saveWebsiteSettings({ registration: { STATUS: 'auto', OPENS: '2099-01-17T08:00', CLOSES: '2099-02-13T23:59' }, submission: { STATUS: 'auto', OPENS: '2001-01-01', CLOSES: '2001-02-01' } });
  const c2 = env.get({ action: 'config' });
  eq('1: auto window before opening', [c2.registration.status, c2.registration.open], ['upcoming', false]);
  eq('1: auto window after closing', [c2.submission.status, c2.submission.open], ['ended', false]);
  ctx.saveWebsiteSettings({ registration: { STATUS: 'auto', OPENS: '2001-01-17T08:00', CLOSES: '2099-02-13T23:59' } });
  eq('1: auto window between the dates', env.get({ action: 'config' }).registration.open, true);

  openForms(env);
  const c3 = env.get({ action: 'config' });
  eq('1: saved payment account shown', c3.paymentMethods, [{ mode: 'GCash', accountName: 'HNS Finance', accountNumber: '0917 000 0000' }]);
  eq('1: open after saving', [c3.registration.open, c3.submission.open], [true, true]);
}

// ---- 2. request handling -----------------------------------------------------------------
{
  eq('2: unknown action', env.get({ action: 'nope' }).error, 'unknown_action');
  eq('2: unreadable body', env.post('{not json').error, 'bad_request');
  eq('2: ping', env.get({ action: 'ping' }).ok, true);
  const out = ctx.doGet({ parameter: { action: 'ping' } });
  eq('2: JSON output', out.mime, 'JSON');
}

// ---- 3. codes ---------------------------------------------------------------------------------
{
  const c1 = env.get({ action: 'checkCode', kind: 'coupon', code: 'sok-ana' });
  eq('3: coupon accepted', [c1.valid, c1.discount], [true, 25]);
  const c2 = env.get({ action: 'checkCode', kind: 'coupon', code: 'NOPE' });
  eq('3: unknown coupon', c2.valid, false);
  const c3 = env.get({ action: 'checkCode', kind: 'referral', code: 'REF-ZZZZZZZZ' });
  eq('3: unknown referral', c3.valid, false);
}

// ---- 4. uploads -------------------------------------------------------------------------------
{
  eq('4: bad session', env.post({ action: 'upload', session: 'x', name: 'a.pdf', data: PDF }).error, 'bad_request');
  eq('4: bad extension', upload(env, 'VALID_ID', PDF, 'virus.exe').error, 'bad_type');
  eq('4: content must match the extension', upload(env, 'VALID_ID', PDF, 'id.jpg').error, 'bad_type');
  const good = upload(env, 'VALID_ID', JPG, 'id.jpg');
  ok('4: image uploaded', good.ok && /^id/.test(good.fileId), good);
  const f = env.drive.files.get(good.fileId);
  ok('4: stored in the uploads folder', f && f.folder && f.folder.name === 'Registrations' && /Session sess_abcdefghijklmnop,/.test(f.description), f && f.description);
  eq('4: too large refused unread', env.post(JSON.stringify({ action: 'upload', data: 'A'.repeat(C.WEBSITE.UPLOADS.MAX_FILE_MB * 1024 * 1024 * 1.5) })).error, 'too_large');
  eq('4: no videos with the registration documents', upload(env, 'VALID_ID', PDF, 'clip.mp4').error, 'bad_type');
  const big = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc((C.WEBSITE.UPLOADS.REGISTRATION_MAX_FILE_MB + 1) * 1024 * 1024)]).toString('base64');
  eq('4: registration documents have their own size limit', upload(env, 'VALID_ID', big, 'big.pdf').error, 'too_large');
  eq('4: entry files need a sign-in', upload(env, 'ESSAY_FILE', PDF, 'essay.pdf', SESSION, 'submission').error, 'not_found');
  const keep = C.WEBSITE.UPLOADS.REGISTRATION_MB_PER_DAY;
  C.WEBSITE.UPLOADS.REGISTRATION_MB_PER_DAY = 0.00001;
  eq('4: daily budget for registration uploads', upload(env, 'VALID_ID', JPG, 'id2.jpg').error, 'busy');
  C.WEBSITE.UPLOADS.REGISTRATION_MB_PER_DAY = keep;
}

// ---- 5. registration ----------------------------------------------------------------------
let first;
{
  eq('5: honeypot', env.post(registration(env, { website: 'http://spam' })).error, 'rejected');
  eq('5: too fast', env.post(registration(env, { elapsedMs: 3000 })).error, 'rejected');
  const bad = registration(env);
  bad.answers = Object.assign({}, bad.answers, { sex: 'Other', contact: 'call me', competitions: [], consentPledge: false });
  const badRes = env.post(bad);
  eq('5: invalid fields listed', Object.keys(badRes.fields || {}).sort(), ['competitions', 'consentPledge', 'contact', 'sex']);
  const stolen = registration(env, { session: 'sess_someoneelse12345' });
  eq('5: files from another page refused', Object.keys(env.post(stolen).fields || {}).sort(), ['PAY_PROOF', 'PROOF_OF_SCHOOL', 'REG_FORM', 'VALID_ID']);

  const req = registration(env);
  const before = regSheet.getLastRow();
  first = env.post(req);
  ok('5: registered', first.ok, first);
  const row = regSheet.getLastRow();
  eq('5: one new row', row, before + 1);
  const v = regRow(env, row);
  eq('5: consent answers', [v[2], v[3]], [C.WEBSITE.ANSWERS.PRIVACY_CONSENT, C.WEBSITE.ANSWERS.PLEDGE]);
  eq('5: email as typed (lower-case)', v[R.EMAIL - 1], 'juan.dela.cruz@example.com');
  eq('5: phone keeps its leading zero', [v[R.CONTACT - 1], v[R.GUARDIAN_CONTACT - 1]], ['09171234567', '09181234567']);
  eq('5: bundle answer', v[R.COMPETITION_COUNT - 1], 'BUNDLE A: 1 Competition + Film Making (₱649)');
  eq('5: competitions answer', v[R.COMPETITION - 1], 'Essay Writing Competition, Short Film Making');
  ok('5: uploads as form links', [15, 16, R.PAY_PROOF, R.REG_FORM].every(c => /^https:\/\/drive\.google\.com\/open\?id=id/.test(v[c - 1])), [v[14], v[15], v[21], v[22]]);
  ok('5: Gen ID made by the form processing', /^REF-[A-Z0-9]{8}$/.test(v[R.GEN_ID - 1]) && v[R.GEN_ID - 1] === first.genId, v[R.GEN_ID - 1]);
  eq('5: total = bundle - coupon', [first.total, v[R.TOTAL_FEE - 1], first.breakdown.coupon], [624, 624, 25]);
  const hm = env.ctx.ColumnManager.headerMap(regSheet);
  eq('5: SYS_SOURCE after column 60', hm.SYS_SOURCE, 61);
  ok('5: marked as a website row', /^Website [0-9a-f-]{36}$/.test(v[hm.SYS_SOURCE - 1]));
  ok('5: coupon claimed', ss.getSheetByName('Coupon Manager').getRange(2, 6).getValue() === 1);
  const fin = ss.getSheetByName('Financial Dashboard');
  const finCols = ctx.ColumnManager.getFinanceCols(fin);
  ok('5: Finance row added', fin.getRange(2, finCols.Email).getValue() === 'juan.dela.cruz@example.com' && Number(fin.getRange(2, finCols.TotalAmount).getValue()) === 624);
  ok('5: confirmation email sent', env.mails.some(m => m.to === 'juan.dela.cruz@example.com' && /Registration Received/.test(m.subject)), env.mails.map(m => m.subject));

  const again = env.post(req);
  eq('5: retried request gets the first answer', again.genId, first.genId);
  eq('5: no second row for the retry', regSheet.getLastRow(), row);
  const dup = env.post(registration(env));
  eq('5: same email refused', dup.error, 'duplicate');

  // formula-looking answers are stored as text
  const tricky = registration(env);
  tricky.answers = Object.assign({}, tricky.answers, { email: 'ana@example.com', name: '=IMPORTXML("http://x","//a")', refCode: first.genId.toLowerCase(), couponCode: '' });
  const t = env.post(tricky);
  ok('5: second registration', t.ok, t);
  const tr = regSheet.getLastRow();
  eq('5: formula text not run', [regSheet.getRange(tr, R.NAME).getValue(), regSheet.getRange(tr, R.NAME).getFormula()], ['=IMPORTXML("http://x","//a")', '']);
  eq('5: referral discount', [t.total, t.breakdown.referral], [649 - 50, 50]);

  ctx.saveWebsiteSettings({ registration: { STATUS: 'closed' }, submission: { STATUS: 'open' }, siteUrl: 'https://example.github.io/Testing/' });
  eq('5: closed form refuses', env.post(registration(env)).error, 'closed');
  openForms(env);
}

// ---- 6. access code, sign-in, receipt email ---------------------------------------------------
const email = 'juan.dela.cruz@example.com';
const code = ctx.webAccessCode_(email, first.genId);
{
  ok('6: access code format', /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/.test(code), code);
  eq('6: same code every time', ctx.webAccessCode_(' JUAN.dela.cruz@example.com ', first.genId.toLowerCase()), code);
  ok('6: another person gets another code', ctx.webAccessCode_('ana@example.com', first.genId) !== code);
  eq('6: wrong code', env.post({ action: 'lookup', email, access: 'AAAA-AAAA' }).error, 'not_found');
  const me = env.post({ action: 'lookup', email: email.toUpperCase(), access: code.toLowerCase().replace('-', ' ') });
  ok('6: signed in', me.ok, me);
  eq('6: my competitions', me.competitions.map(c => [c.key, c.submitted]), [['ESSAY', false], ['FILM', false]]);
  eq('6: not paid yet', me.paid, false);
  eq('6: prefill', [me.prefill.name, me.prefill.school, me.prefill.contact], ['Juan Dela Cruz', 'Laguna Science High School', '09171234567']);

  const html = ctx.EmailBuilder.buildReceiptHtml({ name: 'Juan', genId: first.genId, competitions: 'Essay Writing Competition', finalAmount: 349 }, false, { recipient: email });
  ok('6: receipt has the access code', html.indexOf(code) >= 0);
  ok('6: receipt links the personal page', html.indexOf('https://example.github.io/Testing/submit.html#email=' + encodeURIComponent(email) + '&amp;access=' + code) >= 0);
  const prev = ctx.EmailBuilder.buildReceiptHtml({ name: 'Juan', genId: 'REF-12345678', competitions: 'Essay Writing Competition', finalAmount: 349 }, false, { preview: true });
  ok('6: preview shows a sample code', prev.indexOf('ABCD-2345') >= 0);
  ctx.saveWebsiteSettings({ registration: { STATUS: 'open' }, submission: { STATUS: 'open' }, siteUrl: '' });
  ok('6: no website box without a site address', ctx.EmailBuilder.buildReceiptHtml({ name: 'Juan', genId: first.genId, competitions: 'Essay Writing Competition', finalAmount: 349 }, false, { recipient: email }).indexOf(code) < 0);
  openForms(env);

  const n = env.mails.length;
  const r1 = env.post({ action: 'resendAccess', email: 'nobody@example.com' });
  ok('6: unknown email gets the same answer', r1.ok && env.mails.length === n);
  const r2 = env.post({ action: 'resendAccess', email });
  ok('6: code emailed', r2.ok && env.mails.length === n + 1 && env.mails[n].html.indexOf(code) >= 0 && /haven't confirmed your payment/.test(env.mails[n].html));
}

// ---- 7. submission --------------------------------------------------------------------------
{
  eq('7: unpaid participants cannot upload entries', upload(env, 'ESSAY_FILE', PDF, 'my essay.pdf', 'sess_submit_0000000001', 'submission', { email, access: code }).error, 'unpaid');
  regSheet.getRange(regSheet.getLastRow() - 1, R.PAYMENT_STATUS).setValue('PAID');
  const fin0 = ss.getSheetByName('Financial Dashboard');
  fin0.getRange(2, ctx.ColumnManager.getFinanceCols(fin0).Status).setValue('PAID');
  const essayFile = upload(env, 'ESSAY_FILE', PDF, 'my essay.pdf', 'sess_submit_0000000001', 'submission', { email, access: code }).fileId;
  ok('7: entry file uploaded after signing in', /^id/.test(essayFile));
  regSheet.getRange(regSheet.getLastRow() - 1, R.PAYMENT_STATUS).setValue('');
  fin0.getRange(2, ctx.ColumnManager.getFinanceCols(fin0).Status).setValue('NOT YET PAID');
  const essay = {
    action: 'submit', requestId: rid(), session: 'sess_submit_0000000001', elapsedMs: 60000, website: '',
    email, access: code, competition: 'ESSAY', consentPrivacy: true, consentPledge: true,
    answers: { ESSAY_NAME: 'Juan Dela Cruz', ESSAY_REGION: 'Region IV - A (CALABARZON)', ESSAY_SCHOOL: 'Laguna Science High School',
      ESSAY_ADVISER: '', ESSAY_FACEBOOK: 'https://facebook.com/juan', ESSAY_CONTACT: '09171234567', ESSAY_TITLE: 'Mga Kwentong Buhay' },
    files: { ESSAY_FILE: essayFile }
  };
  eq('7: unpaid refused', env.post(essay).error, 'unpaid');
  regSheet.getRange(regSheet.getLastRow() - 1, R.PAYMENT_STATUS).setValue('PAID');
  const fin = ss.getSheetByName('Financial Dashboard');
  const finCols = ctx.ColumnManager.getFinanceCols(fin);
  fin.getRange(2, finCols.Status).setValue('PAID');
  eq('7: not registered for that competition', env.post(Object.assign({}, essay, { requestId: rid(), competition: 'SPEECH' })).error, 'invalid');
  const missing = env.post(Object.assign({}, essay, { requestId: rid(), answers: Object.assign({}, essay.answers, { ESSAY_TITLE: '' }) }));
  eq('7: missing answer listed', Object.keys(missing.fields || {}), ['ESSAY_TITLE']);

  const pdfDoc = env.drive.makeFile('essay.pdf', [37, 80, 68, 70], 'application/pdf', null);
  const viaLink = env.post(Object.assign({}, essay, { requestId: rid(), files: {}, links: { ESSAY_FILE: 'https://drive.google.com/file/d/' + pdfDoc.id + '/view' } }));
  ok('7: only video questions take links', /Upload this file instead/.test((viaLink.fields || {}).ESSAY_FILE || ''), viaLink);

  const before = subSheet.getLastRow();
  const res = env.post(essay);
  ok('7: entry submitted', res.ok, res);
  const r = subSheet.getLastRow();
  eq('7: one new row', r, before + 1);
  const v = subSheet.getRange(r, 1, 1, subSheet.getLastColumn()).getValues()[0];
  eq('7: competition answer', v[SUB.COMPETITION_TYPE - 1], 'Essay Writing Competition');
  eq('7: essay section filled', [v[SUB.ESSAY_NAME - 1], v[SUB.ESSAY_TITLE - 1], v[SUB.ESSAY_CONTACT - 1]], ['Juan Dela Cruz', 'Mga Kwentong Buhay', '09171234567']);
  eq('7: file as form link', v[SUB.ESSAY_FILE - 1], 'https://drive.google.com/open?id=' + essayFile);
  eq('7: "submit another" answered', v[41], 'No');
  ok('7: other sections empty', !v[SUB.SPEECH_NAME - 1] && !v[SUB.FILM_MEMBERS - 1]);
  const sys = ctx.ColumnManager.ensureSysColsOnSubmissions(subSheet);
  ok('7: participant number from the form processing', /^ES-\d{4}$/.test(res.participantNumber) && v[sys.SYS_PARTICIPANT_NUM - 1] === res.participantNumber, [res.participantNumber, v[sys.SYS_PARTICIPANT_NUM - 1]]);
  eq('7: SYS_SOURCE after the system columns', ctx.ColumnManager.headerMap(subSheet).SYS_SOURCE, 53);
  eq('7: second entry for the same competition refused', env.post(Object.assign({}, essay, { requestId: rid() })).error, 'duplicate');
  eq('7: shown as submitted', env.post({ action: 'lookup', email, access: code }).competitions.map(c => c.submitted), [true, false]);

  // the short film comes as a Google Drive link and is copied
  const src = env.drive.makeFile('our film.mp4', [0, 0, 0, 24, 102, 116, 121, 112], 'video/mp4', null);
  const film = {
    action: 'submit', requestId: rid(), session: 'sess_submit_0000000001', elapsedMs: 60000, website: '',
    email, access: code, competition: 'FILM', consentPrivacy: true, consentPledge: true,
    answers: { FILM_MEMBERS: 'Juan Dela Cruz\nAna Santos', FILM_REGION: 'Region IV - A (CALABARZON)', FILM_SCHOOL: 'Laguna Science High School',
      FILM_ADVISER: 'Mr. Reyes', FILM_FACEBOOK: 'https://facebook.com/juan', FILM_CONTACT: '09171234567', FILM_CONSENT: 'Yes',
      FILM_TITLE: 'Balangkas', FILM_ROLES: 'Juan - director\nAna - editor' },
    links: { FILM_FILE: 'https://example.com/video' }
  };
  eq('7: non-Drive link refused', Object.keys(env.post(film).fields || {}), ['FILM_FILE']);
  const doc = env.drive.makeFile('script.pdf', [37, 80, 68, 70], 'application/pdf', null);
  film.requestId = rid();
  film.links = { FILM_FILE: 'https://drive.google.com/file/d/' + doc.id + '/view' };
  ok('7: a linked file must be a video', /not a video/.test((env.post(film).fields || {}).FILM_FILE || ''));

  film.requestId = rid();
  film.links = { FILM_FILE: 'https://drive.google.com/file/d/' + src.id + '/view?usp=sharing' };
  const fr = env.post(film);
  ok('7: film submitted', fr.ok, fr);
  const fv = subSheet.getRange(subSheet.getLastRow(), 1, 1, subSheet.getLastColumn()).getValues()[0];
  const copyId = (fv[SUB.FILM_FILE - 1].match(/id=(.+)$/) || [])[1];
  ok('7: our own copy of the film', copyId && copyId !== src.id && env.drive.files.get(copyId).folder.name === 'Submissions');
  eq('7: consent answer', fv[SUB.FILM_CONSENT - 1], 'Yes');
  ok('7: submission email sent', env.mails.some(m => m.to === email && /ES-\d{4}/.test(m.html)));
}

// ---- 7b. guessing access codes locks the email for a while --------------------------------------
{
  const victim = 'ana@example.com';
  for (let i = 0; i < C.WEBSITE.LIMITS.SIGN_IN_TRIES_PER_10_MIN; i++) env.post({ action: 'lookup', email: victim, access: 'WRNG-' + String(1000 + i) });
  const victimRow = new ctx.SheetRepository().findRegistrationRowIndexByEmail(victim);
  const right = ctx.webAccessCode_(victim, regSheet.getRange(victimRow, R.GEN_ID).getValue());
  eq('7b: locked after too many wrong codes', env.post({ action: 'lookup', email: victim, access: right }).error, 'busy');
  eq('7b: other emails are not affected', env.post({ action: 'lookup', email, access: code }).ok, true);
}

// ---- 8. busy lock: nothing is written --------------------------------------------------------
{
  env.lock.free = false;
  const before = regSheet.getLastRow();
  const req = registration(env);
  req.answers = Object.assign({}, req.answers, { email: 'busy@example.com', couponCode: '' });
  eq('8: busy answer', env.post(req).error, 'busy');
  eq('8: nothing written', regSheet.getLastRow(), before);
  env.lock.free = true;
  ok('8: same request works later', env.post(req).ok);
  const keep = C.WEBSITE.LIMITS.REGISTRATIONS_PER_HOUR;
  C.WEBSITE.LIMITS.REGISTRATIONS_PER_HOUR = 0;
  const req2 = registration(env);
  req2.answers = Object.assign({}, req2.answers, { email: 'late@example.com', couponCode: '' });
  eq('8: hourly cap on website registrations', env.post(req2).error, 'busy');
  C.WEBSITE.LIMITS.REGISTRATIONS_PER_HOUR = keep;
}

// ---- 9. admin dialog, menu, clean-up --------------------------------------------------------
{
  ctx.openWebsiteSettings();
  const d = env.shown[env.shown.length - 1];
  ok('9: dialog opens', d && /Website &amp; Online Forms|Website & Online Forms/.test(d.html) && /class="ui-brand"/.test(d.html));
  ok('9: dialog shows the web app address', d.html.indexOf('https://script.google.com/macros/s/ABC/exec') >= 0);
  ok('9: dialog counts website rows', /<div class="n">3<\/div><div class="l">Registrations from the website/.test(d.html) && /<div class="n">2<\/div><div class="l">Entries from the website/.test(d.html));
  ok('9: in the Admin Center menu', ctx.flattenAdminMenu_(ctx.getAdminMenuDefinition_()).some(i => i.fn === 'openWebsiteSettings'));

  const regFolder = ctx.getWebUploadsFolder_('registration');
  const orphan = env.drive.makeFile('left behind.pdf', [37], 'application/pdf', env.drive.folders.get(regFolder.getId()));
  orphan.created = new Date(Date.now() - 3 * 86400000);
  const usedId = (regRow(env, 2)[R.PAY_PROOF - 1].match(/id=(.+)$/) || [])[1];
  env.drive.files.get(usedId).created = new Date(Date.now() - 3 * 86400000);
  const out = ctx.webCleanupUploads();
  ok('9: unused upload trashed', orphan.trashed && out.trashed >= 1, out);
  ok('9: used upload kept', !env.drive.files.get(usedId).trashed);
}

// ---- 10. the website's built-in copy of the settings is up to date ---------------------------------
{
  const fs = require('fs');
  const path = require('path');
  const { siteDefaults, render } = require('../tools/export_site_defaults');
  const file = path.join(__dirname, '../site/assets/js/defaults.js');
  ok('10: site/assets/js/defaults.js matches Code.gs (run node tools/export_site_defaults.js)', fs.readFileSync(file, 'utf8') === render(siteDefaults(codePath)));
}

console.log((failures ? failures + ' FAILED' : 'ALL PASSED') + ' (' + checks + ' checks)');
process.exit(failures ? 1 : 0);
