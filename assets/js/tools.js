// Small page tools: the wedge finder (bracket page) and the FAQ filter.
(function () {
  "use strict";

  // ---------------------------------------------------------------- wedge finder
  // Bands are 3 mm of the phone's width in its case: 67-70 ... 88-91.
  // On an exact boundary either band fits; a short wedge takes the narrower one.
  function wedgeFinder(form) {
    var width = form.querySelector("#wf-width"), unit = form.querySelector("#wf-unit"),
        left = form.querySelector("#wf-left"), out = form.querySelector("#wf-result");
    function result() {
      var raw = parseFloat(String(width.value).replace(",", "."));
      if (!isFinite(raw) || raw <= 0) { out.innerHTML = "<p class=\"rr-muted\">Type your phone&rsquo;s width, measured with its case on, at the widest point.</p>"; return; }
      var mm = unit.value === "in" ? raw * 25.4 : raw;
      var shown = unit.value === "in" ? raw + " in (" + mm.toFixed(1) + " mm)" : mm.toFixed(1).replace(/\.0$/, "") + " mm";
      var set = left.checked ? "short" : "long";
      if (mm < 67) {
        out.innerHTML = "<p><strong>" + shown + " is narrower than the bracket takes.</strong> The wedges cover phones 67 to 91 mm wide in their case. A thicker case may bring it into range. Otherwise the bracket would need a narrower pocket.</p>";
        return;
      }
      if (mm > 91) {
        out.innerHTML = "<p><strong>" + shown + " is wider than the bracket takes.</strong> The wedges cover phones 67 to 91 mm wide in their case. A slimmer case may bring it into range.</p>";
        return;
      }
      var k = Math.floor((mm - 67) / 3);
      var onEdge = Math.abs((mm - 67) / 3 - Math.round((mm - 67) / 3)) < 1e-9 && mm > 67 && mm < 91;
      if (onEdge && set === "short") k = Math.round((mm - 67) / 3) - 1;
      if (k > 7) k = 7;
      var lo = 67 + 3 * k, band = lo + "-" + (lo + 3);
      var html = "<p class=\"wf-answer\">Print <strong>wedge " + band + "</strong> from the <strong>" + set + " set</strong>.</p>" +
        "<p class=\"rr-muted\">File name: <code>wedge_" + band + "_" + set + "</code>. The band is engraved on the wedge&rsquo;s top.</p>";
      if (onEdge) html += "<p class=\"rr-muted\">" + shown + " is exactly on a boundary, so either neighbouring band fits." + (set === "short" ? " A short wedge takes the narrower band, which sits further back." : "") + "</p>";
      if (set === "short") html += "<p class=\"rr-muted\">If the short wedge presses a button, the phone is a little narrower than measured: use the next band down.</p>";
      out.innerHTML = html;
    }
    ["input", "change"].forEach(function (ev) { form.addEventListener(ev, result); });
    form.addEventListener("submit", function (e) { e.preventDefault(); result(); });
    result();
  }

  // ---------------------------------------------------------------- FAQ filter
  function faqFilter(input) {
    var items = document.querySelectorAll(".faq details"), groups = document.querySelectorAll(".faq-group"),
        count = document.getElementById("faq-count");
    function norm(s) { return s.toLowerCase().replace(/[‘’]/g, "'"); }
    function run() {
      var q = norm(input.value.trim()), words = q.split(/\s+/).filter(Boolean), shown = 0;
      items.forEach(function (d) {
        var text = norm(d.textContent), hit = words.every(function (w) { return text.indexOf(w) >= 0; });
        d.hidden = !hit; if (hit) shown++;
        if (words.length && hit) d.open = true; else if (!words.length) d.open = false;
      });
      groups.forEach(function (g) { g.hidden = !g.querySelector("details:not([hidden])"); });
      if (count) count.textContent = words.length ? (shown === 1 ? "1 answer" : shown + " answers") + " found" : "";
    }
    input.addEventListener("input", run);
  }

  function start() {
    var f = document.getElementById("wedge-finder"); if (f) wedgeFinder(f);
    var q = document.getElementById("faq-search"); if (q) faqFilter(q);
    // open a FAQ answer linked by #id
    if (location.hash) { var d = document.getElementById(location.hash.slice(1)); if (d && d.tagName === "DETAILS") d.open = true; }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
