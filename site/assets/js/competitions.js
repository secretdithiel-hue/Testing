/* Competitions page: the tab for #essay / #speech / #photo / #film opens from the address. */
(function () {
  "use strict";
  var HNS = window.HNS;
  var list = document.getElementById("comp-tabs");
  if (!list) return;
  var t = HNS.initTabs(list, function (tab) {
    var id = tab.getAttribute("aria-controls");
    if (history.replaceState) history.replaceState(null, "", "#" + id);
  });
  function fromHash() {
    var id = location.hash.replace("#", "");
    var tab = t.tabs.filter(function (x) { return x.getAttribute("aria-controls") === id; })[0];
    if (tab) {
      t.select(tab);
      list.scrollIntoView({ block: "start" });
    }
  }
  window.addEventListener("hashchange", fromHash);
  fromHash();
})();
