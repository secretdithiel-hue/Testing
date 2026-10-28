/*
 * Shared behaviour for every page: navigation, the live "registration open / closed" bar,
 * countdowns, scroll reveals, tabs, the fee calculator, copy buttons, toasts and confetti.
 */
(function () {
  "use strict";
  document.documentElement.classList.remove("no-js");
  var HNS = window.HNS = window.HNS || {};
  var CFG = window.HNS_CONFIG || {};
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------------------------------------------------------------------------
  // helpers
  // ---------------------------------------------------------------------------
  HNS.esc = function (s) {
    return String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  HNS.peso = function (n) { return "₱" + Number(n || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 }); };
  HNS.$ = function (sel, root) { return (root || document).querySelector(sel); };
  HNS.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  HNS.fmtDate = function (iso, withTime) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d)) return String(iso);
    var o = { timeZone: "Asia/Manila", month: "long", day: "numeric", year: "numeric" };
    if (withTime) { o.hour = "numeric"; o.minute = "2-digit"; }
    return d.toLocaleString("en-PH", o);
  };

  // The four competitions as the website presents them (names from the Event Primer)
  HNS.COMPS = {
    ESSAY: { title: "Naratibo ng SokSay", plain: "Essay Writing", icon: "pen", cls: "essay",
      blurb: "Answer the edition's guide question in a critical, well-argued essay in English or Filipino." },
    SPEECH: { title: "Alingawngaw ng SokSay", plain: "Speech", icon: "mic", cls: "speech",
      blurb: "Write and deliver an original speech on video that makes the Social Sciences echo." },
    PHOTO: { title: "Tatak SokSay: Imahe ng Lipunan", plain: "Mobile Phone Photography", icon: "camera", cls: "photo",
      blurb: "Capture an everyday Filipino moment with a phone and tell the story behind it." },
    FILM: { title: "Salaysay, SokSay: Kwento ng Lipunan", plain: "Short Film", icon: "film", cls: "film",
      blurb: "Make a 3–5 minute short film as a team of up to 10 and compete for the People's Choice Award." }
  };

  HNS.icons = {
    pen: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 39l4-12L31 9a4 4 0 0 1 6 0l2 2a4 4 0 0 1 0 6L21 35z" fill="#fff" stroke="#1a00ab" stroke-width="3.5" stroke-linejoin="round"/><path d="M13 27l8 8M28 12l8 8" stroke="#1a00ab" stroke-width="3.5"/><path d="M9 39l2.6-7.6 5 5z" fill="#1a00ab"/></svg>',
    mic: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="17" y="5" width="14" height="24" rx="7" fill="#fff" stroke="#1a00ab" stroke-width="3.5"/><path d="M11 22a13 13 0 0 0 26 0M24 35v7M17 42h14" fill="none" stroke="#1a00ab" stroke-width="3.5" stroke-linecap="round"/><path d="M21 12h6M21 18h6" stroke="#1a00ab" stroke-width="3" stroke-linecap="round"/></svg>',
    camera: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="13" y="4" width="22" height="40" rx="5" fill="#fff" stroke="#1a00ab" stroke-width="3.5"/><circle cx="24" cy="21" r="6.5" fill="#fbd23f" stroke="#1a00ab" stroke-width="3.5"/><path d="M21 38h6" stroke="#1a00ab" stroke-width="3.5" stroke-linecap="round"/><circle cx="29.5" cy="10" r="1.8" fill="#1a00ab"/></svg>',
    film: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="18" width="36" height="24" rx="3" fill="#fff" stroke="#1a00ab" stroke-width="3.5"/><path d="M6 11l33-6 1.4 7.5-33 6z" fill="#fff" stroke="#1a00ab" stroke-width="3.5" stroke-linejoin="round"/><path d="M15 9.4l4 7M25 7.6l4 7" stroke="#1a00ab" stroke-width="3.5"/><path d="M20 25v10l9-5z" fill="#1a00ab"/></svg>',
    check: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M11 25l9 9 18-20" fill="none" stroke="#1a00ab" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    upload: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5" fill="none" stroke="#1a00ab" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" fill="none" stroke="#1a00ab" stroke-width="2.4" stroke-linecap="round"/></svg>',
    file: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="#fff" stroke="#157a43" stroke-width="2.2"/><path d="M14 3v5h5M8.5 14l2.5 2.5 4.5-5" fill="none" stroke="#157a43" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" fill="none" stroke="#1a00ab" stroke-width="2.4" stroke-linecap="round"/></svg>'
  };

  HNS.sticker = function (key, size) {
    var c = HNS.COMPS[key] || { icon: "pen", cls: "" };
    return '<span class="sticker ' + c.cls + (size ? " " + size : "") + '">' + HNS.icons[c.icon] + "</span>";
  };

  // ---------------------------------------------------------------------------
  // fees: the same rule as the spreadsheet's pricing engine
  // ---------------------------------------------------------------------------
  HNS.quote = function (keys, referral, coupon, cfg) {
    cfg = cfg || HNS.cfg || window.HNS_DEFAULTS;
    var comps = (cfg.competitions || []).filter(function (c) { return keys.indexOf(c.key) >= 0; });
    var std = comps.filter(function (c) { return !c.special; }).length;
    var spc = comps.filter(function (c) { return c.special; }).length;
    var raw = comps.reduce(function (s, c) { return s + Number(cfg.pricing.single[c.registrationName] || c.price || 0); }, 0);
    var key = "STD_" + std + "_SPC_" + Math.min(spc, 1);
    var bundle = cfg.pricing.bundles[key];
    var price = comps.length ? (bundle !== undefined ? Number(bundle) : raw) : 0;
    referral = Number(referral || 0); coupon = Number(coupon || 0);
    return {
      count: comps.length, raw: raw, price: price, bundleKey: key,
      bundleLabel: comps.length ? (cfg.pricing.bundleLabels[key] || "") : "",
      bundleDiscount: Math.max(0, raw - price), coupon: coupon, referral: referral,
      total: Math.max(0, price - coupon - referral)
    };
  };

  // ---------------------------------------------------------------------------
  // live settings from the spreadsheet
  // ---------------------------------------------------------------------------
  HNS.cfg = window.HNS_DEFAULTS;
  HNS.configReady = (HNS.api ? HNS.api.config() : Promise.resolve(window.HNS_DEFAULTS)).then(function (c) {
    HNS.cfg = c;
    document.dispatchEvent(new CustomEvent("hns:config", { detail: c }));
    return c;
  });

  function windowText(w, what) {
    if (!w) return "";
    if (w.status === "open") return w.closes ? what + " is open until " + HNS.fmtDate(w.closes, true) + "." : what + " is open.";
    if (w.status === "upcoming") return what + " opens on " + HNS.fmtDate(w.opens, true) + ".";
    if (w.status === "ended") return what + " closed on " + HNS.fmtDate(w.closes) + ".";
    if (w.status === "unknown") return "We can't reach the registration system right now. Please try again later.";
    return what + " is closed for now.";
  }
  HNS.windowText = windowText;

  function renderStatusBar(c) {
    var bar = HNS.$("#statusbar");
    if (!bar) return;
    var reg = c.registration || {}, sub = c.submission || {};
    var txt, link = "";
    if (c.preview) {
      txt = "Preview: the online forms are not connected to the registration system yet.";
      link = '<a href="register.html">Try the form</a>';
    } else if (reg.open) {
      txt = windowText(reg, "Online registration for the " + (c.event.edition || CFG.edition && CFG.edition.ordinal || "") + " Husay ng SokSay");
      link = '<a href="register.html">Register now →</a>';
    } else if (sub.open) {
      txt = windowText(sub, "Entry submission");
      link = '<a href="submit.html">Submit your entry →</a>';
    } else if (reg.status === "unknown") {
      txt = windowText(reg, "Registration");
      link = "";
    } else if (reg.status === "upcoming") {
      txt = windowText(reg, "Registration for the " + (c.event.edition || "") + " Husay ng SokSay");
      link = '<a href="competitions.html">See the competitions</a>';
    } else {
      txt = "The next Husay ng SokSay is being prepared. Follow us on Facebook for the announcement.";
      link = '<a href="' + HNS.esc(CFG.contact && CFG.contact.facebookUrl || "#") + '" target="_blank" rel="noopener">Follow us</a>';
    }
    bar.classList.toggle("is-closed", !(reg.open || sub.open || c.preview));
    bar.innerHTML = '<div class="wrap"><span class="dot" aria-hidden="true"></span><span>' + HNS.esc(txt) + "</span>" + link + "</div>";
    bar.hidden = false;
  }

  function renderStatusCards(c) {
    HNS.$$("[data-status]").forEach(function (el) {
      var which = el.getAttribute("data-status");
      var w = c[which] || {};
      var label = which === "submission" ? "Entry submission" : "Registration";
      var pill = el.querySelector(".status-pill");
      var text = el.querySelector("[data-status-text]");
      var cd = el.querySelector("[data-countdown]");
      var cta = el.querySelector("[data-status-cta]");
      if (cta) cta.hidden = !(w.open || c.preview);
      if (pill) {
        var st = c.preview ? "preview" : (w.open ? "open" : (w.status || "closed"));
        pill.className = "status-pill " + (w.open || c.preview ? "open" : (w.status === "upcoming" ? "" : "closed"));
        pill.innerHTML = '<span class="dot"></span>' + HNS.esc({ open: "Open", upcoming: "Opening soon", ended: "Closed", closed: "Closed", preview: "Preview", unknown: "Offline" }[st] || "Closed");
      }
      if (text) text.textContent = c.preview ? "The online forms are in preview mode until they are connected to the spreadsheet." : windowText(w, label);
      if (cd) {
        var target = w.status === "upcoming" ? w.opens : (w.open ? w.closes : "");
        if (target && !c.preview) { cd.setAttribute("data-countdown", target); cd.hidden = false; startCountdown(cd); }
        else cd.hidden = true;
      }
    });
  }

  function renderDates(c) {
    var host = HNS.$("[data-dates]");
    if (!host || !c.dates || !c.dates.length) return;
    host.innerHTML = c.dates.map(function (d) {
      return '<li class="card card-flat"><b>' + HNS.esc(d.date) + "</b><span>" + HNS.esc(d.label) + "</span></li>";
    }).join("");
    var note = HNS.$("[data-dates-note]");
    if (note) note.textContent = "Dates of the " + (c.event.edition || "upcoming") + " Husay ng SokSay";
  }

  function renderFeeTables(c) {
    HNS.$$("[data-fee-table]").forEach(function (t) {
      var b = c.pricing.bundles;
      var rows = [
        ["1 competition", b.STD_1_SPC_0, b.STD_1_SPC_1],
        ["2 competitions", b.STD_2_SPC_0, b.STD_2_SPC_1],
        ["3 competitions", b.STD_3_SPC_0, b.STD_3_SPC_1]
      ];
      t.querySelector("tbody").innerHTML = rows.map(function (r) {
        return "<tr><td>" + r[0] + '</td><td class="num">' + HNS.peso(r[1]) + '</td><td class="num">' + HNS.peso(r[2]) + "</td></tr>";
      }).join("") + '<tr><td>Short film only</td><td class="num">—</td><td class="num">' + HNS.peso(b.STD_0_SPC_1) + "</td></tr>";
    });
    HNS.$$("[data-price]").forEach(function (el) {
      var key = el.getAttribute("data-price");
      var comp = (c.competitions || []).filter(function (x) { return x.key === key; })[0];
      if (comp) el.textContent = HNS.peso(comp.price);
    });
  }

  function renderEdition(c) {
    var E = CFG.edition || {};
    var ordinal = (c.event && c.event.edition) || E.ordinal || "";
    HNS.$$("[data-edition-ordinal]").forEach(function (el) { if (ordinal) el.textContent = ordinal; });
    var theme = HNS.$("[data-hero-theme]");
    if (theme && E.theme) {
      theme.innerHTML = "<small>" + HNS.esc(ordinal) + " Husay ng SokSay" + (E.year ? " · " + HNS.esc(E.year) : "") + "</small>“" + HNS.esc(E.theme) + "”";
    }
  }

  HNS.configReady.then(function (c) {
    renderEdition(c);
    renderStatusBar(c);
    renderStatusCards(c);
    renderDates(c);
    renderFeeTables(c);
    initCalculators();
  });

  // ---------------------------------------------------------------------------
  // navigation
  // ---------------------------------------------------------------------------
  function initNav() {
    var toggle = HNS.$(".nav-toggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        var open = !document.body.classList.contains("nav-open");
        document.body.classList.toggle("nav-open", open);
        toggle.setAttribute("aria-expanded", String(open));
      });
      HNS.$$(".nav a").forEach(function (a) {
        a.addEventListener("click", function () { document.body.classList.remove("nav-open"); toggle.setAttribute("aria-expanded", "false"); });
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && document.body.classList.contains("nav-open")) { document.body.classList.remove("nav-open"); toggle.setAttribute("aria-expanded", "false"); toggle.focus(); }
      });
    }
    var here = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    HNS.$$(".nav a").forEach(function (a) {
      if ((a.getAttribute("href") || "").toLowerCase() === here) a.setAttribute("aria-current", "page");
    });
    HNS.$$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
    HNS.$$("[data-contact]").forEach(function (el) {
      var k = el.getAttribute("data-contact"), C = CFG.contact || {};
      // links that show the address itself are updated; buttons such as "Email us" keep their words
      if (k === "participants") { el.href = "mailto:" + C.participantsEmail; if (/@/.test(el.textContent)) el.textContent = C.participantsEmail; }
      if (k === "partners") { el.href = "mailto:" + C.partnersEmail; if (/@/.test(el.textContent)) el.textContent = C.partnersEmail; }
      if (k === "facebook") { el.href = C.facebookUrl; if (!el.textContent.trim()) el.textContent = C.facebookName; }
      if (k === "instagram") { el.href = "https://www.instagram.com/" + C.instagram + "/"; if (!el.textContent.trim()) el.textContent = "@" + C.instagram; }
    });
  }

  // ---------------------------------------------------------------------------
  // countdown, count-up, reveal, parallax, marquee
  // ---------------------------------------------------------------------------
  function startCountdown(el) {
    if (el.__timer) clearInterval(el.__timer);
    var target = new Date(el.getAttribute("data-countdown")).getTime();
    function tick() {
      var left = Math.max(0, target - Date.now());
      var d = Math.floor(left / 864e5), h = Math.floor(left / 36e5) % 24, m = Math.floor(left / 6e4) % 60, s = Math.floor(left / 1e3) % 60;
      el.innerHTML = [[d, "days"], [h, "hours"], [m, "mins"], [s, "secs"]].map(function (p) {
        return "<div><b>" + String(p[0]).padStart(2, "0") + "</b><span>" + p[1] + "</span></div>";
      }).join("");
      if (!left) clearInterval(el.__timer);
    }
    tick();
    el.__timer = setInterval(tick, 1000);
  }

  function countUp(el) {
    var end = Number(el.getAttribute("data-count"));
    var prefix = el.getAttribute("data-prefix") || "", suffix = el.getAttribute("data-suffix") || "";
    if (reduceMotion) { el.textContent = prefix + end.toLocaleString("en-PH") + suffix; return; }
    var t0 = null;
    function step(t) {
      if (!t0) t0 = t;
      var p = Math.min(1, (t - t0) / 1300);
      var v = Math.round(end * (1 - Math.pow(1 - p, 3)));
      el.textContent = prefix + v.toLocaleString("en-PH") + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function initReveal() {
    var items = HNS.$$(".reveal, [data-count], .criteria");
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("in"); if (el.hasAttribute("data-count")) countUp(el); fillBars(el); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        el.classList.add("in");
        if (el.hasAttribute("data-count")) countUp(el);
        fillBars(el);
        io.unobserve(el);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });
    HNS.observe = function (el) { io.observe(el); };
  }
  function fillBars(el) {
    if (!el.classList || !el.classList.contains("criteria")) return;
    HNS.$$(".bar i", el).forEach(function (i) { i.style.width = i.getAttribute("data-w") + "%"; });
  }
  HNS.fillBars = fillBars;

  function initParallax() {
    var art = HNS.$(".hero-art");
    if (!art || reduceMotion || !window.matchMedia("(pointer: fine)").matches) return;
    var floats = HNS.$$(".float", art);
    window.addEventListener("mousemove", function (e) {
      var x = e.clientX / window.innerWidth - 0.5, y = e.clientY / window.innerHeight - 0.5;
      floats.forEach(function (f) {
        var d = Number(f.getAttribute("data-depth") || 10), r = f.getAttribute("data-rot") || "0";
        f.style.transform = "translate(" + (x * d).toFixed(1) + "px," + (y * d).toFixed(1) + "px) rotate(" + r + "deg)";
      });
    });
  }

  function initMarquee() {
    HNS.$$(".marquee-track").forEach(function (t) {
      Array.prototype.slice.call(t.children).forEach(function (ch) {
        var copy = ch.cloneNode(true);
        copy.setAttribute("aria-hidden", "true");
        t.appendChild(copy);
      });
    });
  }

  // ---------------------------------------------------------------------------
  // tabs (WAI-ARIA tabs pattern)
  // ---------------------------------------------------------------------------
  HNS.initTabs = function (list, onChange) {
    var tabs = HNS.$$('[role="tab"]', list);
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        var other = document.getElementById(t.getAttribute("aria-controls"));
        if (other && !on) other.hidden = true;
      });
      // tabs may share one panel (the Hall of Fame), so the chosen one is shown last
      var panel = document.getElementById(tab.getAttribute("aria-controls"));
      if (panel) { panel.hidden = false; HNS.$$(".criteria", panel).forEach(fillBars); }
      if (focus) tab.focus();
      if (onChange) onChange(tab);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(t); });
      t.addEventListener("keydown", function (e) {
        var k = e.key, n = null;
        if (k === "ArrowRight" || k === "ArrowDown") n = tabs[(i + 1) % tabs.length];
        if (k === "ArrowLeft" || k === "ArrowUp") n = tabs[(i - 1 + tabs.length) % tabs.length];
        if (k === "Home") n = tabs[0];
        if (k === "End") n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); select(n, true); }
      });
    });
    return { select: select, tabs: tabs };
  };

  // ---------------------------------------------------------------------------
  // fee calculator
  // ---------------------------------------------------------------------------
  function initCalculators() {
    HNS.$$("[data-calc]").forEach(function (calc) {
      if (calc.__init) return;
      calc.__init = true;
      var boxes = HNS.$$('input[type="checkbox"]', calc);
      var out = HNS.$("[data-calc-out]", calc);
      function update() {
        var keys = boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; });
        var q = HNS.quote(keys, 0, 0);
        var go = HNS.$("[data-calc-go]", calc);
        if (!keys.length) {
          out.innerHTML = '<div class="big">₱0</div><span class="bundle muted">Pick the competitions you want to join.</span>';
          if (go) go.setAttribute("href", "register.html");
          return;
        }
        out.innerHTML = '<div class="big">' + HNS.peso(q.price) + "</div>" +
          '<span class="bundle tag tag-yellow">' + HNS.esc(q.bundleLabel.replace(/\s*\(₱[\d,]+\)$/, "")) + "</span>" +
          (q.bundleDiscount ? '<span class="save">You save ' + HNS.peso(q.bundleDiscount) + " with the bundle</span>" : "");
        if (go) go.setAttribute("href", "register.html?pick=" + keys.join(","));
      }
      boxes.forEach(function (b) { b.addEventListener("change", update); });
      update();
    });
  }

  // ---------------------------------------------------------------------------
  // copy buttons, toasts, confetti
  // ---------------------------------------------------------------------------
  HNS.toast = function (msg, kind) {
    var host = HNS.$(".toast-host");
    if (!host) { host = document.createElement("div"); host.className = "toast-host"; host.setAttribute("role", "status"); host.setAttribute("aria-live", "polite"); document.body.appendChild(host); }
    var t = document.createElement("div");
    t.className = "toast" + (kind === "bad" ? " bad" : "");
    t.textContent = msg;
    host.appendChild(t);
    setTimeout(function () { t.remove(); }, 3600);
  };

  HNS.copy = function (text) {
    function done() { HNS.toast("Copied: " + text); }
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(done, fallback);
    fallback();
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { HNS.toast("Select the text and copy it.", "bad"); }
      ta.remove();
    }
  };
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-copy]");
    if (b) { e.preventDefault(); HNS.copy(b.getAttribute("data-copy")); }
  });

  HNS.confetti = function () {
    if (reduceMotion) return;
    var c = document.createElement("canvas");
    c.className = "confetti";
    document.body.appendChild(c);
    var ctx = c.getContext("2d"), W = c.width = innerWidth, H = c.height = innerHeight;
    var colors = ["#fbd23f", "#1a00ab", "#f86810", "#2bb3a0", "#ff5d8f", "#ffffff"];
    var bits = [];
    for (var i = 0; i < 160; i++) {
      bits.push({ x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 15 - 4,
        r: Math.random() * 6 + 4, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.3, col: colors[i % colors.length] });
    }
    var t0 = performance.now();
    (function frame(t) {
      ctx.clearRect(0, 0, W, H);
      bits.forEach(function (b) {
        b.vy += 0.38; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.a += b.va;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.fillStyle = b.col; ctx.strokeStyle = "#1a00ab"; ctx.lineWidth = 1.2;
        ctx.fillRect(-b.r, -b.r / 2, b.r * 2, b.r); ctx.strokeRect(-b.r, -b.r / 2, b.r * 2, b.r); ctx.restore();
      });
      if (t - t0 < 3200) requestAnimationFrame(frame); else c.remove();
    })(t0);
  };

  // ---------------------------------------------------------------------------
  // FAQ search
  // ---------------------------------------------------------------------------
  function initFaq() {
    var box = HNS.$("#faq-search");
    if (!box) return;
    var items = HNS.$$(".acc details");
    var none = HNS.$("#faq-none");
    box.addEventListener("input", function () {
      var q = box.value.trim().toLowerCase();
      var shown = 0;
      items.forEach(function (d) {
        var hit = !q || d.textContent.toLowerCase().indexOf(q) >= 0;
        d.hidden = !hit;
        if (hit) shown++;
        if (q && hit) d.open = true;
      });
      if (none) none.hidden = shown > 0;
    });
  }

  function init() {
    initNav();
    initReveal();
    initParallax();
    initMarquee();
    initFaq();
    HNS.$$('[role="tablist"][data-auto]').forEach(function (l) { HNS.initTabs(l); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
