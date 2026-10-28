// Serves site/ and, on a second address (another origin, as on the real website), a web app
// that runs the real Code.gs on the mock spreadsheet and answers like Apps Script does:
// GET and POST /exec run doGet / doPost and redirect to an "echo" address that returns the
// result; OPTIONS (a CORS preflight) is refused, because Apps Script cannot answer it either.
// usage: node tests/web_test_server.js [port]      then open http://localhost:<port>/
// With PREVIEW=1 the website runs in preview mode (no web app), as it does before apiUrl is set.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { makeWebEnv } = require('./web_env');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon' };
const SAFE_TYPES = /^(text\/plain|application\/x-www-form-urlencoded|multipart\/form-data)\b/i;

function listen(server, port) {
  return new Promise((resolve) => server.listen(port || 0, () => resolve(server.address().port)));
}

function webAppServer(env, opts) {
  const results = new Map();
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const cors = { 'Access-Control-Allow-Origin': '*' };
    if (req.method === 'OPTIONS') { res.writeHead(405); return res.end('doOptions is not supported'); }
    if (url.pathname === '/echo') {
      const out = results.get(url.searchParams.get('key'));
      results.delete(url.searchParams.get('key'));
      res.writeHead(out ? 200 : 404, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, cors));
      return res.end(out || '');
    }
    if (url.pathname !== '/exec') { res.writeHead(404); return res.end(); }
    const finish = (out) => {
      const key = crypto.randomBytes(12).toString('hex');
      results.set(key, out);
      setTimeout(() => {
        res.writeHead(302, Object.assign({ Location: '/echo?key=' + key }, cors));
        res.end();
      }, opts.delay || 0);
    };
    if (req.method === 'GET') return finish(env.ctx.doGet({ parameter: Object.fromEntries(url.searchParams) }).getContent());
    if (req.method !== 'POST' || !SAFE_TYPES.test(req.headers['content-type'] || '')) { res.writeHead(400); return res.end(); }
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => finish(env.ctx.doPost({ postData: { contents: body } }).getContent()));
  });
}

async function start(opts) {
  opts = opts || {};
  const env = makeWebEnv(path.join(ROOT, 'src/Code.gs'), { webAppUrl: 'https://script.google.com/macros/s/TEST/exec' });
  env.ss.getSheetByName('Coupon Manager').getRange(2, 1, 1, 9).setValues([['SOK-ANA', 25, '2020-01-01', '2099-12-31', 100, 0, 'ACTIVE', 'MEMBER', 'Ana']]);
  env.ctx.saveWebsiteSettings({
    siteUrl: 'https://example.github.io/Testing/', edition: '5th',
    registration: { STATUS: 'open' }, submission: { STATUS: 'open' },
    paymentMethods: [{ mode: 'GCash', accountName: 'HNS Finance Team', accountNumber: '0917 000 1111' }, { mode: 'BPI', accountName: 'UPLB Sociology Society', accountNumber: '1234 5678 90' }],
    dates: [{ label: 'Registration', date: 'January 16 – February 12, 2027' }, { label: 'Entry deadline', date: 'February 26, 2027' }]
  });
  if (opts.setup) opts.setup(env);

  let apiUrl = '';
  let api = null;
  if (!opts.preview) {
    api = webAppServer(env, opts);
    apiUrl = 'http://127.0.0.1:' + (await listen(api)) + '/exec';
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let file = path.join(SITE, decodeURIComponent(url.pathname));
    if (!file.startsWith(SITE)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) {
      res.writeHead(404, { 'Content-Type': TYPES['.html'] });
      return res.end(fs.readFileSync(path.join(SITE, '404.html')));
    }
    let data = fs.readFileSync(file);
    if (url.pathname === '/assets/js/config.js' && apiUrl) {
      data = Buffer.from(String(data).replace('apiUrl: ""', 'apiUrl: "' + apiUrl + '"'));
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
  const port = await listen(server, opts.port);
  const close = server.close.bind(server);
  server.close = (cb) => { if (api) api.close(); return close(cb); };
  return { server, env, port, apiUrl };
}

module.exports = { start };

if (require.main === module) {
  start({ port: Number(process.argv[2] || 8080), preview: !!process.env.PREVIEW }).then(({ port, apiUrl }) => {
    console.log('Website on http://localhost:' + port + '/' + (apiUrl ? ' (web app: real Code.gs on a mock spreadsheet at ' + apiUrl + ')' : ' (preview mode)'));
  });
}
