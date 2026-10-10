// Plays the app's animated lessons in place: <figure class="lesson" data-lesson="Name">.
// lesson-loader.js loads this file when a lesson's still picture is tapped and
// calls RRLessons.play(figure). The lesson then loops through its steps, as it
// does in the app. It follows the site's light/dark theme and the visitor's
// reduced-motion setting, and only animates while it is playing and on screen.
(function () {
  "use strict";
  if (typeof LessonEngine === "undefined" || typeof LESSON_DATA === "undefined") return;
  var TONES = {
    dark:  { bg: "#0F1C2E", line: "#FFFFFF", line2: "#A7B3C4", side: "#182A42", glass: "#2C3E57", accent: "#FF6A00" },
    light: { bg: "#FFFFFF", line: "#0F1C2E", line2: "#4A5A70", side: "#DCE3EC", glass: "#DCE3EC", accent: "#B84A00" }
  };
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function theme() {
    var f = root.getAttribute("data-theme");
    if (f === "light" || f === "dark") return f;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  function paint(cv, ops, th) {
    var tones = TONES[th], k = cv.width / LessonEngine.W;
    var base = cv.getContext("2d");
    base.setTransform(1, 0, 0, 1, 0, 0);
    base.fillStyle = tones.bg; base.fillRect(0, 0, cv.width, cv.height);
    var stack = [{ ctx: base, alpha: 1 }];
    function colour(t) { return t === "bgSoft" ? tones.bg : tones[t]; }
    for (var i = 0; i < ops.length; i++) {
      var o = ops[i];
      if (o.op === "layer") {
        var off = document.createElement("canvas"); off.width = cv.width; off.height = cv.height;
        stack.push({ ctx: off.getContext("2d"), canvas: off, alpha: o.alpha }); continue;
      }
      if (o.op === "end") {
        var top = stack.pop(), under = stack[stack.length - 1].ctx;
        under.save(); under.setTransform(1, 0, 0, 1, 0, 0); under.globalAlpha = top.alpha; under.drawImage(top.canvas, 0, 0); under.restore(); continue;
      }
      var ctx = stack[stack.length - 1].ctx;
      ctx.save(); ctx.setTransform(k, 0, 0, k, 0, 0); ctx.lineJoin = "round"; ctx.lineCap = "round";
      if (o.op === "poly") {
        ctx.beginPath();
        for (var j = 0; j < o.pts.length; j++) { if (j) ctx.lineTo(o.pts[j][0], o.pts[j][1]); else ctx.moveTo(o.pts[j][0], o.pts[j][1]); }
        if (o.closed) ctx.closePath();
        if (o.fill) { ctx.globalAlpha = o.alpha * (o.fill === "bgSoft" ? 0.55 : 1); ctx.fillStyle = colour(o.fill); ctx.fill(); }
        if (o.stroke) { ctx.globalAlpha = o.alpha; ctx.strokeStyle = colour(o.stroke); ctx.lineWidth = o.width; ctx.stroke(); }
      } else if (o.op === "oval") {
        ctx.beginPath(); ctx.ellipse(o.c[0], o.c[1], o.rx, o.ry, 0, 0, 2 * Math.PI);
        if (o.fill) { ctx.globalAlpha = o.alpha * (o.fill === "bgSoft" ? 0.55 : 1); ctx.fillStyle = colour(o.fill); ctx.fill(); }
        if (o.stroke) { ctx.globalAlpha = o.alpha; ctx.strokeStyle = colour(o.stroke); ctx.lineWidth = o.width; ctx.stroke(); }
      } else if (o.op === "text") {
        ctx.globalAlpha = o.alpha; ctx.fillStyle = colour(o.tone); ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.font = o.weight + " " + o.size + "px Inter, system-ui, sans-serif";
        if ("letterSpacing" in ctx) ctx.letterSpacing = o.spacing + "px";
        ctx.fillText(o.text, o.c[0], o.c[1]);
      }
      ctx.restore();
    }
  }

  var players = [], running = false, io = null;
  function Player(fig) {
    var name = fig.getAttribute("data-lesson");
    var les = null;
    for (var i = 0; i < LESSON_DATA.lessons.length; i++) if (LESSON_DATA.lessons[i].name === name) les = LESSON_DATA.lessons[i];
    if (!les) return;
    var poster = fig.querySelector(".lesson-poster");
    var cv = document.createElement("canvas");
    cv.width = 720; cv.height = 684;
    cv.setAttribute("role", "img"); cv.setAttribute("aria-label", "Animated lesson: " + name);
    if (poster) poster.replaceWith(cv); else fig.insertBefore(cv, fig.querySelector(".lesson-line"));
    fig.classList.add("playing");
    var line = fig.querySelector(".lesson-line"), ctl = fig.querySelector(".lesson-ctl");
    var S = 0, t0 = performance.now(), paused = reduce, visible = true, buttons = [];
    var play = document.createElement("button");
    play.type = "button"; play.className = "lesson-btn lesson-play";
    ctl.appendChild(play);
    les.steps.forEach(function (st, i) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "lesson-btn"; b.textContent = "Step " + (i + 1);
      b.addEventListener("click", function () { line.setAttribute("aria-live", "polite"); show(i); });
      ctl.appendChild(b); buttons.push(b);
    });
    function label() { play.textContent = paused ? "Play" : "Pause"; play.setAttribute("aria-label", (paused ? "Play " : "Pause ") + name); }
    play.addEventListener("click", function () { paused = !paused; t0 = performance.now(); label(); draw(); kick(); });
    function now() { return paused ? null : ((performance.now() - t0) / 1000) % LESSON_DATA.loop; }
    function draw() {
      var th = theme(), t = now(), st = les.steps[S];
      fig.style.background = TONES[th].bg;
      paint(cv, LessonEngine.frame(LESSON_DATA, les, S, paused ? (st.stillT || 0) : t, paused), th);
    }
    function show(i) {
      S = i; t0 = performance.now();
      line.textContent = "Step " + (S + 1) + " of " + les.steps.length + ": " + les.steps[S].line;
      buttons.forEach(function (b, k) { b.setAttribute("aria-pressed", k === S ? "true" : "false"); });
      draw();
    }
    this.active = function () { return visible && !paused; };
    this.tick = function () {
      if (!visible || paused) return;
      if ((performance.now() - t0) / 1000 >= LESSON_DATA.loop) { show((S + 1) % les.steps.length); return; }
      draw();
    };
    this.redraw = draw;
    this.setVisible = function (v) { visible = v; if (v) kick(); };
    this.fig = fig;
    label(); show(0);
    players.push(this);
    if (io) io.observe(fig);
    play.focus();
  }

  // The animation loop runs only while a lesson is playing on screen.
  function kick() {
    if (running) return;
    running = true;
    (function loop() {
      var any = false;
      players.forEach(function (p) { p.tick(); if (p.active()) any = true; });
      if (any) requestAnimationFrame(loop); else running = false;
    })();
  }

  if ("IntersectionObserver" in window) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { players.forEach(function (p) { if (p.fig === e.target) p.setVisible(e.isIntersecting); }); });
    });
  }
  new MutationObserver(function () { players.forEach(function (p) { p.redraw(); }); })
    .observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: light)");
    if (mq.addEventListener) mq.addEventListener("change", function () { players.forEach(function (p) { p.redraw(); }); });
  }

  window.RRLessons = {
    play: function (fig) {
      for (var i = 0; i < players.length; i++) if (players[i].fig === fig) return;
      new Player(fig); kick();
    }
  };
})();
