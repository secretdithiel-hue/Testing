/*
 * Registration wizard. The answers are sent to the spreadsheet's web app, which writes them
 * into "Registration Form" exactly as the Google Form would and runs the same processing.
 */
(function () {
  "use strict";
  var HNS = window.HNS, F = HNS.forms, $ = HNS.$, $$ = HNS.$$, esc = HNS.esc;
  var form = $("#reg-form");
  if (!form) return;

  var DRAFT_KEY = "hns:reg:draft";
  var STEPS = 6;
  var step = 0, maxStep = 0, requestId = "", finished = false;
  var uploads = {};
  var codes = { referral: { code: "", valid: false, discount: 0, checking: false, message: "" }, coupon: { code: "", valid: false, discount: 0, checking: false, message: "" } };
  var IMG_PDF = ["jpg", "jpeg", "png", "heic", "heif", "webp", "pdf"];
  var FIELD_STEP = {
    email: 0, consentPrivacy: 0, consentPledge: 0,
    name: 1, sex: 1, age: 1, region: 1, contact: 1, facebook: 1,
    school: 2, gradeLevel: 2, adviser: 2, guardianName: 2, guardianContact: 2, guardianRel: 2, PROOF_OF_SCHOOL: 2, VALID_ID: 2,
    competitions: 3, refCode: 3, couponCode: 3,
    payMode: 4, PAY_PROOF: 4, REG_FORM: 4
  };

  function val(id) { var el = document.getElementById(id); return el ? String(el.value || "").trim() : ""; }
  function radio(name) { var r = form.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : ""; }
  function picked() { return $$("#comp-choices input:checked").map(function (i) { return i.value; }); }
  function panel(n) { return $('.wiz-panel[data-step="' + n + '"]', form); }

  function answers() {
    return {
      email: val("email").toLowerCase(), name: val("name"), sex: radio("sex"), age: val("age") === "" ? "" : Number(val("age")),
      region: val("region"), contact: val("contact"), guardianName: val("guardianName"), guardianContact: val("guardianContact"),
      guardianRel: val("guardianRel"), facebook: val("facebook"), school: val("school"), gradeLevel: val("gradeLevel"),
      adviser: val("adviser"), competitions: picked(), payMode: radio("payMode"),
      refCode: val("refCode").toUpperCase(), couponCode: val("couponCode").toUpperCase(),
      consentPrivacy: $("#consentPrivacy").checked, consentPledge: $("#consentPledge").checked
    };
  }

  // ---------------------------------------------------------------------------
  // building the form from the live settings
  // ---------------------------------------------------------------------------
  function radios(hostSel, name, list) {
    $(hostSel).innerHTML = list.map(function (v) {
      return '<label class="choice"><input type="radio" name="' + name + '" value="' + esc(v) + '"><span class="box"><span class="t">' + esc(v) + '</span><span class="tick"></span></span></label>';
    }).join("");
  }

  function renderAccounts(list) {
    var host = $("#pay-accounts");
    var C = (window.HNS_CONFIG || {}).contact || {};
    if (!list || !list.length) {
      host.innerHTML = '<div class="banner warn" style="margin:0"><span class="i" aria-hidden="true">ℹ️</span><p>The payment accounts will be posted here. Until then, ask the team at <a href="mailto:' + esc(C.participantsEmail) + '">' + esc(C.participantsEmail) + "</a>.</p></div>";
      return;
    }
    host.innerHTML = list.map(function (p) {
      return '<div class="pay-acct"><span class="mode">' + esc(p.mode) + '</span><span><span class="num">' + esc(p.accountNumber) + '</span><span class="who">' + esc(p.accountName) + "</span></span>" +
        '<button type="button" class="btn btn-paper btn-sm copy" data-copy="' + esc(p.accountNumber) + '" data-mode="' + esc(p.mode) + '">Copy</button></div>';
    }).join("");
    $$(".copy", host).forEach(function (b) {
      b.addEventListener("click", function () {
        var r = form.querySelector('input[name="payMode"][value="' + b.getAttribute("data-mode") + '"]');
        if (r && !radio("payMode")) { r.checked = true; saveDraft(); }
      });
    });
  }

  function build(c) {
    var O = c.options;
    radios("#sex", "sex", O.SEX);
    radios("#payMode", "payMode", O.PAY_MODE);
    F.fillSelect($("#region"), O.REGION, "Choose your region");
    F.fillSelect($("#gradeLevel"), O.GRADE_LEVEL, "Choose your grade level");
    F.fillSelect($("#guardianRel"), O.GUARDIAN_REL, "Choose one");
    $("#comp-choices").innerHTML = c.competitions.map(function (comp) {
      var m = HNS.COMPS[comp.key] || {};
      return '<label class="choice"><input type="checkbox" value="' + esc(comp.key) + '"><span class="box">' + HNS.sticker(comp.key, "sm") +
        '<span><span class="t">' + esc(m.title || comp.shortName) + '</span><span class="s">' + esc(m.plain || comp.registrationName) + (comp.special ? " · team entry" : "") + "</span></span>" +
        '<span class="p">' + HNS.peso(comp.price) + '</span><span class="tick"></span></span></label>';
    }).join("");
    renderAccounts(c.paymentMethods);
    $$("[data-max-mb]").forEach(function (el) { el.textContent = c.uploads.registrationMaxFileMb; });

    var link = c.links && (c.links.registrationForm || c.links.primer);
    var help = $("#regform-help");
    if (c.links && c.links.registrationForm) help.innerHTML = '<a href="' + esc(c.links.registrationForm) + '" target="_blank" rel="noopener">download the form here</a>, fill it up and sign it';
    else if (c.links && c.links.primer) help.innerHTML = 'from the <a href="' + esc(c.links.primer) + '" target="_blank" rel="noopener">event primer</a>';

    function dz(hostId, field, label, hint, accept) {
      uploads[field] = F.dropzone($(hostId), { field: field, form: "registration", label: label, hint: hint, accept: accept, onChange: saveDraft });
    }
    dz("#up-school", "PROOF_OF_SCHOOL", "Proof of school affiliation", "School ID, certificate of enrollment or a similar document.", IMG_PDF);
    dz("#up-id", "VALID_ID", "Any valid ID", "A photo or scan where your name is readable.", IMG_PDF);
    dz("#up-pay", "PAY_PROOF", "Proof of payment", "A screenshot of the transaction showing the amount and the reference number.", IMG_PDF);
    dz("#up-regform", "REG_FORM", "Filled-up registration form", link ? "The signed Husay ng SokSay registration form." : "The signed Husay ng SokSay registration form from the event primer.", ["pdf", "doc", "docx"].concat(IMG_PDF.slice(0, 6)));

    var pick = (location.search.match(/[?&]pick=([A-Z,]+)/) || [])[1];
    if (pick) pick.split(",").forEach(function (k) { var b = $('#comp-choices input[value="' + k + '"]'); if (b) b.checked = true; });
    restoreDraft();
    wire();
    renderTotals();
  }

  // ---------------------------------------------------------------------------
  // referral and coupon codes
  // ---------------------------------------------------------------------------
  function codeId(kind) { return kind === "referral" ? "refCode" : "couponCode"; }
  function checkCode(kind) {
    var id = codeId(kind), st = codes[kind], out = $("#" + id + "-status");
    var code = val(id).toUpperCase();
    F.setError($("#" + id), "");
    if (!code) { st.code = ""; st.valid = false; st.discount = 0; st.message = ""; out.textContent = ""; out.className = "code-status"; renderTotals(); return Promise.resolve(); }
    if (st.code === code && !st.checking && st.message) return Promise.resolve();
    st.checking = true; st.code = code; st.valid = false; st.discount = 0;
    out.textContent = "Checking…"; out.className = "code-status wait";
    return HNS.api.checkCode(kind, code).then(function (res) {
      if (val(id).toUpperCase() !== code) return;
      st.checking = false;
      st.valid = !!(res && res.ok && res.valid);
      st.discount = st.valid ? Number(res.discount || 0) : 0;
      st.message = (res && res.message) || (st.valid ? "Code accepted." : "That code can't be used.");
      out.textContent = (st.valid ? "✓ " : "✗ ") + st.message;
      out.className = "code-status " + (st.valid ? "ok" : "bad");
      renderTotals();
      saveDraft();
    });
  }

  // ---------------------------------------------------------------------------
  // totals and review
  // ---------------------------------------------------------------------------
  function quote() {
    return HNS.quote(picked(), codes.referral.valid ? codes.referral.discount : 0, codes.coupon.valid ? codes.coupon.discount : 0);
  }
  function totalInner(q, title) {
    if (!q.count) return '<div class="lines">Choose at least one competition to see your total.</div><div class="amt">₱0</div>';
    var lines = ["<b>" + esc(q.bundleLabel.replace(/\s*\(₱[\d,]+\)$/, "")) + "</b>"];
    if (q.bundleDiscount) lines.push("Bundle price: <s>" + HNS.peso(q.raw) + "</s> " + HNS.peso(q.price));
    if (q.referral) lines.push("Referral code: −" + HNS.peso(q.referral));
    if (q.coupon) lines.push("Coupon: −" + HNS.peso(q.coupon));
    return '<div><div style="font-weight:800;letter-spacing:1.4px;text-transform:uppercase;font-size:.78rem;color:var(--yellow)">' + esc(title || "Amount to pay") + '</div><div class="lines">' + lines.join("<br>") + '</div></div><div class="amt">' + HNS.peso(q.total) + "</div>";
  }
  function renderTotals() {
    var q = quote();
    $("#total-box-3").innerHTML = totalInner(q);
    $("#total-box-4").innerHTML = totalInner(q);
    $("#mini-total").textContent = q.count ? "Your total: " + HNS.peso(q.total) : "";
  }

  function renderReview() {
    var a = answers(), q = quote();
    var names = (HNS.cfg.competitions || []).filter(function (c) { return a.competitions.indexOf(c.key) >= 0; })
      .map(function (c) { return (HNS.COMPS[c.key] || {}).plain || c.shortName; });
    var sections = [
      ["You", 0, [["Email", a.email]]],
      ["About you", 1, [["Full name", a.name], ["Sex", a.sex], ["Age", a.age], ["Region", a.region], ["Contact number", a.contact], ["Facebook", a.facebook]]],
      ["School & guardian", 2, [["School", a.school], ["Grade level", a.gradeLevel], ["Adviser", a.adviser || "—"], ["Guardian", a.guardianName + (a.guardianRel ? " (" + a.guardianRel + ")" : "")],
        ["Guardian's number", a.guardianContact], ["Proof of school", uploads.PROOF_OF_SCHOOL.summary()], ["Valid ID", uploads.VALID_ID.summary()]]],
      ["Competitions", 3, [["You join", names.join(", ") || "—"], ["Package", q.bundleLabel || "—"], ["Referral code", codes.referral.valid ? a.refCode : "—"], ["Coupon", codes.coupon.valid ? a.couponCode : "—"]]],
      ["Payment", 4, [["Paid with", a.payMode || "—"], ["Proof of payment", uploads.PAY_PROOF.summary()], ["Registration form", uploads.REG_FORM.summary()]]]
    ];
    $("#review").innerHTML = sections.map(function (s) {
      return '<div class="card card-flat" style="padding:14px 18px;margin-bottom:14px"><div class="summary-head"><h3 style="margin:0;font-size:1.25rem">' + esc(s[0]) +
        '</h3><button type="button" class="link-btn" data-goto="' + s[1] + '">Edit<span class="sr-only"> ' + esc(s[0]) + "</span></button></div><dl class=\"summary\">" +
        s[2].map(function (r) { return '<div class="row"><dt>' + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd></div>"; }).join("") + "</dl></div>";
    }).join("") + '<div class="total-box">' + totalInner(q) + "</div>";
  }

  // ---------------------------------------------------------------------------
  // steps and checks
  // ---------------------------------------------------------------------------
  function go(n, quiet) {
    step = n;
    maxStep = Math.max(maxStep, n);
    $$(".wiz-panel", form).forEach(function (p) { p.classList.toggle("active", Number(p.getAttribute("data-step")) === n); });
    $$(".stepper li", form).forEach(function (li, i) {
      li.classList.toggle("current", i === n);
      li.classList.toggle("done", i <= maxStep && i !== n);
      var b = li.querySelector("button");
      b.disabled = i > maxStep;
      if (i === n) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
    });
    $(".progress-line i", form).style.width = Math.round(n / (STEPS - 1) * 100) + "%";
    $("#btn-back").style.visibility = n === 0 ? "hidden" : "visible";
    $("#btn-next").hidden = n === STEPS - 1;
    $("#btn-send").hidden = n !== STEPS - 1;
    if (n === 3 || n === 4) renderTotals();
    if (n === STEPS - 1) renderReview();
    hideError();
    if (!quiet) {
      var top = form.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top: top, behavior: "smooth" });
      var h = $("#s" + n);
      if (h) setTimeout(function () { h.focus({ preventScroll: true }); }, 200);
    }
    saveDraft();
  }

  function fieldEl(key) {
    if (uploads[key]) return uploads[key].host;
    if (key === "sex" || key === "payMode") return $("#" + key).closest(".field");
    if (key === "competitions") return $("#comp-field");
    var el = document.getElementById(key);
    return el ? el.closest(".field") : null;
  }

  function showErrors(errs) {
    Object.keys(errs).forEach(function (k) { var el = fieldEl(k); if (el) F.setError(el, errs[k]); });
  }

  function errorsFor(n) {
    var a = answers(), e = {};
    if (n === 0) {
      if (!a.consentPrivacy) e.consentPrivacy = "Please agree to the data privacy statement to continue.";
      if (!a.consentPledge) e.consentPledge = "Please agree to the ethical use pledge to continue.";
      if (!F.isEmail(a.email)) e.email = "Enter a valid email address.";
    } else if (n === 1) {
      if (a.name.length < 3) e.name = "Enter your full name.";
      if (!a.sex) e.sex = "Choose one.";
      if (!(a.age >= 9 && a.age <= 25 && Math.floor(a.age) === a.age)) e.age = "Enter your age (9 to 25).";
      if (!a.region) e.region = "Choose your region.";
      if (!F.isPhone(a.contact)) e.contact = "Enter a phone number, like 0917 123 4567.";
      if (!a.facebook) e.facebook = "Enter your Facebook profile link.";
    } else if (n === 2) {
      if (!a.school) e.school = "Enter your school's name.";
      if (!a.gradeLevel) e.gradeLevel = "Choose your grade level.";
      if (!a.guardianName) e.guardianName = "Enter your guardian's full name.";
      if (!F.isPhone(a.guardianContact)) e.guardianContact = "Enter a phone number, like 0918 765 4321.";
      if (!a.guardianRel) e.guardianRel = "Choose one.";
      ["PROOF_OF_SCHOOL", "VALID_ID"].forEach(function (k) { var m = uploads[k].check(); if (m) e[k] = m; });
    } else if (n === 3) {
      if (!a.competitions.length) e.competitions = "Choose at least one competition.";
      ["referral", "coupon"].forEach(function (kind) {
        var id = codeId(kind), typed = val(id).toUpperCase(), st = codes[kind];
        if (!typed) return;
        if (st.checking) e[id] = "Wait for the code check to finish.";
        else if (!(st.valid && st.code === typed)) e[id] = (st.code === typed && st.message ? st.message + " " : "") + "Fix the code or clear the box.";
      });
    } else if (n === 4) {
      if (!a.payMode) e.payMode = "Choose how you paid.";
      ["PAY_PROOF", "REG_FORM"].forEach(function (k) { var m = uploads[k].check(); if (m) e[k] = m; });
    }
    return e;
  }

  function validate(n) {
    F.clearErrors(panel(n));
    var e = errorsFor(n);
    showErrors(e);
    if (Object.keys(e).length) { F.focusFirstError(panel(n)); return false; }
    return true;
  }

  function next() {
    var pending = step === 3 ? Promise.all([checkCode("referral"), checkCode("coupon")]) : Promise.resolve();
    $("#btn-next").disabled = true;
    pending.then(function () {
      $("#btn-next").disabled = false;
      if (validate(step)) go(step + 1);
    });
  }

  function showError(msg) { var b = $("#reg-error"); b.hidden = false; $("p", b).innerHTML = msg; b.scrollIntoView({ behavior: "smooth", block: "center" }); }
  function hideError() { $("#reg-error").hidden = true; }

  // ---------------------------------------------------------------------------
  // draft (this tab only: sessionStorage is cleared when the tab is closed)
  // ---------------------------------------------------------------------------
  function saveDraft() {
    if (finished) return;
    try {
      var a = answers();
      var files = {};
      Object.keys(uploads).forEach(function (k) { files[k] = uploads[k].saved(); });
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ a: a, files: files, maxStep: maxStep }));
    } catch (e) {}
  }
  function restoreDraft() {
    var d = null;
    try { d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null"); } catch (e) {}
    if (!d || !d.a) return;
    var a = d.a;
    ["email", "name", "age", "region", "contact", "guardianName", "guardianContact", "guardianRel", "facebook", "school", "gradeLevel", "adviser", "refCode", "couponCode"].forEach(function (k) {
      var el = document.getElementById(k);
      if (el && a[k] !== undefined && a[k] !== "") el.value = a[k];
    });
    ["sex", "payMode"].forEach(function (n) {
      var r = a[n] && form.querySelector('input[name="' + n + '"][value="' + a[n].replace(/"/g, "") + '"]');
      if (r) r.checked = true;
    });
    if (a.competitions && a.competitions.length) {
      $$("#comp-choices input").forEach(function (b) { b.checked = a.competitions.indexOf(b.value) >= 0; });
    }
    $("#consentPrivacy").checked = !!a.consentPrivacy;
    $("#consentPledge").checked = !!a.consentPledge;
    Object.keys(d.files || {}).forEach(function (k) { if (uploads[k]) uploads[k].restore(d.files[k]); });
    maxStep = Math.min(Number(d.maxStep || 0), STEPS - 1);
    if (a.refCode) checkCode("referral");
    if (a.couponCode) checkCode("coupon");
  }

  // ---------------------------------------------------------------------------
  // sending
  // ---------------------------------------------------------------------------
  function send() {
    for (var i = 0; i < STEPS - 1; i++) {
      if (Object.keys(errorsFor(i)).length) { go(i); validate(i); return; }
    }
    if (!requestId) requestId = HNS.api.newId("reg");
    var files = {};
    Object.keys(uploads).forEach(function (k) { files[k] = uploads[k].state.fileId; });
    var body = { requestId: requestId, session: F.session, elapsedMs: F.elapsed(), website: $("#hp").value, answers: answers(), files: files };
    $("#btn-send").disabled = true;
    F.busy(true, "Sending your registration…", "This can take up to a minute. Please keep this page open.");
    HNS.api.register(body, function (n) {
      var t = $("#busy-text");
      if (t) t.textContent = "The system is busy with other forms. Trying again (" + (n + 1) + ")…";
    }).then(function (res) {
      F.busy(false);
      $("#btn-send").disabled = false;
      if (res && res.ok) return finish(res);
      if (res && res.fields && Object.keys(res.fields).length) {
        var keys = Object.keys(res.fields);
        var first = Math.min.apply(null, keys.map(function (k) { return FIELD_STEP[k] !== undefined ? FIELD_STEP[k] : STEPS - 1; }));
        if (first < STEPS - 1) {
          go(first);
          showErrors(res.fields);
          F.focusFirstError(panel(first));
        }
        if (res.error === "duplicate") requestId = "";
      }
      var C = (window.HNS_CONFIG || {}).contact || {};
      showError(esc((res && res.message) || "Something went wrong.") + (res && res.error === "network" ? "" : ' If this keeps happening, email <a href="mailto:' + esc(C.participantsEmail) + '">' + esc(C.participantsEmail) + "</a>."));
    });
  }

  function finish(res) {
    finished = true;
    requestId = "";
    try { sessionStorage.removeItem(DRAFT_KEY); } catch (e) {}
    form.hidden = true;
    $("#reg-banner").innerHTML = "";
    $("#done-genid").textContent = res.genId;
    $("#done-copy").onclick = function () { HNS.copy(res.genId); };
    var b = res.breakdown || {};
    var lines = [];
    if (b.bundle) lines.push("Bundle discount: −" + HNS.peso(b.bundle));
    if (b.referral) lines.push("Referral code: −" + HNS.peso(b.referral));
    if (b.coupon) lines.push("Coupon: −" + HNS.peso(b.coupon));
    $("#done-total").innerHTML = '<div><div style="font-weight:800;letter-spacing:1.4px;text-transform:uppercase;font-size:.78rem;color:var(--yellow)">Registration fee</div><div class="lines">' +
      (lines.join("<br>") || "Payment to be confirmed by the Finance team") + '</div></div><div class="amt">' + HNS.peso(res.total) + "</div>";
    $("#done-lead").innerHTML = res.preview
      ? "<b>Preview only:</b> this form is not connected yet, so nothing was sent and no email will come."
      : "We sent a confirmation to <b>" + esc(res.email) + "</b>. Keep it: it has your Gen ID and the details of your registration.";
    var done = $("#reg-done");
    done.hidden = false;
    window.scrollTo({ top: done.getBoundingClientRect().top + window.scrollY - 110, behavior: "smooth" });
    done.focus({ preventScroll: true });
    HNS.confetti();
  }

  // ---------------------------------------------------------------------------
  // events
  // ---------------------------------------------------------------------------
  function wire() {
    $("#btn-next").addEventListener("click", next);
    $("#btn-back").addEventListener("click", function () { if (step > 0) go(step - 1); });
    form.addEventListener("submit", function (e) { e.preventDefault(); if (step < STEPS - 1) next(); else send(); });
    form.addEventListener("click", function (e) {
      var g = e.target.closest("[data-goto]");
      if (g && !g.disabled) { e.preventDefault(); go(Number(g.getAttribute("data-goto"))); }
    });
    form.addEventListener("input", function (e) {
      if (e.target.type === "file") return;
      var f = e.target.closest(".field");
      if (f && f.classList.contains("has-error")) F.setError(f, "");
      if (e.target.id === "refCode" || e.target.id === "couponCode") {
        var kind = e.target.id === "refCode" ? "referral" : "coupon";
        codes[kind].valid = false; codes[kind].discount = 0; codes[kind].message = ""; codes[kind].code = "";
        var out = $("#" + e.target.id + "-status"); out.textContent = ""; out.className = "code-status";
        renderTotals();
      }
      saveDraft();
    });
    form.addEventListener("change", function (e) {
      if (e.target.type === "file") return;   // the drop zone reports its own result
      if (e.target.closest("#comp-choices")) { renderTotals(); F.setError($("#comp-field"), ""); }
      var f = e.target.closest(".field");
      if (f && f.classList.contains("has-error")) F.setError(f, "");
      saveDraft();
    });
    $$("[data-check]").forEach(function (b) { b.addEventListener("click", function () { checkCode(b.getAttribute("data-check")); }); });
    ["refCode", "couponCode"].forEach(function (id) {
      $("#" + id).addEventListener("blur", function () { if (val(id)) checkCode(id === "refCode" ? "referral" : "coupon"); });
    });
    window.addEventListener("beforeunload", function (e) {
      if (!finished && maxStep > 0) { e.preventDefault(); e.returnValue = ""; }
    });
  }

  // ---------------------------------------------------------------------------
  // start
  // ---------------------------------------------------------------------------
  HNS.configReady.then(function (c) {
    $$("[data-edition-ordinal]").forEach(function (el) { el.textContent = c.event.edition || el.textContent; });
    var w = c.registration || {};
    if (!c.preview && !w.open) {
      $("#reg-closed").hidden = false;
      var gf = (window.HNS_CONFIG || {}).registrationGoogleForm;
      if (gf) { var a = $("#reg-gform"); a.href = gf; a.hidden = false; }
      return;
    }
    if (c.preview) {
      $("#reg-banner").innerHTML = '<div class="banner demo"><span class="i" aria-hidden="true">🧪</span><p><b>Preview mode.</b> This form is not connected to the registration system yet: you can try every step, but nothing you enter is sent anywhere. Use the coupon <b>SOKSAY25</b> to see a discount.</p></div>';
    } else if (w.closes) {
      $("#reg-banner").innerHTML = '<div class="banner ok"><span class="i" aria-hidden="true">✅</span><p><b>Registration is open</b> until ' + esc(HNS.fmtDate(w.closes, true)) + ".</p></div>";
    }
    form.hidden = false;
    build(c);
    go(Math.min(maxStep, 0), true);
  });
})();
