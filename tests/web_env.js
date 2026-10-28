// Runs the real Code.gs with the website API wired to in-memory stand-ins for Drive, the
// cache, mail and the Utilities the API needs. Used by run_web_api_tests.js and by
// web_test_server.js (which lets the website talk to it in a browser).
'use strict';
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');
const { makeGlobals, Sheet } = require('./mock_gas');

const signed = buf => Array.from(buf, b => (b > 127 ? b - 256 : b));
const unsigned = arr => Buffer.from(Array.from(arr, b => b & 255));

function makeDrive() {
  const files = new Map(), folders = new Map();
  let n = 0;
  const newId = () => 'id' + String(++n).padStart(4, '0') + crypto.randomBytes(14).toString('hex');
  const iter = list => { let i = 0; return { hasNext: () => i < list.length, next: () => list[i++] }; };
  function makeFile(name, bytes, mime, folder) {
    const f = { id: newId(), name, bytes, mime, folder, description: '', created: new Date(), trashed: false };
    const api = {
      getId: () => f.id, getName: () => f.name, getMimeType: () => f.mime, getSize: () => f.bytes.length,
      getDescription: () => f.description, setDescription: d => { f.description = d; return api; },
      getDateCreated: () => f.created, setTrashed: t => { f.trashed = !!t; return api; }, isTrashed: () => f.trashed,
      getUrl: () => 'https://drive.google.com/file/d/' + f.id + '/view',
      getBlob: () => ({ getBytes: () => f.bytes, getContentType: () => f.mime, getName: () => f.name }),
      makeCopy: (name, dest) => makeFile(name, f.bytes, f.mime, (dest && dest.__fo) || f.folder).api,
      __f: f
    };
    f.api = api;
    files.set(f.id, f);
    if (folder) folder.__files.push(f);
    return f;
  }
  function makeFolder(name) {
    const fo = { id: newId(), name, __files: [], __folders: [] };
    fo.api = {
      getId: () => fo.id, getName: () => fo.name,
      createFile: blob => makeFile(blob.getName(), blob.getBytes(), blob.getContentType(), fo).api,
      createFolder: nm => { const c = makeFolder(nm); fo.__folders.push(c); return c.api; },
      getFoldersByName: nm => iter(fo.__folders.filter(x => x.name === nm).map(x => x.api)),
      getFiles: () => iter(fo.__files.filter(x => !x.trashed).map(x => x.api)),
      __fo: fo
    };
    folders.set(fo.id, fo);
    return fo;
  }
  return {
    files, folders, makeFile,
    api: {
      createFolder: name => makeFolder(name).api,
      getFolderById: id => { const fo = folders.get(id); if (!fo) throw new Error('No folder ' + id); return fo.api; },
      getFileById: id => { const f = files.get(id); if (!f || f.trashed) throw new Error('No item with the given ID could be found: ' + id); return f.api; },
      getRootFolder: () => makeFolder('My Drive').api
    }
  };
}

function makeWebEnv(codePath, opts) {
  opts = opts || {};
  const code = fs.readFileSync(codePath, 'utf8').replace(/\r\n/g, '\n');
  const g = makeGlobals();
  const drive = makeDrive();
  const store = new Map();
  const mails = [];
  const lock = { free: true };
  g.CacheService = {
    getScriptCache: () => ({
      get: k => (store.has(k) ? store.get(k) : null), put: (k, v) => { store.set(k, String(v)); },
      remove: k => { store.delete(k); }, removeAll: ks => ks.forEach(k => store.delete(k))
    }),
    getDocumentCache: () => g.CacheService.getScriptCache()
  };
  g.LockService = {
    getScriptLock: () => ({ waitLock() { if (!lock.free) throw new Error('Lock timeout'); }, tryLock: () => lock.free, releaseLock() {}, hasLock: () => true }),
    getDocumentLock: () => g.LockService.getScriptLock()
  };
  const pad = x => String(x).padStart(2, '0');
  g.Utilities = {
    sleep() {},
    getUuid: () => crypto.randomUUID(),
    formatDate: (d, tz, fmt) => {
      const m = new Date(new Date(d).getTime() + 8 * 3600 * 1000);   // Asia/Manila
      if (fmt === "yyyy-MM-dd HH:mm:ss") return m.getUTCFullYear() + '-' + pad(m.getUTCMonth() + 1) + '-' + pad(m.getUTCDate()) + ' ' + pad(m.getUTCHours()) + ':' + pad(m.getUTCMinutes()) + ':' + pad(m.getUTCSeconds());
      return new Date(d).toISOString();
    },
    parseDate: (s, tz, fmt) => new Date(String(s).replace(' ', 'T') + ':00+08:00'),
    computeDigest: (alg, value) => signed(crypto.createHash(alg === 'MD5' ? 'md5' : 'sha256').update(String(value), 'utf8').digest()),
    computeHmacSha256Signature: (value, key) => signed(crypto.createHmac('sha256', key).update(String(value), 'utf8').digest()),
    base64Decode: s => { if (/[^A-Za-z0-9+/=\s]/.test(s)) throw new Error('Could not decode string.'); return signed(Buffer.from(s, 'base64')); },
    base64Encode: b => unsigned(b).toString('base64'),
    base64EncodeWebSafe: b => unsigned(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
    newBlob: (bytes, mime, name) => ({ getBytes: () => bytes, getContentType: () => mime, getName: () => name, setName() { return this; } }),
    DigestAlgorithm: { SHA_256: 'SHA_256', MD5: 'MD5' },
    Charset: { UTF_8: 'UTF_8' }
  };
  g.DriveApp = drive.api;
  g.Drive = {};                                   // advanced Drive service: not available
  g.Gmail = { Users: { Messages: { send() { throw new Error('no Gmail API in tests'); }, get() { throw new Error('no Gmail API in tests'); } } } };
  g.GmailApp = { sendEmail: (to, subject, body, o) => { mails.push({ to, subject, html: (o && o.htmlBody) || body }); }, getAliases: () => [], search: () => [] };
  g.MailApp = { getRemainingDailyQuota: () => (opts.quota === undefined ? 90 : opts.quota), sendEmail: o => { mails.push({ to: o.to, subject: o.subject, html: o.htmlBody }); } };
  g.ContentService = { MimeType: { JSON: 'JSON' }, createTextOutput: s => { const o = { content: s, mime: '' }; o.setMimeType = m => { o.mime = m; return o; }; o.getContent = () => s; return o; } };
  g.ScriptApp.getService = () => ({ getUrl: () => opts.webAppUrl || '' });
  g.HtmlService = { createHtmlOutput: html => { const o = { html: String(html) }; o.setWidth = () => o; o.setHeight = () => o; o.setTitle = () => o; o.getContent = () => o.html; return o; } };
  const shown = [];
  g.SpreadsheetApp.getUi = () => ({ alert: () => 'YES', showModalDialog: (o, t) => shown.push({ title: t, html: o.html }), ButtonSet: { OK: 1, YES_NO: 2 }, Button: { YES: 'YES' } });

  const ctx = vm.createContext(Object.assign({}, g));
  vm.runInContext(code, ctx, { filename: 'Code.gs' });
  const ss = g.__ss;
  ss.sheets.push(new Sheet(ss, 'Sheet1'));
  ctx.buildEntireSystem();

  function get(params) { return JSON.parse(ctx.doGet({ parameter: params || {} }).getContent()); }
  function post(body) { return JSON.parse(ctx.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } }).getContent()); }
  return { ctx, g, ss, drive, mails, store, lock, shown, get, post, C: ctx.SYSTEM_CONFIG };
}

module.exports = { makeWebEnv };
