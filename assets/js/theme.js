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
