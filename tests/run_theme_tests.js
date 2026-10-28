// Tests for the HNS brand theme of the admin dialogs and emails.
// usage: node tests/run_theme_tests.js src/Code.gs
'use strict';
const fs = require('fs');
const vm = require('vm');
const { makeGlobals } = require('./mock_gas');

const code = fs.readFileSync(process.argv[2], 'utf8').replace(/\r\n/g, '\n');
let failures = 0, checks = 0;
function ok(label, cond) { checks++; if (!cond) { failures++; console.log('FAIL ' + label); } }

const g = makeGlobals();
const ctx = vm.createContext(Object.assign({}, g));
vm.runInContext(code, ctx, { filename: 'Code.gs' });
const B = ctx.SYSTEM_CONFIG.BRAND;

// Dialog colours are swapped; colours of an embedded email are not
const email = '<div style="background:#0d1117;color:#58a6ff">email</div>';
const dialog = '<html><head><style>body{background:#0D1117;color:#e6edf3} .x{background:rgba(22, 27, 34,0.9)}</style></head><body>' +
  '<div class="ui-paper">' + ctx.markEmailEmbed_(email) + '</div><p style="color:#58a6ff">after</p></body></html>';
const out = ctx.withGuideLink_(dialog, 'email');
ok('dark page becomes paper', /background:#f4ecd8/.test(out) && !/#0D1117/i.test(out.split('<!--hns-email-->')[0]));
ok('light text becomes indigo ink', /color:#14006e/.test(out));
ok('rgba recoloured', /rgba\(255,250,240,0\.9\)/.test(out));
ok('text after the email recoloured', /<p style="color:#1a00ab">after/.test(out));
ok('embedded email untouched', out.indexOf(email) >= 0);
ok('brand css added', /id="admin-brand"/.test(out) && out.indexOf(B.YELLOW) >= 0);
ok('display and body fonts loaded', /fonts\.googleapis\.com\/css2\?family=Lilita\+One&family=Poppins/.test(out));

// translucent white (dark-theme panels and grey text) becomes translucent indigo; solid white stays
const tw = ctx.withGuideLink_('<html><head></head><body><div style="background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.6)"></div><b style="color:rgba(255,255,255,0.95)"></b></body></html>', '');
ok('translucent white becomes indigo', /background:rgba\(26,0,171,0\.05\);color:rgba\(26,0,171,0\.6\)/.test(tw) && /rgba\(255,255,255,0\.95\)/.test(tw));

// unreadable pairs are repaired: dark text on a dark badge becomes white
const lc = ctx.withGuideLink_('<html><head><style>.b{background:#9e6a03;color:#e3b341}</style></head><body></body></html>', '');
ok('low contrast text fixed', /\.b\{background:#9e6a03;color:#ffffff\}/.test(lc));

// shared dialogs get the wordmark block and ribbon title
const shared = ctx.withGuideLink_(ctx.buildAdminDialog_({ title: 'Test', body: '' }), '');
ok('wordmark block in shared dialogs', /class="ui-brand"/.test(shared));
ok('brand css after the dialog styles', out.indexOf('id="admin-brand"') > out.indexOf('.x{'));

// "classic" turns it all off
B.ADMIN_THEME = 'classic';
const classic = ctx.withGuideLink_(dialog, 'email');
ok('classic keeps old colours', /#0D1117/.test(classic) && !/admin-brand/.test(classic) && !/Lilita/.test(classic));
ok('classic has no wordmark block', !/ui-brand/.test(ctx.withGuideLink_(ctx.buildAdminDialog_({ title: 'Test', body: '' }), '')));
B.ADMIN_THEME = 'hns';

// Emails use the brand colours and title font
const reg = ctx.EmailBuilder.buildRegistrationConfirmedHtml(
  { name: 'Juan', school: 'X', genId: 'REF-1', competitions: 'Essay Writing Competition' },
  ctx.PricingEngine.calculate('', 'Essay Writing Competition'), 0, 0, { preview: true });
ok('email header uses brand indigo', reg.indexOf(B.INDIGO) >= 0 && !/#1E4FB8/i.test(reg));
ok('email title uses brand yellow', reg.indexOf(B.YELLOW) >= 0 && !/#FFD700/i.test(reg));
ok('email title font', reg.indexOf(B.EMAIL_TITLE_FONT) >= 0 && !/Times New Roman/.test(reg));
ok('no code leaked into the email', !/SYSTEM_CONFIG/.test(reg));
ok('email page is cream paper', reg.indexOf('background-color:' + B.CREAM) >= 0);
ok('email card has the indigo outline', reg.indexOf('border:3px solid ' + B.INDIGO) >= 0);
ok('status ribbon is yellow with indigo text', reg.indexOf('background-color:' + B.YELLOW + ';color:' + B.INDIGO) >= 0);

console.log((failures ? failures + ' FAILED' : 'ALL PASSED') + ' (' + checks + ' checks)');
process.exit(failures ? 1 : 0);
