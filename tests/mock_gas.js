// Minimal in-memory Google Apps Script mock: enough of SpreadsheetApp & co. to run the
// System Builder and the edit/submit entry points in Node.
'use strict';

function colLetter(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function letterCol(s) { let n = 0; for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64); return n; }

function chainable(target, log) {
  const p = new Proxy(target, {
    get(t, prop) {
      if (prop in t) return t[prop];
      if (typeof prop === 'symbol' || prop === 'then') return undefined;
      return (...args) => { log && log.push([prop, args]); return p; };
    }
  });
  return p;
}

// Like Google Sheets, a written string that starts with ' is stored as plain text without the
// quote, and one that starts with = becomes a formula.
function writeCell(sheet, r, c, v) {
  const k = sheet.key(r, c);
  if (typeof v === 'string' && v.charAt(0) === "'") { sheet.cells.set(k, v.slice(1)); sheet.formulas.delete(k); return; }
  if (typeof v === 'string' && v.charAt(0) === '=' && v.length > 1) { sheet.formulas.set(k, v); sheet.cells.set(k, 'formula'); return; }
  sheet.cells.set(k, v); sheet.formulas.delete(k);
}

class Sheet {
  constructor(ss, name, opts = {}) {
    this.ss = ss; this.name = name; this.maxRows = opts.rows || 1000; this.maxCols = opts.cols || 26;
    this.cells = new Map(); this.formulas = new Map(); this.fmt = new Map(); this.notes = new Map();
    this.validation = new Map(); this.widths = new Map(); this.frozen = 0; this.hidden = false;
    this.formUrl = opts.formUrl || null; this.bandings = [];
  }
  key(r, c) { return r + ',' + c; }
  getName() { return this.name; }
  setName(n) { this.name = n; return this; }
  getSheetId() { return this.ss.sheets.indexOf(this); }
  getFormUrl() { return this.formUrl; }
  getLastRow() { let m = 0; for (const [k, v] of this.cells) if (v !== '' && v !== null && v !== undefined) m = Math.max(m, +k.split(',')[0]); for (const k of this.formulas.keys()) m = Math.max(m, +k.split(',')[0]); return m; }
  getLastColumn() { let m = 0; for (const [k, v] of this.cells) if (v !== '' && v !== null && v !== undefined) m = Math.max(m, +k.split(',')[1]); for (const k of this.formulas.keys()) m = Math.max(m, +k.split(',')[1]); return m; }
  getMaxRows() { return this.maxRows; }
  getMaxColumns() { return this.maxCols; }
  insertColumnsAfter(after, n) { this.maxCols += n; return this; }
  insertColumnAfter(after) { this.maxCols += 1; return this; }
  deleteColumns(start, n) {
    for (const map of [this.cells, this.formulas, this.fmt, this.validation])
      for (const k of [...map.keys()]) { const c = +k.split(',')[1]; if (c >= start && c < start + n) map.delete(k); }
    this.maxCols -= n; return this;
  }
  setFrozenRows(n) { this.frozen = n; return this; }
  getFrozenRows() { return this.frozen; }
  setColumnWidth(c, w) { this.widths.set(c, w); return this; }
  setColumnWidths(c, n, w) { for (let i = 0; i < n; i++) this.widths.set(c + i, Array.isArray(w) ? w[i] : w); return this; }
  setRowHeight() { return this; }
  hideSheet() { this.hidden = true; return this; }
  isSheetHidden() { return this.hidden; }
  getBandings() { return this.bandings.map(b => ({ remove: () => { this.bandings = this.bandings.filter(x => x !== b); } })); }
  appendRow(vals) { const r = this.getLastRow() + 1; vals.forEach((v, i) => writeCell(this, r, i + 1, v)); return this; }
  clearContents() { this.cells.clear(); this.formulas.clear(); return this; }
  clearFormats() { this.fmt.clear(); return this; }
  autoResizeColumn() { return this; }
  getDataRange() { return this.getRange(1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  getActiveCell() { return this.getRange(this.ss.activeRow || 2, 1); }
  getRange(a, b, c, d) {
    if (typeof a === 'string') {
      const m = a.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
      const r1 = +m[2], c1 = letterCol(m[1]);
      const r2 = m[4] ? +m[4] : r1, c2 = m[3] ? letterCol(m[3]) : c1;
      return new Range(this, r1, c1, r2 - r1 + 1, c2 - c1 + 1);
    }
    return new Range(this, a, b, c || 1, d || 1);
  }
}

class Range {
  constructor(sheet, row, col, nr, nc) {
    if (row < 1 || col < 1 || nr < 1 || nc < 1) throw new Error('Bad range ' + [row, col, nr, nc]);
    if (col + nc - 1 > sheet.maxCols) throw new Error('Range beyond last column of ' + sheet.name + ': ' + (col + nc - 1) + ' > ' + sheet.maxCols);
    Object.assign(this, { sheet, row, col, nr, nc });
    const p = chainable(this, null);
    this.__proxy = p;
    return p;
  }
  each(fn) { for (let r = 0; r < this.nr; r++) for (let c = 0; c < this.nc; c++) fn(this.row + r, this.col + c, r, c); }
  getRow() { return this.row; } getColumn() { return this.col; } getNumRows() { return this.nr; } getNumColumns() { return this.nc; }
  getLastRow() { return this.row + this.nr - 1; } getLastColumn() { return this.col + this.nc - 1; }
  getSheet() { return this.sheet; }
  getA1Notation() { return colLetter(this.col) + this.row + (this.nr > 1 || this.nc > 1 ? ':' + colLetter(this.col + this.nc - 1) + (this.row + this.nr - 1) : ''); }
  getValues() { const out = []; for (let r = 0; r < this.nr; r++) { const row = []; for (let c = 0; c < this.nc; c++) { const v = this.sheet.cells.get(this.sheet.key(this.row + r, this.col + c)); row.push(v === undefined ? '' : v); } out.push(row); } return out; }
  getValue() { return this.getValues()[0][0]; }
  getDisplayValue() { return String(this.getValue()); }
  setValues(v) { if (v.length !== this.nr || v[0].length !== this.nc) throw new Error('setValues size mismatch ' + v.length + 'x' + v[0].length + ' vs ' + this.nr + 'x' + this.nc); this.each((r, c, i, j) => writeCell(this.sheet, r, c, v[i][j])); return this; }
  setValue(v) { this.each((r, c) => writeCell(this.sheet, r, c, v)); return this; }
  setFormula(f) { this.each((r, c) => { this.sheet.formulas.set(this.sheet.key(r, c), f); this.sheet.cells.set(this.sheet.key(r, c), 'formula'); }); return this; }
  getFormula() { return this.sheet.formulas.get(this.sheet.key(this.row, this.col)) || ''; }
  setFmt(k, v) { this.each((r, c) => { const key = this.sheet.key(r, c); const f = this.sheet.fmt.get(key) || {}; f[k] = v; this.sheet.fmt.set(key, f); }); return this; }
  setBackground(v) { return this.setFmt('bg', v); }
  setFontColor(v) { return this.setFmt('fg', v); }
  setFontWeight(v) { return this.setFmt('bold', v); }
  setFontFamily(v) { return this.setFmt('font', v); }
  setHorizontalAlignment(v) { return this.setFmt('align', v); }
  setDataValidation(rule) { this.each((r, c) => this.sheet.validation.set(this.sheet.key(r, c), rule)); return this; }
  getNotes() { const out = []; for (let r = 0; r < this.nr; r++) { const row = []; for (let c = 0; c < this.nc; c++) row.push(this.sheet.notes.get(this.sheet.key(this.row + r, this.col + c)) || ''); out.push(row); } return out; }
  getNote() { return this.getNotes()[0][0]; }
  setNote(n) { this.each((r, c) => this.sheet.notes.set(this.sheet.key(r, c), n)); return this; }
  setNotes(n) { this.each((r, c, i, j) => this.sheet.notes.set(this.sheet.key(r, c), n[i][j])); return this; }
  clearNote() { return this.setNote(''); }
  applyRowBanding() { const b = chainable({}, null); this.sheet.bandings.push(b); return b; }
}

class Spreadsheet {
  constructor() { this.sheets = []; this.tz = 'America/New_York'; this.locale = 'en_GB'; this.active = null; this.toasts = []; }
  getId() { return 'SS_ID'; }
  getSheets() { return this.sheets.slice(); }
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
  insertSheet(n) { if (this.getSheetByName(n)) throw new Error('exists ' + n); const s = new Sheet(this, n); this.sheets.push(s); return s; }
  deleteSheet(s) {
    if (this.sheets.length === 1) throw new Error('cannot delete last sheet');
    const name = s.name;
    this.sheets = this.sheets.filter(x => x !== s);
    // Like Google Sheets: formulas that pointed at the deleted tab become #REF!
    for (const sh of this.sheets) for (const [k, f] of sh.formulas) if (f.indexOf("'" + name + "'!") >= 0) sh.formulas.set(k, f.split("'" + name + "'!A:AI").join('#REF!'));
  }
  setActiveSheet(s) { this.active = s; return s; }
  getActiveSheet() { return this.active || this.sheets[0]; }
  moveActiveSheet(pos) { const s = this.active; this.sheets = this.sheets.filter(x => x !== s); this.sheets.splice(pos - 1, 0, s); }
  setSpreadsheetTimeZone(tz) { this.tz = tz; } getSpreadsheetTimeZone() { return this.tz; }
  setSpreadsheetLocale(l) { this.locale = l; }
  toast(msg, title) { this.toasts.push([title, msg]); }
  getUrl() { return 'https://docs.google.com/spreadsheets/d/SS_ID/edit'; }
}

function makeGlobals() {
  const ss = new Spreadsheet();
  const triggers = [];
  const docProps = new Map(), scriptProps = new Map();
  const props = m => ({ getProperty: k => (m.has(k) ? m.get(k) : null), setProperty: (k, v) => { m.set(k, String(v)); }, deleteProperty: k => m.delete(k), getProperties: () => Object.fromEntries(m) });
  const dvBuilder = () => { const rule = {}; const b = chainable({ requireValueInList(list) { rule.list = list; return b; }, setAllowInvalid(x) { rule.allowInvalid = x; return b; }, build() { return rule; } }, null); return b; };
  const trigBuilder = (fn) => { const t = { getHandlerFunction: () => fn, getUniqueId: () => fn + triggers.length }; return chainable({ create() { triggers.push(t); return t; } }, null); };
  const g = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, getActive: () => ss, getActiveSheet: () => ss.getActiveSheet(), getActiveRange: () => ss.getActiveSheet().getRange(ss.activeRow || 2, 1), flush() {},
      newDataValidation: dvBuilder, BandingTheme: { BLUE: 'BLUE' }, WrapStrategy: { CLIP: 'CLIP', WRAP: 'WRAP', OVERFLOW: 'OVERFLOW' },
      getUi: () => ({ alert: () => 'YES', ButtonSet: { OK: 1, YES_NO: 2 }, Button: { YES: 'YES' } }) },
    ScriptApp: { getProjectTriggers: () => triggers.slice(), newTrigger: trigBuilder, deleteTrigger: t => { const i = triggers.indexOf(t); if (i >= 0) triggers.splice(i, 1); }, AuthMode: { LIMITED: 'LIMITED', FULL: 'FULL' } },
    PropertiesService: { getDocumentProperties: () => props(docProps), getScriptProperties: () => props(scriptProps), getUserProperties: () => props(new Map()) },
    Session: { getActiveUser: () => ({ getEmail: () => 'admin@example.com' }), getEffectiveUser: () => ({ getEmail: () => 'admin@example.com' }), getScriptTimeZone: () => 'Asia/Manila' },
    Utilities: { formatDate: (d) => new Date(d).toISOString(), sleep() {}, getUuid: () => 'uuid', computeDigest: () => [1, 2], DigestAlgorithm: {}, Charset: {} },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {} }), getDocumentLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {}, removeAll() {} }), getDocumentCache: () => ({ get: () => null, put() {}, remove() {} }) },
    Logger: { log() {} },
    console,
    MailApp: { getRemainingDailyQuota: () => 100, sendEmail() {} },
    __ss: ss, __triggers: triggers, __docProps: docProps, __scriptProps: scriptProps, __Sheet: Sheet
  };
  return g;
}

module.exports = { makeGlobals, Sheet, colLetter };
