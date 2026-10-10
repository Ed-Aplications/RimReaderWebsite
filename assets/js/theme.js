// Theme toggle. The page starts in the visitor's system theme (dark if none);
// the button switches it and the choice is remembered in this browser only.
(function () {
  var root = document.documentElement;
  function current() {
    var forced = root.getAttribute('data-theme');
    if (forced) return forced;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  function label(btn) {
    btn.setAttribute('aria-label', current() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.querySelector('.theme-toggle');
    if (!btn) return;
    label(btn);
    btn.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('rr-theme', next); } catch (e) {}
      label(btn);
    });
  });
})();

// A collapsible section opens when the address points at it or at something
// inside it (for example help/troubleshooting.html#phone-moved).
(function () {
  function openTarget() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    var el = document.getElementById(id);
    if (!el) return;
    for (var d = el; d; d = d.parentElement) if (d.tagName === 'DETAILS') d.open = true;
    el.scrollIntoView();
  }
  document.addEventListener('DOMContentLoaded', openTarget);
  window.addEventListener('hashchange', openTarget);
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (a && a.getAttribute('href') === location.hash) openTarget();
  });
})();
