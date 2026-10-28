/*
 * Talks to the spreadsheet's web app (see config.js). Requests are sent as text/plain and
 * without upload-progress listeners: either one would make the browser send a CORS
 * preflight (OPTIONS) request first, which an Apps Script web app cannot answer.
 * Without an apiUrl (or with ?preview in the address) everything is simulated.
 */
(function () {
  "use strict";
  var CFG = window.HNS_CONFIG || {};
  var forcePreview = /[?&]preview\b/.test(location.search);
  var apiUrl = forcePreview ? "" : String(CFG.apiUrl || "").trim();
  var CONFIG_KEY = "hns:config:v1";

  function randomId(prefix) {
    var a = new Uint8Array(12);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return prefix + "_" + Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /** One request; resolves with the parsed JSON. */
  function send(method, url, body, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open(method, url, true);
      xhr.timeout = timeoutMs || 120000;
      if (body !== undefined) xhr.setRequestHeader("Content-Type", "text/plain;charset=utf-8");
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch (e) { reject({ network: true, message: "The server sent an unexpected answer." }); }
        } else {
          reject({ network: true, status: xhr.status, message: "The server answered " + xhr.status + "." });
        }
      };
      xhr.onerror = function () { reject({ network: true, message: "No connection to the server." }); };
      xhr.ontimeout = function () { reject({ network: true, message: "The server took too long to answer." }); };
      xhr.send(body === undefined ? null : body);
    });
  }

  /**
   * Retries dropped connections, and "busy" answers for requests that are safe to repeat
   * (register / submit carry a requestId, so a repeat can never make a second row).
   */
  function request(method, params, body, opts) {
    opts = opts || {};
    var url = apiUrl + (params ? "?" + new URLSearchParams(params).toString() : "");
    var tries = opts.tries || 3;
    var attempt = 0;
    function go() {
      attempt++;
      return send(method, url, body, opts.timeoutMs).then(function (res) {
        if (res && res.ok === false && res.error === "busy" && opts.retryBusy && attempt < tries) {
          if (opts.onRetry) opts.onRetry(attempt);
          return wait(5000 * attempt).then(go);
        }
        return res;
      }, function (err) {
        if (attempt < tries && opts.retryNetwork !== false) {
          if (opts.onRetry) opts.onRetry(attempt);
          return wait(1500 * attempt).then(go);
        }
        return { ok: false, error: "network", message: err.message + " Check your internet connection and try again." };
      });
    }
    return go();
  }

  // ---------------------------------------------------------------------------
  // Preview mode: answers that look like the real ones
  // ---------------------------------------------------------------------------
  var demo = {
    files: {},
    config: function () {
      var c = JSON.parse(JSON.stringify(window.HNS_DEFAULTS || {}));
      var open = { status: "open", open: true, opens: "", closes: "", message: "Preview: try the form; nothing is sent." };
      c.registration = open;
      c.submission = open;
      c.preview = true;
      c.serverTime = new Date().toISOString();
      if (!c.paymentMethods || !c.paymentMethods.length) {
        c.paymentMethods = [{ mode: "GCash", accountName: "(account name)", accountNumber: "0900 000 0000" }];
      }
      return c;
    },
    checkCode: function (p) {
      var code = String(p.code || "").trim().toUpperCase();
      if (p.kind === "referral") {
        var ok = /^REF-[A-Z0-9]{8}$/.test(code);
        return { ok: true, valid: ok, discount: ok ? 50 : 0, message: ok ? "Referral code accepted: ₱50 off. (preview)" : "We can't find that referral code. Check the spelling (it looks like REF-XXXXXXXX)." };
      }
      var good = code === "SOKSAY25";
      return { ok: true, valid: good, discount: good ? 25 : 0, message: good ? "Coupon accepted: ₱25 off. (preview: try SOKSAY25)" : "We can't find that coupon code. (preview: try SOKSAY25)" };
    },
    upload: function (b) {
      var id = randomId("preview");
      demo.files[id] = b.name;
      return { ok: true, fileId: id, name: b.name, size: Math.round((b.data || "").length * 0.75) };
    },
    register: function (b) {
      var a = b.answers || {};
      var D = window.HNS_DEFAULTS;
      var picked = (D.competitions || []).filter(function (c) { return (a.competitions || []).indexOf(c.key) >= 0; });
      var ref = a.refCode ? demo.checkCode({ kind: "referral", code: a.refCode }) : {};
      var cpn = a.couponCode ? demo.checkCode({ kind: "coupon", code: a.couponCode }) : {};
      var q = window.HNS.quote(picked.map(function (c) { return c.key; }), ref.valid ? ref.discount : 0, cpn.valid ? cpn.discount : 0, D);
      return {
        ok: true, preview: true, genId: "REF-PREVIEW1", email: a.email, name: a.name,
        competitions: picked.map(function (c) { return c.registrationName; }), payMode: a.payMode,
        total: q.total, breakdown: { base: q.raw, bundle: q.bundleDiscount, coupon: q.coupon, referral: q.referral }
      };
    },
    lookup: function (b) {
      var em = String(b.email || "").trim().toLowerCase();
      if (!em || String(b.access || "").replace(/[^A-Za-z0-9]/g, "").length !== 8) {
        return { ok: false, error: "not_found", message: "That email and access code don't match a registration. (Preview: any email with any 8-character code works.)" };
      }
      var done = JSON.parse(sessionStorage.getItem("hns:preview:done") || "{}");
      return {
        ok: true, preview: true, name: "Juan Dela Cruz", firstName: "Juan", genId: "REF-PREVIEW1", paid: true, requirePayment: true,
        submission: { status: "open", open: true, message: "Preview" },
        competitions: [
          { key: "ESSAY", submissionName: "Essay Writing Competition", shortName: "Essay Writing", submitted: !!done.ESSAY },
          { key: "FILM", submissionName: "Short Film Competition", shortName: "Short Film Making", submitted: !!done.FILM }
        ],
        prefill: { name: "Juan Dela Cruz", region: "Region IV - A (CALABARZON)", school: "Sample National High School", adviser: "", facebook: "https://www.facebook.com/", contact: "0917 123 4567" }
      };
    },
    submit: function (b) {
      var done = JSON.parse(sessionStorage.getItem("hns:preview:done") || "{}");
      done[b.competition] = true;
      sessionStorage.setItem("hns:preview:done", JSON.stringify(done));
      var pre = { ESSAY: "ES", SPEECH: "SP", PHOTO: "PH", FILM: "FM" }[b.competition] || "XX";
      return { ok: true, preview: true, competition: b.competition, key: b.competition, participantNumber: pre + "-0000" };
    },
    resendAccess: function () {
      return { ok: true, message: "If that email is registered, its access code is on the way. (Preview: nothing was sent.)" };
    }
  };

  function demoCall(name, arg, delay) {
    return wait(delay || 450).then(function () { return demo[name](arg || {}); });
  }

  function uploadDemo(body, onProgress) {
    var p = 0;
    return new Promise(function (resolve) {
      var t = setInterval(function () {
        p = Math.min(1, p + 0.18);
        if (onProgress) onProgress(p);
        if (p >= 1) { clearInterval(t); resolve(demo.upload(body)); }
      }, 120);
    });
  }

  var api = {
    preview: !apiUrl,
    newId: randomId,

    /** The live settings (open / closed, prices...), cached for two minutes per tab. */
    config: function (fresh) {
      if (!apiUrl) return Promise.resolve(demo.config());
      if (!fresh) {
        try {
          var hit = JSON.parse(sessionStorage.getItem(CONFIG_KEY) || "null");
          if (hit && Date.now() - hit.t < 120000) return Promise.resolve(hit.v);
        } catch (e) {}
      }
      return request("GET", { action: "config" }, undefined, { tries: 2 }).then(function (res) {
        if (res && res.ok) {
          try { sessionStorage.setItem(CONFIG_KEY, JSON.stringify({ t: Date.now(), v: res })); } catch (e) {}
          return res;
        }
        var fallback = demo.config();
        fallback.offline = true;
        fallback.preview = false;
        fallback.registration = fallback.submission = { status: "unknown", open: false, message: (res && res.message) || "We can't reach the registration system right now." };
        return fallback;
      });
    },

    checkCode: function (kind, code) {
      if (!apiUrl) return demoCall("checkCode", { kind: kind, code: code }, 300);
      return request("GET", { action: "checkCode", kind: kind, code: code }, undefined, { tries: 2 });
    },

    /** onProgress(null) while sending (the browser cannot report real progress here), onProgress(1) at the end. */
    upload: function (body, onProgress) {
      body.action = "upload";
      if (!apiUrl) return uploadDemo(body, onProgress);
      if (onProgress) onProgress(null);
      return request("POST", null, JSON.stringify(body), { tries: 2, timeoutMs: 300000 }).then(function (res) {
        if (onProgress && res && res.ok) onProgress(1);
        return res;
      });
    },

    register: function (body, onRetry) {
      body.action = "register";
      if (!apiUrl) return demoCall("register", body, 1400);
      return request("POST", null, JSON.stringify(body), { tries: 4, retryBusy: true, onRetry: onRetry, timeoutMs: 180000 });
    },

    lookup: function (email, access) {
      if (!apiUrl) return demoCall("lookup", { email: email, access: access }, 500);
      return request("POST", null, JSON.stringify({ action: "lookup", email: email, access: access }), { tries: 2 });
    },

    submit: function (body, onRetry) {
      body.action = "submit";
      if (!apiUrl) return demoCall("submit", body, 1400);
      return request("POST", null, JSON.stringify(body), { tries: 4, retryBusy: true, onRetry: onRetry, timeoutMs: 300000 });
    },

    resendAccess: function (email) {
      if (!apiUrl) return demoCall("resendAccess", { email: email }, 500);
      return request("POST", null, JSON.stringify({ action: "resendAccess", email: email }), { tries: 2 });
    }
  };

  window.HNS = window.HNS || {};
  window.HNS.api = api;
})();
