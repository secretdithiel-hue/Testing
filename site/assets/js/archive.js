/* Hall of Fame page: edition picker and the selected edition's story (data in archive-data.js). */
(function () {
  "use strict";
  var HNS = window.HNS, esc = HNS.esc;
  var data = window.HNS_ARCHIVE || [];
  var list = document.getElementById("edition-tabs");
  var panel = document.getElementById("edition-panel");
  if (!list || !panel || !data.length) return;

  list.innerHTML = data.map(function (ed, i) {
    return '<button class="ed-btn" role="tab" id="ed-tab-' + i + '" aria-controls="edition-panel" aria-selected="' + (i === 0) + '"' + (i ? ' tabindex="-1"' : "") + '>' +
      "<b>" + esc(ed.ordinal) + "</b><span>" + esc(ed.year) + "</span></button>";
  }).join("");

  var COMP_NAMES = { ESSAY: "Essay", SPEECH: "Speech", PHOTO: "Photography", FILM: "Short film" };

  function render(i) {
    var ed = data[i];
    var placed = ed.works.filter(function (w) { return w.award; });
    var others = ed.works.filter(function (w) { return !w.award; });
    var h = [];
    h.push('<div class="card" style="padding-top:36px"><span class="card-tag">' + esc(ed.ordinal) + " Husay ng SokSay · " + esc(ed.year) + "</span>");
    h.push('<div class="grid grid-2" style="align-items:center">');
    h.push("<div>");
    h.push(ed.theme ? '<h2 style="margin-bottom:12px">“' + esc(ed.theme) + "”</h2>" : '<h2 style="margin-bottom:12px">The ' + esc(ed.ordinal) + " edition</h2>");
    if (ed.summary) h.push('<p class="lead">' + esc(ed.summary) + "</p>");
    if (ed.competitions && ed.competitions.length) {
      h.push('<div class="tags">' + ed.competitions.map(function (c) { return '<span class="tag">' + esc(c) + "</span>"; }).join("") + "</div>");
    }
    h.push("</div><div>");
    if (ed.logo) h.push('<img src="' + esc(ed.logo) + '" alt="' + esc(ed.ordinal) + ' Husay ng SokSay logo" width="420" height="182" style="width:100%;max-width:420px;margin:0 auto 18px">');
    if (ed.facts && ed.facts.length) {
      h.push('<dl class="summary card card-flat" style="padding:12px 18px">' + ed.facts.map(function (f) {
        return '<div class="row" style="grid-template-columns:150px 1fr"><dt>' + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd></div>";
      }).join("") + "</dl>");
    }
    h.push("</div></div>");

    if (ed.highlights && ed.highlights.length) {
      h.push('<h3 style="margin-top:30px">Highlights</h3><ul class="stack">' + ed.highlights.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>");
    }
    if (placed.length) {
      h.push('<h3 style="margin-top:30px">Winners</h3><div class="works">' + placed.map(function (w) {
        return '<div class="work"><span class="badge tag tag-yellow">' + esc(w.award) + "</span><span class=\"q\">" + esc(w.title) + "</span>" +
          '<span class="s">' + esc([COMP_NAMES[w.competition], w.school].filter(Boolean).join(" · ")) + "</span></div>";
      }).join("") + "</div>");
    }
    if (others.length) {
      h.push('<h3 style="margin-top:30px">' + (placed.length ? "Also recognized" : "Recognized at the awarding ceremony") + '</h3><div class="works">' + others.map(function (w, k) {
        return '<div class="work ' + (k % 2 ? "tilt-r" : "tilt-l") + '"><span class="q">' + esc(w.title) + "</span>" + (w.school || w.competition ? '<span class="s">' + esc([COMP_NAMES[w.competition], w.school].filter(Boolean).join(" · ")) + "</span>" : "") + "</div>";
      }).join("") + "</div>");
    }
    if (ed.schools && ed.schools.length) {
      h.push('<h3 style="margin-top:30px">Schools at the awarding</h3><div class="chips">' + ed.schools.map(function (s) { return '<span class="chip">' + esc(s) + "</span>"; }).join("") + "</div>");
    }
    if (!placed.length && !others.length && !(ed.highlights || []).length) {
      h.push('<p class="muted" style="margin-top:24px">Results of this edition are being collected. Were you there? Send us photos and results.</p>');
    }
    if (ed.sources && ed.sources.length) {
      h.push('<h3 style="margin-top:30px">Sources</h3><ul class="small">' + ed.sources.map(function (s) {
        return '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + "</a></li>";
      }).join("") + "</ul>");
    }
    h.push("</div>");
    panel.innerHTML = h.join("");
    panel.setAttribute("aria-labelledby", "ed-tab-" + i);
    if (panel.animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      panel.animate([{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], { duration: 320, easing: "ease-out" });
    }
  }

  var tabs = HNS.initTabs(list, function (tab) {
    var i = Number(tab.id.replace("ed-tab-", ""));
    render(i);
    if (history.replaceState) history.replaceState(null, "", "#" + data[i].ordinal);
  });
  var start = Math.max(0, data.map(function (d) { return d.ordinal; }).indexOf(location.hash.replace("#", "")));
  tabs.select(tabs.tabs[start]);
})();
