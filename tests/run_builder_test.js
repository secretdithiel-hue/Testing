// Runs buildEntireSystem() from the real Code.gs against the mock and compares the result
// with the layout read from the original spreadsheet.
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { makeGlobals, Sheet } = require('./mock_gas');

const codePath = process.argv[2];
const original = JSON.parse(fs.readFileSync(path.join(__dirname, 'original_layout.json'), 'utf8'));
const code = fs.readFileSync(codePath, 'utf8').replace(/\r\n/g, '\n');

let failures = 0, checks = 0;
function eq(label, got, want) {
  checks++;
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a !== b) { failures++; console.log('FAIL ' + label + '\n   got:  ' + a.slice(0, 400) + '\n   want: ' + b.slice(0, 400)); }
}
function ok(label, cond) { checks++; if (!cond) { failures++; console.log('FAIL ' + label); } }

function load() {
  const g = makeGlobals();
  const ctx = vm.createContext(Object.assign({}, g));
  vm.runInContext(code, ctx, { filename: 'Code.gs' });
  return { ctx, ss: g.__ss, triggers: g.__triggers, docProps: g.__docProps };
}
function headers(sh) { const n = sh.getLastColumn(); return n ? sh.getRange(1, 1, 1, n).getValues()[0].map(v => String(v)) : []; }
function widths(sh, n) { const out = []; for (let c = 1; c <= n; c++) out.push(sh.widths.get(c)); return out; }

function checkFullLayout(label, ss) {
  const visible = ss.getSheets().map(s => s.getName());
  eq(label + ': tab order', visible, original.tabs);
  eq(label + ': hidden tabs', ss.getSheets().filter(s => s.hidden).map(s => s.getName()), original.hidden);
  for (const name of ['Registration Form', 'Financial Dashboard', 'Submission Form', 'Coupon Manager', 'Essay Writing', 'Speech', 'Mobile Phone Photography', 'Short-Film', 'Admin Audit Log', 'Merge Ledger']) {
    eq(label + ': headers of ' + name, headers(ss.getSheetByName(name)), original[name]);
  }
  eq(label + ': Participant Database QUERY', ss.getSheetByName('Participant Database').getRange('A1').getFormula(), original['Participant Database formula']);
  for (const [name, n] of Object.entries(original.columnCount)) eq(label + ': column count of ' + name, ss.getSheetByName(name).getMaxColumns(), n);
  for (const [name, n] of Object.entries(original.frozen)) eq(label + ': frozen rows of ' + name, ss.getSheetByName(name).getFrozenRows(), n);
  for (const [name, w] of Object.entries(original.widths)) eq(label + ': widths of ' + name, widths(ss.getSheetByName(name), w.length), w);
  for (const [name, bg] of Object.entries(original.headerBg)) eq(label + ': header colour of ' + name, (ss.getSheetByName(name).fmt.get('1,1') || {}).bg, bg);
  for (const [name, cols] of Object.entries(original.validation)) {
    for (const [col, list] of Object.entries(cols)) {
      const rule = ss.getSheetByName(name).validation.get('2,' + col);
      eq(label + ': dropdown ' + name + ' col ' + col, rule && rule.list, list);
    }
  }
  eq(label + ': time zone', ss.tz, 'Asia/Manila');
  eq(label + ': locale', ss.locale, 'en_US');
}

// ---------------------------------------------------------------------------
// A. Brand-new spreadsheet, forms not linked yet
// ---------------------------------------------------------------------------
{
  const { ctx, ss, triggers } = load();
  ss.sheets.push(new Sheet(ss, 'Sheet1'));
  const html = ctx.buildEntireSystem();
  ok('A: report returned', /The system is built/.test(html));
  checkFullLayout('A', ss);
  eq('A: triggers', triggers.map(t => t.getHandlerFunction()).sort(), ['onEdit', 'onFormSubmit']);
  ok('A: no sample coupon', ss.getSheetByName('Coupon Manager').getLastRow() === 1);
  ok('A: next steps ask to link forms', /Link the Google Forms/.test(html));

  // Running it again changes nothing and adds no triggers
  ctx.buildEntireSystem();
  checkFullLayout('A (2nd run)', ss);
  eq('A (2nd run): triggers', triggers.length, 2);
}

// ---------------------------------------------------------------------------
// B. Forms linked first ("Form Responses 1/2"), then BUILD
// ---------------------------------------------------------------------------
function linkForms(ss) {
  const reg = new Sheet(ss, 'Form Responses 1', { formUrl: 'https://docs.google.com/forms/d/REGFORM/viewform', cols: 25 });
  reg.getRange(1, 1, 1, 25).setValues([original['Registration Form'].slice(0, 25)]);
  const sub = new Sheet(ss, 'Form Responses 2', { formUrl: 'https://docs.google.com/forms/d/SUBFORM/viewform', cols: 42 });
  sub.getRange(1, 1, 1, 42).setValues([original['Submission Form'].slice(0, 42)]);
  ss.sheets.push(reg, sub);
  return { reg, sub };
}
{
  const { ctx, ss } = load();
  ss.sheets.push(new Sheet(ss, 'Sheet1'));
  const { reg, sub } = linkForms(ss);
  const html = ctx.buildEntireSystem();
  ok('B: registration form tab adopted', ss.getSheetByName('Registration Form') === reg);
  ok('B: submission form tab adopted', ss.getSheetByName('Submission Form') === sub);
  checkFullLayout('B', ss);
  ok('B: no link step when both forms linked', !/Link the Google Forms/.test(html));
}

// ---------------------------------------------------------------------------
// C. BUILD first, forms linked afterwards, BUILD again
// ---------------------------------------------------------------------------
{
  const { ctx, ss, triggers } = load();
  ss.sheets.push(new Sheet(ss, 'Sheet1'));
  ctx.buildEntireSystem();
  const { reg, sub } = linkForms(ss);
  ctx.buildEntireSystem();
  ok('C: placeholder replaced by registration form tab', ss.getSheetByName('Registration Form') === reg);
  ok('C: placeholder replaced by submission form tab', ss.getSheetByName('Submission Form') === sub);
  ok('C: no Form Responses tabs left', !ss.getSheets().some(s => /Form Responses/.test(s.getName())));
  checkFullLayout('C', ss);
  eq('C: triggers not duplicated', triggers.length, 2);
}

// ---------------------------------------------------------------------------
// D. Live spreadsheet with responses: nothing reformatted, no triggers added
// ---------------------------------------------------------------------------
{
  const { ctx, ss, triggers } = load();
  const reg = new Sheet(ss, 'Registration Form', { formUrl: 'https://docs.google.com/forms/d/REGFORM/viewform', cols: 59 });
  reg.getRange(1, 1, 1, 59).setValues([original['Registration Form']]);
  reg.getRange(2, 1, 1, 2).setValues([['2026-01-01', 'someone@example.com']]);
  reg.getRange(1, 1).setBackground('#123456');
  ss.sheets.push(reg);
  ctx.buildEntireSystem();
  eq('D: existing header colour kept', reg.fmt.get('1,1').bg, '#123456');
  eq('D: existing headers kept', headers(reg), original['Registration Form']);
  eq('D: no triggers added on a live sheet', triggers.length, 0);
  eq('D: time zone untouched', ss.tz, 'America/New_York');
}

// ---------------------------------------------------------------------------
// E. Helpers
// ---------------------------------------------------------------------------
{
  const { ctx } = load();
  eq('E: formIdFromUrl_ viewform', ctx.formIdFromUrl_('https://docs.google.com/forms/d/1XDLmze7/viewform'), '1XDLmze7');
  eq('E: formIdFromUrl_ edit', ctx.formIdFromUrl_('https://docs.google.com/forms/d/1XDLmze7/edit'), '1XDLmze7');
  eq('E: formIdFromUrl_ empty', ctx.formIdFromUrl_(null), '');
  eq('E: applicant amount column follows the merge columns', ctx.SYSTEM_CONFIG.SYS_REG_COLS_END.SYS_APPLICANT_AMT, 60);
}

console.log((failures ? failures + ' FAILED' : 'ALL PASSED') + ' (' + checks + ' checks)');
process.exit(failures ? 1 : 0);
