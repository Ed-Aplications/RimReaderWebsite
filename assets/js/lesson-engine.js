// Copied from the Rim Reader app's lesson engine (docs/design/tutorial/lesson-engine.js),
// the same drawing code the app's lessons are checked against. Do not edit here.
// Rim Reader lesson engine: the reference implementation.
//
// docs/design/tutorial/tutorial-coding-plan.md §3. The app's
// lib/features/help/lessons/lesson_engine.dart is a line-for-line port of
// this file; test/lesson_engine_cases.json holds this engine's output for a
// set of engine cases and lesson_reference_test checks the port against it.
// Change one, change the other, and re-export the cases
// (app/tools/export-lesson-engine-cases.py).
//
// Input: one lesson of the lesson data (app/tools/build-lessons.py), a step
// index, a time t in seconds and `still` (reduced motion). Output: a display
// list in points of a 360 x 342 canvas, colours as tone names: bg, bgSoft
// (bg at 55 %, under a fingertip), line, line2, side, glass, accent.
"use strict";
const LessonEngine = (function () {
  const W = 360, H = 342, MARGIN = 10;
  const OUTLINE = 2.0, DETAIL = 1.3, ARROW_W = 2.4, DASH = 5, GAP = 5, HEAD = 8.5;
  const TOUCH = 0.01;      // mm: a vertex this close to a face plane counts as outside it
  const SHARP = 0.5;       // rad: an edge between two visible faces is stroked above this

  // ---------- vectors and matrices (3 x 3, row-major arrays of rows) ----------
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const norm = a => { const l = Math.sqrt(dot(a, a)); return l > 0 ? scale(a, 1 / l) : [0, 0, 0]; };
  const IDENT = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  function rot(axis, deg) {
    const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    if (axis === "x") return [[1, 0, 0], [0, c, -s], [0, s, c]];
    if (axis === "y") return [[c, 0, s], [0, 1, 0], [-s, 0, c]];
    return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
  }
  function mmul(A, B) {
    const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
      M[i][j] = A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j];
    return M;
  }
  const mapply = (M, p) => [dot(M[0], p), dot(M[1], p), dot(M[2], p)];

  // ---------- time ----------
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  function ease(name, x) {
    x = clamp(x, 0, 1);
    if (name === "inOut") return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    if (name === "out") return 1 - Math.pow(1 - x, 3);
    if (name === "in") return x * x * x;
    return x;
  }
  const lerpV = (a, b, k) => Array.isArray(a) ? a.map((x, i) => x + (b[i] - x) * k) : a + (b - a) * k;
  // A track is a constant (number or array) or {k: [[t, value, ease], ...]}.
  function track(tr, t, dflt) {
    if (tr === undefined || tr === null) return dflt;
    if (typeof tr === "number" || Array.isArray(tr)) return tr;
    const k = tr.k;
    if (t <= k[0][0]) return k[0][1];
    for (let i = 1; i < k.length; i++) {
      if (t <= k[i][0]) {
        const span = k[i][0] - k[i - 1][0];
        const x = span > 0 ? (t - k[i - 1][0]) / span : 1;
        return lerpV(k[i - 1][1], k[i][1], ease(k[i][2] || "linear", x));
      }
    }
    return k[k.length - 1][1];
  }

  // ---------- camera ----------
  function camera(cam) {
    const y = cam.yaw * Math.PI / 180, p = cam.pitch * Math.PI / 180;
    const cy = Math.cos(y), sy = Math.sin(y), cp = Math.cos(p), sp = Math.sin(p);
    return {
      raw: q => { const x = q[0] * cy + q[1] * sy, d = -q[0] * sy + q[1] * cy; return [x, -(q[2] * cp + d * sp)]; },
      c: [sy * cp, -cy * cp, sp],
    };
  }
  // The lesson's world box, fitted into the canvas less the margin; the same
  // for every step and every moment.
  function fit(lesson) {
    const cam = camera(lesson.camera), [a, b] = lesson.frame;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const x of [a[0], b[0]]) for (const y of [a[1], b[1]]) for (const z of [a[2], b[2]]) {
      const s = cam.raw([x, y, z]);
      x0 = Math.min(x0, s[0]); x1 = Math.max(x1, s[0]); y0 = Math.min(y0, s[1]); y1 = Math.max(y1, s[1]);
    }
    const k = Math.min((W - 2 * MARGIN) / (x1 - x0), (H - 2 * MARGIN) / (y1 - y0));
    const ox = (W - (x1 - x0) * k) / 2 - x0 * k, oy = (H - (y1 - y0) * k) / 2 - y0 * k;
    return { cam, k, P: q => { const s = cam.raw(q); return [s[0] * k + ox, s[1] * k + oy]; } };
  }

  // ---------- actors ----------
  // world = M p + o, with M = R * s and o = pos - M pivot, then the parent's.
  function transforms(step, t) {
    const out = {};
    const get = id => {
      if (out[id]) return out[id];
      const a = step.actors.find(x => x.id === id);
      let R = IDENT;
      for (const r of a.rot || []) R = mmul(rot(r.axis, track(r.deg, t, 0)), R);
      const s = a.scale || 1;
      const M = R.map(row => row.map(v => v * s));
      const pos = track(a.pos, t, [0, 0, 0]), pivot = a.pivot || [0, 0, 0];
      let tf = { M, o: sub(pos, mapply(M, pivot)) };
      if (a.parent) { const p = get(a.parent); tf = { M: mmul(p.M, tf.M), o: add(mapply(p.M, tf.o), p.o) }; }
      out[id] = tf;
      return tf;
    };
    for (const a of step.actors) get(a.id);
    return out;
  }
  const apply = (tf, p) => add(mapply(tf.M, p), tf.o);

  // ---------- solids ----------
  // A prism's faces: 0 = bottom cap, 1 = top cap, 2 + i = side i (edge i -> i+1).
  function buildSolid(sol, tf, F) {
    const n = sol.poly.length;
    if (sol.kind === "flat") {
      const v = sol.poly.map(p => apply(tf, [p[0], p[1], sol.z]));
      const nrm = norm(mapply(tf.M, [0, 0, 1]));
      return { sol, kind: "flat", verts: v, faces: [{ n: nrm, p: v[0] }, { n: scale(nrm, -1), p: v[0] }], scr: v.map(F.P) };
    }
    const bot = sol.poly.map(p => apply(tf, [p[0], p[1], sol.z[0]]));
    const top = sol.poly.map(p => apply(tf, [p[0], p[1], sol.z[1]]));
    const up = norm(mapply(tf.M, [0, 0, 1]));
    const faces = [{ n: scale(up, -1), p: bot[0] }, { n: up, p: top[0] }];
    for (let i = 0; i < n; i++) {
      const a = sol.poly[i], b = sol.poly[(i + 1) % n];
      faces.push({ n: norm(mapply(tf.M, [b[1] - a[1], -(b[0] - a[0]), 0])), p: bot[i] });
    }
    const verts = bot.concat(top);
    return { sol, kind: "prism", verts, bot, top, faces, scr: verts.map(F.P) };
  }

  function bbox(pts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    return [x0, y0, x1, y1];
  }
  // -1: A is drawn before B; 1: after; 0: no separating face found.
  function sepOrder(A, B, c) {
    const outside = (verts, f) => verts.every(q => dot(f.n, sub(q, f.p)) >= -TOUCH);
    for (const f of A.faces) if (outside(B.verts, f)) {
      const d = dot(f.n, c);
      if (d > 1e-9) return -1;
      if (d < -1e-9) return 1;
    }
    for (const f of B.faces) if (outside(A.verts, f)) {
      const d = dot(f.n, c);
      if (d > 1e-9) return 1;
      if (d < -1e-9) return -1;
    }
    return 0;
  }
  // Stable topological order; a cycle falls back to the farthest centroid.
  function drawOrder(items, c) {
    const N = items.length, after = items.map(() => []), indeg = new Array(N).fill(0);
    for (const it of items) { it.bb = bbox(it.scr); it.depth = dot(it.verts.reduce((s, v) => add(s, v), [0, 0, 0]).map(x => x / it.verts.length), c); }
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      const a = items[i].bb, b = items[j].bb;
      if (a[2] < b[0] - 0.5 || b[2] < a[0] - 0.5 || a[3] < b[1] - 0.5 || b[3] < a[1] - 0.5) continue;
      const s = sepOrder(items[i], items[j], c);
      if (s < 0) { after[i].push(j); indeg[j]++; } else if (s > 0) { after[j].push(i); indeg[i]++; }
    }
    const done = new Array(N).fill(false), out = [];
    for (let n = 0; n < N; n++) {
      let pick = -1;
      for (let i = 0; i < N; i++) if (!done[i] && indeg[i] === 0) { pick = i; break; }
      if (pick < 0) for (let i = 0; i < N; i++) if (!done[i] && (pick < 0 || items[i].depth < items[pick].depth)) pick = i;
      done[pick] = true; out.push(items[pick]);
      for (const j of after[pick]) indeg[j]--;
    }
    return out;
  }

  // Edges to stroke, chained into polylines. Keys: bottom i = i, top i = n + i.
  function strokeChains(it, vis) {
    const n = it.sol.poly.length, segs = [];
    const want = (f1, f2) => {
      const a = vis[f1], b = vis[f2];
      if (a !== b) return true;
      if (!a) return false;
      return Math.acos(clamp(dot(it.faces[f1].n, it.faces[f2].n), -1, 1)) > SHARP;
    };
    for (let i = 0; i < n; i++) if (want(0, 2 + i)) segs.push([i, (i + 1) % n]);
    for (let i = 0; i < n; i++) if (want(1, 2 + i)) segs.push([n + i, n + (i + 1) % n]);
    for (let i = 0; i < n; i++) if (want(2 + (i - 1 + n) % n, 2 + i)) segs.push([i, n + i]);
    const used = new Array(segs.length).fill(false), at = {};
    segs.forEach((s, k) => { (at[s[0]] = at[s[0]] || []).push(k); (at[s[1]] = at[s[1]] || []).push(k); });
    const next = v => { for (const k of at[v]) if (!used[k]) return k; return -1; };
    const chains = [];
    for (let k0 = 0; k0 < segs.length; k0++) {
      if (used[k0]) continue;
      used[k0] = true;
      const ch = [segs[k0][0], segs[k0][1]];
      for (let k; (k = next(ch[ch.length - 1])) >= 0;) { used[k] = true; ch.push(segs[k][0] === ch[ch.length - 1] ? segs[k][1] : segs[k][0]); }
      for (let k; (k = next(ch[0])) >= 0;) { used[k] = true; ch.unshift(segs[k][0] === ch[0] ? segs[k][1] : segs[k][0]); }
      const closed = ch.length > 3 && ch[0] === ch[ch.length - 1];
      if (closed) ch.pop();
      chains.push({ pts: ch, closed });
    }
    return chains;
  }

  // ---------- ops ----------
  const R2 = x => Math.round(x * 100) / 100;
  const pt = p => [R2(p[0]), R2(p[1])];
  const poly = (pts, closed, fill, stroke, width, alpha) =>
    ({ op: "poly", pts: pts.map(pt), closed, fill: fill || null, stroke: stroke || null, width: stroke ? width : 0, alpha: R2(alpha === undefined ? 1 : alpha) });
  const oval = (c, rx, ry, fill, stroke, width, alpha) =>
    ({ op: "oval", c: pt(c), rx: R2(rx), ry: R2(ry), fill: fill || null, stroke: stroke || null, width: stroke ? width : 0, alpha: R2(alpha === undefined ? 1 : alpha) });
  const text = (c, s, size, weight, spacing, tone, alpha) =>
    ({ op: "text", c: pt(c), text: s, size, weight, spacing, tone, alpha: R2(alpha === undefined ? 1 : alpha) });

  function circle3(c, e1, e2, r, seg) {
    const out = [];
    for (let i = 0; i < seg; i++) {
      const a = 2 * Math.PI * i / seg;
      out.push(add(c, add(scale(e1, r * Math.cos(a)), scale(e2, r * Math.sin(a)))));
    }
    return out;
  }

  function detailOps(it, tf, F, z, lineTone, ops) {
    const self = t => (t === "self" ? lineTone : t);
    for (const d of it.sol.detail || []) {
      const a = d.a === undefined ? 1 : d.a;
      if (d.k === "poly") {
        ops.push(poly(d.pts.map(p => F.P(apply(tf, [p[0], p[1], z]))), !!d.closed, d.fill, self(d.stroke), d.w || DETAIL, a));
      } else if (d.k === "circle") {
        const pts = circle3([d.c[0], d.c[1], z], [1, 0, 0], [0, 1, 0], d.r, d.seg || 32).map(p => F.P(apply(tf, p)));
        ops.push(poly(pts, true, d.fill, self(d.stroke), d.w || DETAIL, a));
      } else if (d.k === "text") {
        ops.push(text(F.P(apply(tf, [d.at[0], d.at[1], z])), d.text, d.size || 9, d.weight || 600, d.spacing || 0, self(d.tone || "line2"), a));
      }
    }
  }

  function solidOps(it, tf, F, alpha, role, ops) {
    const sol = it.sol;
    const lineTone = role === "act" ? "accent" : (sol.line || "line");
    const width = sol.w || OUTLINE;
    if (alpha < 1) ops.push({ op: "layer", alpha: R2(alpha) });
    if (it.kind === "flat") {
      ops.push(poly(it.scr, true, sol.fill || "bg", lineTone, width, 1));
      detailOps(it, tf, F, sol.z, lineTone, ops);
    } else {
      const c = F.cam.c, vis = it.faces.map(f => dot(f.n, c) > 1e-6), n = sol.poly.length;
      const B = i => it.scr[i], T = i => it.scr[n + i];
      for (let i = 0; i < n; i++) if (vis[2 + i]) ops.push(poly([B(i), B((i + 1) % n), T((i + 1) % n), T(i)], true, sol.side || "side", null, 0, 1));
      if (vis[0]) ops.push(poly(sol.poly.map((_, i) => B(i)), true, sol.cap || "bg", null, 0, 1));
      if (vis[1]) ops.push(poly(sol.poly.map((_, i) => T(i)), true, sol.cap || "bg", null, 0, 1));
      for (const ch of strokeChains(it, vis)) ops.push(poly(ch.pts.map(k => it.scr[k]), ch.closed, null, lineTone, width, 1));
      const capOn = sol.detailCap === "bottom" ? 0 : 1;
      if (vis[capOn]) detailOps(it, tf, F, sol.z[capOn], lineTone, ops);
    }
    if (alpha < 1) ops.push({ op: "end" });
  }

  // ---------- overlays ----------
  function dashed(pts, alpha, ops) {
    // The body is cut into dashes here so both engines draw the same segments.
    let on = true, left = DASH, cur = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      let a = pts[i - 1];
      const b = pts[i];
      let segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
      while (segLen > 1e-9) {
        const step = Math.min(left, segLen), k = step / segLen;
        const m = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
        if (on) cur.push(m);
        left -= step; segLen -= step; a = m;
        if (left <= 1e-9) {
          if (on && cur.length > 1) ops.push(poly(cur, false, null, "accent", ARROW_W, alpha));
          on = !on; left = on ? DASH : GAP; cur = [m];
        }
      }
    }
    if (on && cur.length > 1) ops.push(poly(cur, false, null, "accent", ARROW_W, alpha));
  }
  function arrowOps(s, alpha, ops) {
    if (alpha <= 0.01 || s.length < 2) return;
    const a = s[s.length - 2], b = s[s.length - 1];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const head = [b, [b[0] - HEAD * Math.cos(ang - 0.45), b[1] - HEAD * Math.sin(ang - 0.45)],
      [b[0] - HEAD * Math.cos(ang + 0.45), b[1] - HEAD * Math.sin(ang + 0.45)]];
    const body = s.slice(0, -1).concat([[b[0] - HEAD * 0.8 * Math.cos(ang), b[1] - HEAD * 0.8 * Math.sin(ang)]]);
    dashed(body, alpha, ops);
    ops.push(poly(head, true, "accent", null, 0, alpha));
  }
  function arcPoints(o) {
    const pts = [], n = Math.max(2, Math.ceil(Math.abs(o.a1 - o.a0) / 5));
    for (let i = 0; i <= n; i++) {
      const a = (o.a0 + (o.a1 - o.a0) * i / n) * Math.PI / 180;
      pts.push(add(o.c, add(scale(o.e1, o.r * Math.cos(a)), scale(o.e2, o.r * Math.sin(a)))));
    }
    return pts;
  }
  function fingerOps(c, press, alpha, ops) {
    if (alpha <= 0.01) return;
    const sc = 1 - 0.18 * press;
    if (press > 0.02) ops.push(oval(c, 12 + 17 * press, (12 + 17 * press) * 0.72, null, "accent", 1.8, alpha * (1 - press)));
    ops.push(oval(c, 12 * sc, 8.64 * sc, "bgSoft", "accent", 2.6, alpha));
    ops.push(oval([c[0], c[1] - 1.4], 5 * sc, 3.1 * sc, null, "accent", 1.4, alpha * 0.8));
  }
  function fingerShapeOps(tip, dir, alpha, ops) {
    if (alpha <= 0.01) return;
    // A finger lying along `dir` (screen), its tip at `tip`: a capsule 64 x 14.
    const L = 64, r = 7, ux = dir[0], uy = dir[1], px = -uy, py = ux;
    const base = [tip[0] - ux * (L - r), tip[1] - uy * (L - r)], end = [tip[0] - ux * r, tip[1] - uy * r];
    const pts = [];
    const a0 = Math.atan2(py, px);
    for (let i = 0; i <= 8; i++) { const a = a0 - Math.PI * i / 8; pts.push([end[0] + r * Math.cos(a), end[1] + r * Math.sin(a)]); }
    for (let i = 0; i <= 8; i++) { const a = a0 + Math.PI - Math.PI * i / 8; pts.push([base[0] + r * Math.cos(a), base[1] + r * Math.sin(a)]); }
    ops.push(poly(pts, true, "bgSoft", "accent", 2.2, alpha));
    ops.push(oval([tip[0] - ux * 6.5, tip[1] - uy * 6.5], 3.6, 3.6, null, "accent", 1.3, alpha * 0.8));
  }

  function overlayOps(o, tfs, F, t, still, stillT, ops) {
    const tf = o.parent ? tfs[o.parent] : null;
    const W3 = p => (tf ? apply(tf, p) : p);
    const tt = still ? stillT : t;
    if (o.only === "still" && !still) return;
    if (o.only === "moving" && still) return;
    let alpha = still && o.still ? 1 : track(o.alpha, tt, 1);
    if (alpha <= 0.01) return;
    switch (o.kind) {
      case "arrow": arrowOps(o.points.map(p => F.P(W3(p))), alpha, ops); break;
      case "arcArrow": arrowOps(arcPoints(o).map(p => F.P(W3(p))), alpha, ops); break;
      case "finger": fingerOps(F.P(W3(track(o.at, tt))), track(o.press, tt, 0), alpha, ops); break;
      case "fingerShape": {
        const a = F.P(W3(o.from)), b = F.P(W3(o.to)), s = track(o.slide, tt, 1);
        const d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(d[0], d[1]);
        fingerShapeOps([a[0] + d[0] * s, a[1] + d[1] * s], [d[0] / l, d[1] / l], alpha, ops);
        break;
      }
      case "click": {
        if (still) break;
        const u = (t - o.t0) / 0.5;
        if (u <= 0 || u >= 1) break;
        const rx = 7 + 22 * u;
        ops.push(oval(F.P(W3(o.at)), rx, rx * (o.squash || 0.7), null, "accent", 2.2, alpha * (1 - u)));
        break;
      }
      case "timer": {
        const frac = clamp(track(o.frac, tt, 0), 0, 1), e1 = o.e1 || [1, 0, 0], e2 = o.e2 || [0, 1, 0];
        ops.push(poly(circle3(o.c, e1, e2, o.r, 48).map(p => F.P(W3(p))), true, null, "line2", DETAIL, alpha * 0.5));
        if (frac > 0.005) {
          const n = Math.max(2, Math.ceil(48 * frac)), pts = [];
          for (let i = 0; i <= n; i++) {
            const a = Math.PI / 2 - 2 * Math.PI * frac * i / n;
            pts.push(F.P(W3(add(o.c, add(scale(e1, o.r * Math.cos(a)), scale(e2, o.r * Math.sin(a)))))));
          }
          ops.push(poly(pts, false, null, "line2", ARROW_W, alpha));
        }
        break;
      }
      case "buzz": {
        let k = 0;
        if (still) k = 1;
        else for (const t0 of o.times) { const u = (t - t0) / 0.6; if (u > 0 && u < 1) k = Math.max(k, Math.sin(Math.PI * u)); }
        if (k <= 0.01) break;
        const c = F.P(W3(o.at)), gap = o.gap || 22;
        for (const side of [-1, 1]) for (let j = 0; j < 3; j++) {
          const r = 6 + 5 * j, pts = [];
          for (let i = 0; i <= 6; i++) {
            const a = (side < 0 ? Math.PI : 0) + (-0.6 + 1.2 * i / 6);
            pts.push([c[0] + side * gap + r * Math.cos(a), c[1] + r * Math.sin(a)]);
          }
          ops.push(poly(pts, false, null, "line2", 1.6, alpha * k));
        }
        break;
      }
      case "label":
        ops.push(text(F.P(W3(o.at)), o.text, o.size || 13, o.weight || 700, o.spacing || 0, o.tone || "line2", alpha));
        break;
      case "dot": {
        const at = W3(track(o.at, tt)), e1 = tf ? norm(mapply(tf.M, [1, 0, 0])) : [1, 0, 0], e2 = tf ? norm(mapply(tf.M, [0, 1, 0])) : [0, 1, 0];
        ops.push(poly(circle3(at, e1, e2, o.r, 16).map(F.P), true, o.tone || "line", null, 0, alpha));
        break;
      }
      case "mark": {
        // A short straight stroke in 3D (a level's tick, a tread line).
        ops.push(poly([F.P(W3(o.from)), F.P(W3(o.to))], false, null, o.tone || "line2", o.w || DETAIL, alpha));
        break;
      }
      case "pointer": {
        // A solid arrow in a quiet tone: the FRONT mark's.
        const s = o.points.map(p => F.P(W3(p))), a = s[s.length - 2], b = s[s.length - 1];
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), h = 7;
        const body = s.slice(0, -1).concat([[b[0] - h * 0.8 * Math.cos(ang), b[1] - h * 0.8 * Math.sin(ang)]]);
        ops.push(poly(body, false, null, o.tone || "line2", OUTLINE, alpha));
        ops.push(poly([b, [b[0] - h * Math.cos(ang - 0.5), b[1] - h * Math.sin(ang - 0.5)],
          [b[0] - h * Math.cos(ang + 0.5), b[1] - h * Math.sin(ang + 0.5)]], true, o.tone || "line2", null, 0, alpha));
        break;
      }
      case "ring": {
        // A circle in 3D in a quiet tone: marks a place (the prong noses).
        const pts = circle3(o.c, o.e1 || [1, 0, 0], o.e2 || [0, 1, 0], o.r, 32).map(p => F.P(W3(p)));
        ops.push(poly(pts, true, null, o.tone || "line2", o.w || DETAIL, alpha));
        break;
      }
    }
  }

  // A solid's footprint flattened onto z = o.z, as its convex hull: shows
  // where a lifted part will land.
  function hull(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  function shadowOps(o, data, step, tfs, F, tt, ops) {
    const a = step.actors.find(x => x.id === o.of);
    if (!a || track(a.alpha, tt, 1) <= 0.01) return;
    const sol = data.models[a.model].find(x => x.id === (o.solid || "deck"));
    const pts = [];
    for (const z of sol.z) for (const q of sol.poly) { const w = apply(tfs[a.id], [q[0], q[1], z]); pts.push(F.P([w[0], w[1], o.z || 0])); }
    ops.push(poly(hull(pts), true, "side", null, 0, track(o.alpha, tt, 1)));
  }

  // ---------- one frame ----------
  function frame(data, lesson, stepIndex, t, still) {
    const step = lesson.steps[stepIndex];
    const F = fit(lesson);
    const stillT = step.stillT;
    const tt = still ? stillT : t;
    const tfs = transforms(step, tt);
    const ops = [], items = [];
    // Every op names where it came from (src): the actor's id, or the
    // overlay's kind. The checks use it; the painter ignores it.
    const tag = (from, src) => { for (let i = from; i < ops.length; i++) ops[i].src = src; };
    for (const a of step.actors) {
      const alpha = track(a.alpha, tt, 1);
      if (alpha <= 0.01) continue;
      for (const sol of data.models[a.model]) {
        if (sol.kind === "lines") {
          const n0 = ops.length;
          for (const seg of sol.segs) ops.push(poly(seg.map(p => F.P(apply(tfs[a.id], p))), false, null, sol.tone || "line2", sol.w || DETAIL, alpha));
          tag(n0, a.id);
          continue;
        }
        const it = buildSolid(sol, tfs[a.id], F);
        it.actor = a; it.alpha = alpha;
        items.push(it);
      }
    }
    // Shadows lie on the floor, under everything that stands on it.
    for (const o of step.overlays || []) {
      if (o.kind !== "shadow") continue;
      const n0 = ops.length;
      shadowOps(o, data, step, tfs, F, still ? stillT : t, ops);
      tag(n0, "shadow@" + o.of);
    }
    for (const it of drawOrder(items, F.cam.c)) {
      const n0 = ops.length;
      solidOps(it, tfs[it.actor.id], F, it.alpha, it.actor.role, ops);
      tag(n0, it.actor.id);
    }
    for (const o of step.overlays || []) {
      if (o.kind === "shadow") continue;
      const n0 = ops.length;
      overlayOps(o, tfs, F, t, still, stillT, ops);
      tag(n0, o.parent ? o.kind + "@" + o.parent : o.kind);
    }
    return mergeLayers(ops);
  }

  // Solids fading together at the same alpha share one layer (v0.88, audit):
  // a layer per solid let the solids behind show through the ones in front
  // while they faded, and cost a layer each. An end followed straight away by
  // a layer of the same alpha is dropped, with that layer.
  function mergeLayers(ops) {
    const out = [], open = [];
    let lastEnd = null;
    for (const o of ops) {
      if (o.op === "layer") {
        if (out.length && out[out.length - 1].op === "end" && lastEnd === o.alpha) {
          out.pop(); open.push(o.alpha); lastEnd = null; continue;
        }
        open.push(o.alpha); out.push(o); lastEnd = null; continue;
      }
      if (o.op === "end") { lastEnd = open.pop(); out.push(o); continue; }
      lastEnd = null; out.push(o);
    }
    return out;
  }

  // The actors drawn orange at time t (or in the still frame): for the checks.
  function actorsDrawn(lesson, stepIndex, t, still) {
    const step = lesson.steps[stepIndex], tt = still ? step.stillT : t;
    return step.actors.filter(a => track(a.alpha, tt, 1) > 0.01).map(a => ({ id: a.id, role: a.role || "ctx", mayLeave: !!a.mayLeave }));
  }

  return { W, H, frame, fit, track, ease, rot, mmul, camera, actorsDrawn, sepOrder, drawOrder, buildSolid, transforms, strokeChains };
})();
if (typeof module !== "undefined") module.exports = LessonEngine;
