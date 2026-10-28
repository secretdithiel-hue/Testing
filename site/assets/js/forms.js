/*
 * Pieces shared by the registration and submission forms: file drop zones that upload as
 * soon as a file is chosen, field errors, the "please wait" overlay and input checks that
 * match the spreadsheet's own checks.
 */
(function () {
  "use strict";
  var HNS = window.HNS, esc = HNS.esc;
  var F = HNS.forms = {};

  // One upload session per tab: files uploaded from this page can be attached to its form
  F.session = (function () {
    try {
      var s = sessionStorage.getItem("hns:session");
      if (!s) { s = HNS.api.newId("sess"); sessionStorage.setItem("hns:session", s); }
      return s;
    } catch (e) { return HNS.api.newId("sess"); }
  })();
  F.startedAt = Date.now();
  F.elapsed = function () { return Date.now() - F.startedAt; };

  F.isEmail = function (s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || "").trim()); };
  F.isPhone = function (s) { return /^[0-9+()\-\s\/.]{7,30}$/.test(String(s || "").trim()) && String(s).replace(/\D/g, "").length >= 7; };
  F.isDriveLink = function (s) { return /^https:\/\/(drive|docs)\.google\.com\/.*(\/d\/|[?&]id=)[A-Za-z0-9_-]{20,}/.test(String(s || "").trim()); };
  F.bytes = function (n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; };
  F.ext = function (name) { var m = String(name || "").match(/\.([A-Za-z0-9]{1,5})$/); return m ? m[1].toLowerCase() : ""; };

  /** Show or clear the message under a field (the .field wrapper of the element). */
  F.setError = function (el, msg) {
    var field = el && (el.classList && el.classList.contains("field") ? el : el.closest(".field"));
    if (!field) return;
    var box = field.querySelector(".error-text");
    if (!box) { box = document.createElement("div"); box.className = "error-text"; box.id = "err-" + Math.random().toString(36).slice(2); field.appendChild(box); }
    field.classList.toggle("has-error", !!msg);
    box.textContent = msg || "";
    var input = field.querySelector("input:not([type=hidden]), select, textarea");
    if (input) {
      if (msg) { input.setAttribute("aria-invalid", "true"); input.setAttribute("aria-describedby", box.id); }
      else { input.removeAttribute("aria-invalid"); }
    }
  };
  F.clearErrors = function (root) { HNS.$$(".field.has-error", root).forEach(function (f) { F.setError(f, ""); }); };
  F.focusFirstError = function (root) {
    var f = HNS.$(".field.has-error", root);
    if (!f) return;
    f.scrollIntoView({ behavior: "smooth", block: "center" });
    var input = f.querySelector("input:not([type=hidden]):not([type=file]), select, textarea, button");
    if (input) setTimeout(function () { input.focus({ preventScroll: true }); }, 250);
  };

  /** Full-screen "please wait". */
  F.busy = function (on, title, text) {
    var o = HNS.$("#busy");
    if (!o) {
      o = document.createElement("div");
      o.id = "busy"; o.className = "overlay"; o.setAttribute("role", "alertdialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-live", "assertive");
      o.innerHTML = '<div class="card"><div class="spinner" aria-hidden="true"></div><h3 id="busy-title"></h3><p class="mb-0" id="busy-text"></p></div>';
      document.body.appendChild(o);
    }
    o.hidden = !on;
    if (on) { HNS.$("#busy-title").textContent = title || "Please wait…"; HNS.$("#busy-text").textContent = text || ""; }
  };

  F.readBase64 = function (file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).replace(/^data:[^,]*,/, "")); };
      r.onerror = function () { reject(new Error("The file could not be read.")); };
      r.readAsDataURL(file);
    });
  };

  /**
   * A drop zone that uploads the chosen file right away.
   * opts: { field, form: "registration" | "submission", accept: ["pdf", ...], label, hint, linkAllowed, optional,
 *         extra: fields sent with every upload (the submission page's email and access code), onChange }
   */
  F.dropzone = function (host, opts) {
    var U = (HNS.cfg && HNS.cfg.uploads) || {};
    var reg = opts.form !== "submission";
    var maxMb = (reg ? U.registrationMaxFileMb : U.maxFileMb) || 10;
    var serverTypes = (reg ? U.registrationExtensions : U.extensions) || [];
    var allowed = (opts.accept || []).filter(function (x) { return !serverTypes.length || serverTypes.indexOf(x) >= 0; });
    var acceptAttr = allowed.map(function (x) { return "." + x; }).join(",");
    var state = { fileId: "", name: "", size: 0, link: "", mode: "file", uploading: false };
    var id = "dz-" + opts.field;
    host.classList.add("field");
    host.innerHTML =
      '<span class="label" id="' + id + '-l">' + esc(opts.label) + (opts.optional ? ' <span class="opt">(optional)</span>' : "") + "</span>" +
      (opts.linkAllowed ? '<div class="seg" role="group" aria-label="How to send this file"><button type="button" data-mode="file" aria-pressed="true">Upload a file</button><button type="button" data-mode="link" aria-pressed="false">Google Drive link</button></div>' : "") +
      '<label class="dropzone" for="' + id + '"><input type="file" id="' + id + '" accept="' + esc(acceptAttr) + '" aria-labelledby="' + id + '-l" aria-describedby="' + id + '-h">' +
      '<span class="ico">' + HNS.icons.upload + '</span><span class="txt"><b>Choose a file or drop it here</b><span>' + esc(allowed.join(", ").toUpperCase()) + " · up to " + maxMb + " MB</span></span></label>" +
      (opts.linkAllowed ? '<div class="link-box" hidden><input class="input" type="url" inputmode="url" placeholder="https://drive.google.com/file/d/…" aria-labelledby="' + id + '-l"><span class="hint">In Google Drive: Share → General access → <b>Anyone with the link</b>, then copy the link here.</span></div>' : "") +
      '<span class="hint" id="' + id + '-h">' + (opts.hint ? esc(opts.hint) : "") + "</span>";
    var zone = HNS.$(".dropzone", host), input = HNS.$('input[type="file"]', host), linkBox = HNS.$(".link-box", host);

    function idle() {
      zone.className = "dropzone";
      zone.innerHTML = "";
      zone.appendChild(input);
      zone.insertAdjacentHTML("beforeend", '<span class="ico">' + HNS.icons.upload + '</span><span class="txt"><b>Choose a file or drop it here</b><span>' +
        esc(allowed.join(", ").toUpperCase()) + " · up to " + maxMb + " MB</span></span>");
    }

    /** p: 0..1, or null while the size of the progress is unknown (an animated bar). */
    function showProgress(name, p, size) {
      var known = typeof p === "number";
      zone.className = "dropzone";
      zone.innerHTML = "";
      zone.appendChild(input);
      zone.insertAdjacentHTML("beforeend", '<span class="ico">' + HNS.icons.upload + '</span><span class="txt" style="flex:1"><span class="fname">' + esc(name) +
        "</span><span>Uploading" + (size ? " " + F.bytes(size) : "") + "…" + (known ? " " + Math.round(p * 100) + "%" : " Keep this page open.") + "</span>" +
        '<span class="progress' + (known ? "" : " busy") + '"><i style="width:' + (known ? Math.round(p * 100) : 35) + '%"></i></span></span>');
    }

    function showDone(file, thumbUrl) {
      zone.className = "dropzone done";
      zone.innerHTML = "";
      zone.appendChild(input);
      zone.insertAdjacentHTML("beforeend", (thumbUrl ? '<img class="thumb" alt="" src="' + thumbUrl + '">' : '<span class="ico">' + HNS.icons.file + "</span>") +
        '<span class="txt" style="min-width:0;flex:1"><span class="fname">' + esc(file.name) + "</span><span>" + F.bytes(file.size) + " · uploaded ✓</span></span>" +
        '<button type="button" class="btn btn-paper btn-sm remove">Change</button>');
      HNS.$(".remove", zone).addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); input.value = ""; input.click(); });
    }

    function fail(msg) {
      state.fileId = ""; state.uploading = false;
      idle();
      zone.classList.add("failed");
      F.setError(host, msg);
      if (opts.onChange) opts.onChange(ctl);
    }

    function handle(file) {
      if (!file) return;
      F.setError(host, "");
      var ext = F.ext(file.name);
      if (allowed.indexOf(ext) < 0) return fail("This kind of file can't be used here. Use " + allowed.join(", ").toUpperCase() + ".");
      if (file.size > maxMb * 1048576) {
        return fail("This file is " + F.bytes(file.size) + ", over the " + maxMb + " MB limit." + (opts.linkAllowed ? " Use the Google Drive link option instead." : " Try compressing it or saving a smaller copy."));
      }
      if (!file.size) return fail("This file is empty.");
      state.uploading = true; state.fileId = "";
      if (opts.onChange) opts.onChange(ctl);
      showProgress(file.name, 0, file.size);
      var thumb = /^image\/(jpeg|png|webp)$/.test(file.type) ? URL.createObjectURL(file) : "";
      F.readBase64(file).then(function (data) {
        var body = { session: F.session, form: opts.form, field: opts.field, name: file.name, data: data };
        Object.keys(opts.extra || {}).forEach(function (k) { body[k] = opts.extra[k]; });
        return HNS.api.upload(body, function (p) { showProgress(file.name, p, file.size); });
      }).then(function (res) {
        if (!res || !res.ok) return fail((res && res.message) || "The upload failed. Please try again.");
        state.uploading = false; state.fileId = res.fileId; state.name = file.name; state.size = file.size;
        showDone(file, thumb);
        if (opts.onChange) opts.onChange(ctl);
      }, function (err) { fail((err && err.message) || "The upload failed. Please try again."); });
    }

    input.addEventListener("change", function () { handle(input.files && input.files[0]); });
    ["dragenter", "dragover"].forEach(function (t) { zone.addEventListener(t, function (e) { e.preventDefault(); zone.classList.add("drag"); }); });
    ["dragleave", "drop"].forEach(function (t) { zone.addEventListener(t, function (e) { e.preventDefault(); zone.classList.remove("drag"); }); });
    zone.addEventListener("drop", function (e) { handle(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]); });

    if (opts.linkAllowed) {
      var linkInput = HNS.$("input", linkBox);
      HNS.$$(".seg button", host).forEach(function (b) {
        b.addEventListener("click", function () {
          state.mode = b.getAttribute("data-mode");
          HNS.$$(".seg button", host).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
          zone.hidden = state.mode === "link";
          linkBox.hidden = state.mode !== "link";
          F.setError(host, "");
          if (opts.onChange) opts.onChange(ctl);
        });
      });
      linkInput.addEventListener("input", function () { state.link = linkInput.value.trim(); F.setError(host, ""); if (opts.onChange) opts.onChange(ctl); });
    }

    var ctl = {
      field: opts.field,
      host: host,
      get value() { return state.mode === "link" ? { link: state.link } : { fileId: state.fileId }; },
      get state() { return state; },
      /** "" when fine, otherwise the message to show. */
      check: function () {
        if (state.uploading) return "Wait for the upload to finish.";
        if (state.mode === "link") {
          if (!state.link) return opts.optional ? "" : "Paste the Google Drive link.";
          return F.isDriveLink(state.link) ? "" : "Paste a Google Drive file link (it starts with https://drive.google.com/).";
        }
        return state.fileId || opts.optional ? "" : "Please upload this file.";
      },
      summary: function () { return state.mode === "link" ? (state.link || "—") : (state.name ? state.name + " (" + F.bytes(state.size) + ")" : "—"); },
      /** Show a file uploaded earlier from this tab (kept across a page reload). */
      restore: function (saved) {
        if (!saved || !saved.fileId) return;
        state.fileId = saved.fileId; state.name = saved.name || "file"; state.size = saved.size || 0;
        showDone({ name: state.name, size: state.size }, "");
      },
      saved: function () { return state.fileId ? { fileId: state.fileId, name: state.name, size: state.size } : null; }
    };
    return ctl;
  };

  /** Fill a <select> with options (keeps the current value when it is still offered). */
  F.fillSelect = function (sel, list, placeholder) {
    var cur = sel.value;
    sel.innerHTML = '<option value="">' + esc(placeholder || "Choose…") + "</option>" + list.map(function (v) { return '<option value="' + esc(v) + '">' + esc(v) + "</option>"; }).join("");
    if (list.indexOf(cur) >= 0) sel.value = cur;
  };
})();
