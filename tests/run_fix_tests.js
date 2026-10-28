// Behaviour tests for the bug fixes, run against the real Code.gs with the mock.
'use strict';
const fs = require('fs');
const vm = require('vm');
const { makeGlobals, Sheet } = require('./mock_gas');

const code = fs.readFileSync(process.argv[2], 'utf8').replace(/\r\n/g, '\n');
let failures = 0, checks = 0;
function eq(label, got, want) { checks++; const a = JSON.stringify(got), b = JSON.stringify(want); if (a !== b) { failures++; console.log('FAIL ' + label + '\n   got:  ' + a + '\n   want: ' + b); } }
function ok(label, cond) { checks++; if (!cond) { failures++; console.log('FAIL ' + label); } }

function load(setup) {
  const g = makeGlobals();
  if (setup) setup(g);
  const ctx = vm.createContext(Object.assign({}, g));
  vm.runInContext(code, ctx, { filename: 'Code.gs' });
  ctx.__g = g;
  return ctx;
}
function logs(ctx) { const sh = ctx.__g.__ss.getSheetByName('System Logs'); return sh ? sh.getDataRange().getValues().map(r => r.join(' | ')).join('\n') : ''; }
function built() { const ctx = load(); ctx.__g.__ss.sheets.push(new Sheet(ctx.__g.__ss, 'Sheet1')); ctx.buildEntireSystem(); return ctx; }

// 1. A response on a tab that is neither form sheet is not processed as a registration
{
  const ctx = built();
  const ss = ctx.__g.__ss;
  const stray = ss.insertSheet('Form Responses 3');
  let handled = 0;
  ctx.handleSubmission = () => { handled++; };
  ctx.handleSubmissionFormResponse2 = () => { handled++; };
  ctx.onFormSubmit({ range: stray.getRange(2, 1) });
  eq('1: stray form tab not processed', handled, 0);
  ok('1: stray form tab logged', /FORM_SHEET_UNKNOWN/.test(logs(ctx)));
  ctx.onFormSubmit({ range: ss.getSheetByName('Registration Form').getRange(2, 1) });
  eq('1: registration still processed', handled, 1);
}

// 2. Lock timeout: the response gets a visible note instead of vanishing
{
  const ctx = load(g => { g.LockService.getScriptLock = () => ({ waitLock() { throw new Error('timeout'); }, releaseLock() {} }); });
  const ss = ctx.__g.__ss;
  ss.sheets.push(new Sheet(ss, 'Sheet1'));
  ctx.buildEntireSystem();
  const reg = ss.getSheetByName('Registration Form');
  ctx.onFormSubmit({ range: reg.getRange(2, 1) });
  ok('2: busy note on registration row', /^⚠️ NOT PROCESSED: .*Force Reprocess/.test(reg.getRange(2, 1).getNote()));
  const fin = ss.getSheetByName('Financial Dashboard');
  ctx.onEdit({ range: fin.getRange(2, 12), authMode: 'FULL' });
  ok('2: busy note on edited cell', /^⚠️ NOT PROCESSED: /.test(fin.getRange(2, 12).getNote()));
}

// 3. Simple-trigger run warns when the installable trigger has never run; edits starting on
//    the header row are no longer ignored
{
  const ctx = load();
  const ss = ctx.__g.__ss;
  ss.sheets.push(new Sheet(ss, 'Sheet1'));
  ss.insertSheet('Registration Form'); ss.insertSheet('Financial Dashboard');
  const fin = ss.getSheetByName('Financial Dashboard');
  ctx.onEdit({ range: fin.getRange(2, 12), authMode: 'LIMITED' });
  eq('3: toast when triggers missing', ss.toasts.length, 1);
  ctx.__g.__docProps.set('HNS_EDIT_TRIGGER_SEEN', '1');
  ctx.onEdit({ range: fin.getRange(2, 12), authMode: 'LIMITED' });
  eq('3: no toast once installed', ss.toasts.length, 1);

  let processed = 0;
  ctx.processEdit_ = () => { processed++; };
  ctx.onEdit({ range: fin.getRange(1, 12, 50, 1), authMode: 'FULL' });
  eq('3: block starting on header row processed', processed, 1);
  ctx.onEdit({ range: fin.getRange(1, 12), authMode: 'FULL' });
  eq('3: header-only edit still ignored', processed, 1);
}

// 4. Coupon value does not depend on the coupon still being ACTIVE
{
  const ctx = built();
  const cs = ctx.__g.__ss.getSheetByName('Coupon Manager');
  cs.getRange(2, 1, 1, 9).setValues([['SOK-ANA', 25, '2026-01-01', '2026-12-31', 100, 3, 'INACTIVE', 'MEMBER', 'Ana']]);
  const svc = new ctx.CouponService(cs, { lazyLoad: true });
  eq('4: inactive coupon value', svc.getValueOnly('sok-ana '), 25);
  eq('4: matches the shared lookup', ctx.getCouponValue_('SOK-ANA'), 25);
  eq('4: unknown code', svc.getValueOnly('NOPE'), 0);
}

// 5. Scheduled announcements: one draft per run, the rest stays stored for the next trigger
{
  const ctx = built();
  const props = ctx.__g.__scriptProps;
  const past = new Date(Date.now() - 60000).toISOString();
  props.set('ANNOUNCEMENT_SCHEDULED_SENDS', JSON.stringify([
    { id: 'a', subject: 'A', body: 'x', category: 'general', sendAt: past, filters: {} },
    { id: 'b', subject: 'B', body: 'y', category: 'general', sendAt: past, filters: {} }]));
  const sent = [];
  ctx.sendScheduledAnnouncementDraft_ = (d) => sent.push(d.id);
  const before = ctx.__g.__triggers.length;
  ctx.processScheduledAnnouncement({});
  eq('5: one draft sent per run', sent, ['a']);
  eq('5: other draft still stored', JSON.parse(props.get('ANNOUNCEMENT_SCHEDULED_SENDS')).map(d => d.id), ['b']);
  eq('5: follow-up trigger created', ctx.__g.__triggers.length - before, 1);
  ctx.processScheduledAnnouncement({});
  eq('5: next run sends the second', sent, ['a', 'b']);
  eq('5: storage empty', JSON.parse(props.get('ANNOUNCEMENT_SCHEDULED_SENDS')), []);
}

// 6. Failed-recipient queue: same announcement merges, the queue's own retry replaces
{
  const ctx = built();
  const props = ctx.__g.__scriptProps;
  const base = { category: 'general', subject: 'S', body: 'B', signoff: '' };
  ctx.saveFailedAnnouncementRecipients(Object.assign({}, base, { recipients: [{ email: 'a@x' }, { email: 'b@x' }] }));
  ctx.saveFailedAnnouncementRecipients(Object.assign({}, base, { recipients: [{ email: 'B@x' }, { email: 'c@x' }] }));
  eq('6: merged without duplicates', JSON.parse(props.get('ANNOUNCE_FAILED_QUEUE')).recipients.map(r => r.email), ['a@x', 'b@x', 'c@x']);
  ctx.saveFailedAnnouncementRecipients(Object.assign({}, base, { recipients: [{ email: 'c@x' }], replace: true }));
  eq('6: retry run replaces', JSON.parse(props.get('ANNOUNCE_FAILED_QUEUE')).recipients.map(r => r.email), ['c@x']);
  ctx.saveFailedAnnouncementRecipients({ category: 'general', subject: 'Other', body: 'Z', signoff: '', recipients: [{ email: 'd@x' }] });
  ok('6: replacing another announcement is logged', /ANNOUNCE_QUEUE_REPLACED/.test(logs(ctx)));
}

// 7. A paid date typed into Registration runs the full PAID flow
{
  const ctx = built();
  const ss = ctx.__g.__ss;
  const reg = ss.getSheetByName('Registration Form');
  const fin = ss.getSheetByName('Financial Dashboard');
  reg.getRange(2, 2).setValue('pat@example.com');
  fin.getRange(2, 2).setValue('pat@example.com');
  fin.getRange(2, 12).setValue('NOT YET PAID');
  const calls = [];
  ctx.handleFinanceEditSync = (e, sys, cols, header) => calls.push([e.range.getRow(), e.range.getColumn(), e.oldValue, header]);
  const finCols = ctx.ColumnManager.getFinanceCols(fin);
  reg.getRange(2, 26).setValue('2026-10-26 10:00');
  ctx.handleRegistrationPaidAtEditSync({ range: reg.getRange(2, 26) }, finCols);
  eq('7: Finance status set to PAID', fin.getRange(2, 12).getValue(), 'PAID');
  eq('7: PAID flow ran once for the Finance status cell', calls, [[2, 12, 'NOT YET PAID', 'Status']]);
  ctx.handleRegistrationPaidAtEditSync({ range: reg.getRange(2, 26) }, finCols);
  eq('7: not run again when already PAID', calls.length, 1);
}

// 8. Repair Form Link never moves submission answers into Registration
{
  const ctx = built();
  const ss = ctx.__g.__ss;
  const sub = new Sheet(ss, 'Form Responses 2', { formUrl: 'https://docs.google.com/forms/d/SUB/viewform', cols: 42 });
  sub.getRange(1, 1, 1, 6).setValues([['Timestamp', 'Email Address', 'x', 'y', 'Please specify the competition to which you intend to submit an entry.', 'FULL NAME OF PARTICIPANT  (For Speech Competition)']]);
  sub.getRange(2, 1, 1, 2).setValues([['t', 'kid@example.com']]);
  ss.sheets.push(sub);
  ctx.repairFormLink();
  ok('8: submission tab kept', !!ss.getSheetByName('Form Responses 2'));
  eq('8: registration untouched', ss.getSheetByName('Registration Form').getLastRow(), 1);
}

console.log((failures ? failures + ' FAILED' : 'ALL PASSED') + ' (' + checks + ' checks)');
process.exit(failures ? 1 : 0);
