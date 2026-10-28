/*
 * Submission portal: sign in with email + access code, then one form per competition, built
 * from the Submission Form's own questions (sent by the web app). Entries are written into
 * "Submission Form" exactly as the Google Form would and get their participant numbers there.
 */
(function () {
  "use strict";
  var HNS = window.HNS, F = HNS.forms, $ = HNS.$, $$ = HNS.$$, esc = HNS.esc;
  if (!$("#view-signin")) return;

  var AUTH_KEY = "hns:sub:auth";
  var VIEWS = ["view-signin", "view-closed", "view-dash", "view-entry", "view-done"];
  var cfg = null, me = null, auth = null, current = null, uploads = {}, requestId = "";

  var LABELS = {
    FILM_MEMBERS: "Team members", ESSAY_TITLE: "Title of your essay", PHOTO_TITLE: "Title of the photograph",
    PHOTO_PHONE: "Phone used to take the photograph", FILM_TITLE: "Title of the short film", FILM_ROLES: "Roles in the short film",
    SPEECH_VIDEO: "Video of your speech", SPEECH_WRITTEN: "Written copy of your speech", ESSAY_FILE: "Your essay",
    PHOTO_FILE: "Your original photograph", PHOTO_EXPLANATION: "Photograph and explanation on one A4 page", FILM_FILE: "Your short film",
    FILM_FACEBOOK: "Facebook or Messenger link of the team representative", FILM_CONTACT: "Contact number of the team representative"
  };
  var BY_ROLE = { name: "Full name", region: "Region", school: "School or university", adviser: "Adviser or coach", facebook: "Facebook or Messenger link", contact: "Contact number" };
  var HINTS = {
    FILM_MEMBERS: "One name per line, up to 10 members including the production crew.",
    FILM_ROLES: "One per line, for example: Juan Dela Cruz – Director.",
    ESSAY_FILE: "PDF · A4, Times New Roman 12, 1.5 spacing. No name or school anywhere in the file or its name.",
    SPEECH_WRITTEN: "Your full speech with its original title, as a PDF.",
    SPEECH_VIDEO: "MP4 or MOV, landscape, 2 to 5 minutes.",
    PHOTO_FILE: "The original photo straight from your phone (JPG, PNG or HEIC).",
    PHOTO_EXPLANATION: "The photo with its title and a 150–200 word explanation, on one A4 page.",
    FILM_FILE: "MP4 or MOV, 3 to 5 minutes plus closing credits.",
    PHOTO_PHONE: "For example: Samsung Galaxy A15."
  };
  var ACCEPT = {
    SPEECH_VIDEO: ["mp4", "mov", "m4v"], FILM_FILE: ["mp4", "mov", "m4v"],
    SPEECH_WRITTEN: ["pdf", "docx", "doc"], ESSAY_FILE: ["pdf"],
    PHOTO_FILE: ["jpg", "jpeg", "png", "heic", "heif", "webp"], PHOTO_EXPLANATION: ["pdf", "jpg", "jpeg", "png", "webp", "docx"]
  };

  function show(id) {
    VIEWS.forEach(function (v) { $("#" + v).hidden = v !== id; });
  }
  function scrollToMain() { var t = $("#sub-banner"); window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 100, behavior: "smooth" }); }
  function formatCode(s) {
    s = String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    return s.length > 4 ? s.slice(0, 4) + "-" + s.slice(4) : s;
  }
  function msg(el, text, kind) {
    el.hidden = !text;
    el.className = "banner" + (kind ? " " + kind : "");
    $("p", el).innerHTML = text || "";
  }
  function contactLink() {
    var C = (window.HNS_CONFIG || {}).contact || {};
    return '<a href="mailto:' + esc(C.participantsEmail) + '">' + esc(C.participantsEmail) + "</a>";
  }

  // ---------------------------------------------------------------------------
  // sign in / out
  // ---------------------------------------------------------------------------
  function signIn(email, access) {
    msg($("#si-error"), "");
    F.busy(true, "Signing in…", "");
    return HNS.api.lookup(email, access).then(function (res) {
      F.busy(false);
      if (!res || !res.ok) {
        show("view-signin");
        $("#si-email").value = email;
        $("#si-code").value = formatCode(access);
        msg($("#si-error"), esc((res && res.message) || "We couldn't sign you in."), "bad");
        return;
      }
      me = res;
      auth = { email: email, access: access };
      try { sessionStorage.setItem(AUTH_KEY, JSON.stringify(auth)); } catch (e) {}
      renderDash();
    });
  }

  function signOut() {
    me = auth = null;
    try { sessionStorage.removeItem(AUTH_KEY); } catch (e) {}
    $("#si-code").value = "";
    show("view-signin");
  }

  // ---------------------------------------------------------------------------
  // dashboard
  // ---------------------------------------------------------------------------
  function renderDash(note) {
    show("view-dash");
    $("#dash-hello").textContent = "Hi, " + (me.firstName || "there") + "!";
    $("#dash-sub").textContent = auth.email + (me.genId ? " · Gen ID " + me.genId : "");
    var blocked = me.requirePayment && !me.paid;
    var open = me.submission ? me.submission.open : true;
    var notes = [];
    if (note) notes.push(note);
    if (blocked) notes.push('<div class="banner warn" style="margin:0 0 10px"><span class="i" aria-hidden="true">⏳</span><p><b>We haven\'t confirmed your payment yet.</b> You can submit as soon as the Finance team marks it as received. Paid a while ago? Email ' + contactLink() + ".</p></div>");
    if (!open) notes.push('<div class="banner warn" style="margin:0 0 10px"><span class="i" aria-hidden="true">🔒</span><p>' + esc(HNS.windowText(me.submission, "Entry submission")) + "</p></div>");
    $("#dash-pay").innerHTML = notes.join("");
    $("#dash-comps").innerHTML = me.competitions.map(function (c) {
      var m = HNS.COMPS[c.key] || {};
      var btn = c.submitted
        ? '<span class="tag tag-ok">✓ Submitted</span>'
        : '<button type="button" class="btn btn-sm" data-open="' + esc(c.key) + '"' + (blocked || !open ? " disabled" : "") + ">Submit entry →</button>";
      return '<div class="card card-flat" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">' + HNS.sticker(c.key, "sm") +
        '<div style="flex:1;min-width:160px"><b style="font-family:var(--font-display);font-weight:400;font-size:1.25rem;color:var(--indigo)">' + esc(m.title || c.shortName) +
        '</b><br><span class="small muted">' + esc(c.submissionName) + "</span></div>" + btn + "</div>";
    }).join("") || '<p class="muted">We found no competitions on your registration. Email ' + contactLink() + ".</p>";
    scrollToMain();
  }

  // ---------------------------------------------------------------------------
  // entry form
  // ---------------------------------------------------------------------------
  function labelFor(f) {
    if (f.key === "FILM_CONSENT") return f.label;
    return LABELS[f.key] || BY_ROLE[f.role] || f.label;
  }

  function openEntry(key) {
    var spec = cfg.submissionForm && cfg.submissionForm[key];
    var comp = (me.competitions || []).filter(function (c) { return c.key === key; })[0];
    if (!spec || !comp) return;
    current = key; uploads = {}; requestId = "";
    var m = HNS.COMPS[key] || {};
    $("#entry-tag").textContent = (m.plain || comp.shortName) + " entry";
    $("#entry-sticker").innerHTML = HNS.sticker(key);
    $("#entry-title").textContent = m.title || comp.shortName;
    $("#entry-sub").textContent = comp.submissionName;
    $("#e-privacy").checked = false;
    $("#e-pledge").checked = false;
    F.clearErrors($("#view-entry"));
    msg($("#entry-error"), "");
    var pre = me.prefill || {};
    var host = $("#entry-fields");
    host.innerHTML = "";
    spec.fields.forEach(function (f) {
      var label = labelFor(f), hint = HINTS[f.key] || (f.role === "facebook" ? "So we can reach you on Messenger." : "");
      var box = document.createElement("div");
      if (f.type === "file") {
        box.className = "full";
        host.appendChild(box);
        uploads[f.key] = F.dropzone(box, {
          field: f.key, form: "submission", label: label, hint: hint, accept: ACCEPT[f.key] || cfg.uploads.extensions,
          linkAllowed: (cfg.uploads.linkFields || []).indexOf(f.key) >= 0, optional: !f.required,
          extra: { email: auth.email, access: auth.access }
        });
        return;
      }
      var id = "f-" + f.key;
      var wide = f.type === "textarea" || f.type === "yesno" || f.role === "name" || f.role === "school";
      box.className = "field" + (wide ? " full" : "");
      var opt = f.required ? "" : ' <span class="opt">(optional)</span>';
      var control;
      if (f.type === "region") control = '<select class="select" id="' + id + '" data-key="' + f.key + '"></select>';
      else if (f.type === "textarea") control = '<textarea class="textarea" id="' + id + '" data-key="' + f.key + '"></textarea>';
      else if (f.type === "yesno") control = '<div class="choices cols-2" role="radiogroup" aria-labelledby="' + id + '-l">' + ["Yes", "No"].map(function (v) {
        return '<label class="choice"><input type="radio" name="' + id + '" value="' + v + '" data-key="' + f.key + '"><span class="box"><span class="t">' + v + '</span><span class="tick"></span></span></label>';
      }).join("") + "</div>";
      else control = '<input class="input" id="' + id + '" data-key="' + f.key + '" type="' + (f.type === "url" ? "url" : f.type === "tel" ? "tel" : "text") + '"' + (f.type === "tel" ? ' inputmode="tel"' : "") + (f.type === "url" ? ' inputmode="url"' : "") + ">";
      box.innerHTML = (f.type === "yesno" ? '<span class="label" id="' + id + '-l">' + esc(label) + "</span>" : '<label for="' + id + '">' + esc(label) + opt + "</label>") + control + (hint ? '<span class="hint">' + esc(hint) + "</span>" : "");
      host.appendChild(box);
      var el = document.getElementById(id);
      if (f.type === "region") F.fillSelect(el, cfg.options.REGION, "Choose the region");
      var v = { name: pre.name, region: pre.region, school: pre.school, adviser: pre.adviser, facebook: pre.facebook, contact: pre.contact }[f.role];
      if (el && v) el.value = v;
    });
    show("view-entry");
    scrollToMain();
    setTimeout(function () { $("#entry-title").setAttribute("tabindex", "-1"); $("#entry-title").focus({ preventScroll: true }); }, 250);
  }

  function collect() {
    var spec = cfg.submissionForm[current];
    var answers = {}, files = {}, links = {}, errs = [];
    if (!$("#e-privacy").checked) errs.push([$("#e-privacy"), "Please agree to the data privacy statement."]);
    if (!$("#e-pledge").checked) errs.push([$("#e-pledge"), "Please agree to the ethical use pledge."]);
    spec.fields.forEach(function (f) {
      if (f.type === "file") {
        var up = uploads[f.key], m = up.check();
        if (m) errs.push([up.host, m]);
        var v = up.value;
        if (v.fileId) files[f.key] = v.fileId;
        if (v.link) links[f.key] = v.link;
        return;
      }
      var el, value;
      if (f.type === "yesno") {
        var r = $('input[data-key="' + f.key + '"]:checked');
        value = r ? r.value : "";
        el = $('input[data-key="' + f.key + '"]');
      } else {
        el = $('[data-key="' + f.key + '"]');
        value = String(el.value || "").trim();
      }
      answers[f.key] = value;
      if (!value && f.required) errs.push([el, f.type === "yesno" ? "Choose Yes or No." : "This is required."]);
      else if (value && f.type === "tel" && !F.isPhone(value)) errs.push([el, "Enter a phone number, like 0917 123 4567."]);
      else if (f.key === "FILM_MEMBERS" && value.split(/\n+/).filter(function (x) { return x.trim(); }).length > 10) errs.push([el, "A team has at most 10 members."]);
    });
    return { answers: answers, files: files, links: links, errs: errs };
  }

  function send() {
    F.clearErrors($("#view-entry"));
    msg($("#entry-error"), "");
    var c = collect();
    if (c.errs.length) {
      c.errs.forEach(function (e) { F.setError(e[0], e[1]); });
      F.focusFirstError($("#view-entry"));
      return;
    }
    if (!requestId) requestId = HNS.api.newId("sub");
    var body = {
      requestId: requestId, session: F.session, elapsedMs: F.elapsed(), website: $("#hp").value,
      email: auth.email, access: auth.access, competition: current,
      consentPrivacy: true, consentPledge: true, answers: c.answers, files: c.files, links: c.links
    };
    $("#entry-send").disabled = true;
    F.busy(true, "Submitting your entry…", Object.keys(c.links).length ? "Copying your Google Drive file can take a minute. Please keep this page open." : "Please keep this page open.");
    HNS.api.submit(body, function (n) {
      var t = $("#busy-text");
      if (t) t.textContent = "The system is busy with other forms. Trying again (" + (n + 1) + ")…";
    }).then(function (res) {
      F.busy(false);
      $("#entry-send").disabled = false;
      if (res && res.ok) return done(res);
      if (res && res.error === "not_found") { signOut(); msg($("#si-error"), esc(res.message), "bad"); return; }
      if (res && (res.error === "duplicate" || res.error === "unpaid" || res.error === "closed")) {
        return signIn(auth.email, auth.access).then(function () {
          if (me) renderDash('<div class="banner bad" style="margin:0 0 10px"><span class="i" aria-hidden="true">⚠️</span><p>' + esc(res.message) + "</p></div>");
        });
      }
      if (res && res.fields) {
        Object.keys(res.fields).forEach(function (k) {
          var target = uploads[k] ? uploads[k].host : (k === "consentPrivacy" ? $("#e-privacy") : k === "consentPledge" ? $("#e-pledge") : $('[data-key="' + k + '"]'));
          if (target) F.setError(target, res.fields[k]);
        });
        F.focusFirstError($("#view-entry"));
      }
      msg($("#entry-error"), esc((res && res.message) || "Something went wrong.") + (res && res.error === "network" ? "" : " If this keeps happening, email " + contactLink() + "."), "bad");
    });
  }

  function done(res) {
    requestId = "";
    (me.competitions || []).forEach(function (c) { if (c.key === current) c.submitted = true; });
    var m = HNS.COMPS[current] || {};
    $("#done-title").textContent = (m.plain || res.competition) + " entry received!";
    $("#done-lead").innerHTML = res.preview
      ? "<b>Preview only:</b> this form is not connected yet, so nothing was sent."
      : "Your entry is now in the official submission list and will be judged anonymously.";
    $("#done-num").textContent = res.participantNumber || "";
    $("#done-num-wrap").hidden = !res.participantNumber;
    show("view-done");
    scrollToMain();
    $("#view-done").focus({ preventScroll: true });
    HNS.confetti();
  }

  // ---------------------------------------------------------------------------
  // events
  // ---------------------------------------------------------------------------
  $("#si-code").addEventListener("input", function (e) {
    var el = e.target, end = el.selectionEnd === el.value.length;
    el.value = formatCode(el.value);
    if (end) el.setSelectionRange(el.value.length, el.value.length);
  });
  $("#signin-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var email = $("#si-email").value.trim().toLowerCase(), code = $("#si-code").value.trim();
    F.clearErrors($("#signin-form"));
    if (!F.isEmail(email)) { F.setError($("#si-email"), "Enter the email address you registered with."); F.focusFirstError($("#signin-form")); return; }
    if (code.replace(/[^A-Za-z0-9]/g, "").length !== 8) { F.setError($("#si-code"), "The access code has 8 letters and numbers, like ABCD-2345."); F.focusFirstError($("#signin-form")); return; }
    signIn(email, code);
  });
  $("#show-resend").addEventListener("click", function () {
    var f = $("#resend-form");
    f.hidden = false;
    $("#rs-email").value = $("#si-email").value;
    f.scrollIntoView({ behavior: "smooth", block: "center" });
    $("#rs-email").focus({ preventScroll: true });
  });
  $("#resend-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var email = $("#rs-email").value.trim().toLowerCase();
    F.clearErrors($("#resend-form"));
    if (!F.isEmail(email)) { F.setError($("#rs-email"), "Enter the email address you registered with."); return; }
    var b = $('#resend-form button[type="submit"]');
    b.disabled = true;
    HNS.api.resendAccess(email).then(function (res) {
      b.disabled = false;
      msg($("#rs-msg"), esc((res && res.message) || "Please try again later."), res && res.ok ? "ok" : "bad");
    });
  });
  $("#sign-out").addEventListener("click", signOut);
  $("#dash-comps").addEventListener("click", function (e) {
    var b = e.target.closest("[data-open]");
    if (b && !b.disabled) openEntry(b.getAttribute("data-open"));
  });
  $("#entry-back").addEventListener("click", function () { renderDash(); });
  $("#done-back").addEventListener("click", function () { renderDash(); });
  $("#view-entry").addEventListener("submit", function (e) { e.preventDefault(); send(); });
  $("#view-entry").addEventListener("input", function (e) { var f = e.target.closest(".field"); if (f && f.classList.contains("has-error")) F.setError(f, ""); });
  $("#view-entry").addEventListener("change", function (e) {
    if (e.target.type === "file") return;   // the drop zone reports its own result
    var f = e.target.closest(".field");
    if (f && f.classList.contains("has-error")) F.setError(f, "");
  });

  /** Sign in from the personal link (submit.html#email=...&access=...), then drop the code from the address. */
  function fromLink() {
    var h = new URLSearchParams(location.hash.replace(/^#/, ""));
    if (!h.get("email") || !h.get("access")) return false;
    if (history.replaceState) history.replaceState(null, "", location.pathname + location.search);
    signIn(h.get("email").trim().toLowerCase(), h.get("access"));
    return true;
  }

  // ---------------------------------------------------------------------------
  // start
  // ---------------------------------------------------------------------------
  HNS.configReady.then(function (c) {
    cfg = c;
    $$("[data-max-mb]").forEach(function (el) { el.textContent = c.uploads.maxFileMb; });
    if (c.preview) {
      $("#sub-banner").innerHTML = '<div class="banner demo"><span class="i" aria-hidden="true">🧪</span><p><b>Preview mode.</b> This page is not connected to the submission system yet, so nothing is sent. Sign in with any email and any 8-character code to try it.</p></div>';
    }
    var w = c.submission || {};
    if (!c.preview && !w.open) { show("view-closed"); return; }

    // the personal link from the receipt email: submit.html#email=...&access=...
    window.addEventListener("hashchange", function () { fromLink(); });
    if (fromLink()) return;
    var saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(AUTH_KEY) || "null"); } catch (e) {}
    if (saved && saved.email && saved.access) return signIn(saved.email, saved.access);
    show("view-signin");
  });
})();
