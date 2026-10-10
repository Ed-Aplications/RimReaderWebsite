// Lessons start as a still picture. Tapping one loads the lesson scripts
// (once per page) and plays it in place, so pages with lessons stay light.
(function () {
  "use strict";
  var loading = null;
  function load() {
    if (loading) return loading;
    var holder = document.getElementById("lesson-engine");
    var srcs = holder ? holder.getAttribute("data-src").split(" ") : [];
    loading = srcs.reduce(function (p, src) {
      return p.then(function () {
        return new Promise(function (ok, fail) {
          var s = document.createElement("script");
          s.src = src; s.onload = ok; s.onerror = fail;
          document.head.appendChild(s);
        });
      });
    }, Promise.resolve());
    return loading;
  }
  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest(".lesson-poster");
    if (!btn) return;
    var fig = btn.closest("figure.lesson");
    btn.setAttribute("aria-busy", "true");
    load().then(function () { if (window.RRLessons) window.RRLessons.play(fig); })
      .catch(function () { btn.removeAttribute("aria-busy"); });
  });
})();
