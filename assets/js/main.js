/* Batangas City — mockup 8, ink and wash.
   The page works with none of this: the drawings are complete in the markup.
   Here they are hidden first and then drawn, by time (intro, chapters) or by
   scroll (the hero). */
(() => {
  'use strict';

  const d = document;
  const root = d.documentElement;
  const $ = (s, c = d) => c.querySelector(s);
  const $$ = (s, c = d) => Array.from(c.querySelectorAll(s));
  const gsap = window.gsap;
  const ST = window.ScrollTrigger;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(hover: none), (pointer: coarse)').matches;
  const motion = !reduce && !!gsap && !!ST;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  /* Phones get plain fades instead of spreading masks. */
  const lite = () => coarse || innerWidth < 900;
  /* the wide hero (sticky, words laid over the drawing); everything else gets
     the stacked hero. Must mirror the stacked media query in style.css. */
  const WIDE = '(min-width:1101px) and (min-aspect-ratio:1001/1000)';
  const DRAW = 'path:not([data-nodraw] *):not(.route)';

  window.__drawn = true;
  if (motion) { gsap.registerPlugin(ST); ST.config({ ignoreMobileResize: true }); }
  else root.classList.remove('motion', 'is-intro');

  /* ?photo shows the officials' photographs in place of the drawn portraits */
  const photo = /[?&]photo\b/.test(location.search);
  if (photo) root.classList.add('photo');

  /* ------------------------------------------------------------ washes */
  /* One wash spreading once. */
  function bloom(el, dur = 1.5, vars = {}) {
    if (lite()) return gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: dur * 0.7, ease: 'power1.out', ...vars });
    el.classList.add('blooming');
    return gsap.fromTo(el, { '--b': 0, opacity: 1 }, {
      '--b': 1, duration: dur, ease: 'power1.out', ...vars,
      onComplete() { el.classList.remove('blooming'); el.style.removeProperty('--b'); }
    });
  }

  /* ---------------------------------------------- prologue: the globe */
  /* Natural Earth coastlines drawn in ink on a canvas: a pencil circle, a globe
     inked on it, the turn east until the islands rise over the horizon, a hold
     while the sun finds them and the pen loops them, then three falls - the
     archipelago, Batangas Bay, the shore - and the shoreline straightens into
     the first stroke of the city drawing. */
  const globe = (() => {
    const cv = $('#globe');
    if (!cv || !motion) return null;
    const ctx = cv.getContext('2d');
    const D = Math.PI / 180;
    /* pencil: the construction circle · reveal: the inking · glow: the sun on the
       islands · l0: the loop round them (0-1 drawn, 1-2 fading) · l1, l2: the labels */
    const cam = { lam: -62, phi: 28, logR: 0, rot: 0, pencil: 0, reveal: 0, glow: 0, l0: 0, l1: 0, l2: 0, fade: 1, morph: 0, on: 1 };
    const imgs = {};
    let data = null;
    let morphSrc = null;
    let morphDst = null;
    let W = 0;
    let H = 0;
    let dpr = 1;
    ['ocean', 'land', 'gold'].forEach(n => { const im = new Image(); im.src = `assets/art/wash/globe-${n}.webp`; imgs[n] = im; });
    const source = window.__coast ? Promise.resolve(window.__coast) : fetch('assets/data/coast.json').then(r => r.json());
    const loaded = source.then(d => {
      const rings = (arr, q) => arr.map(a => {
        const r = [];
        for (let i = 0; i < a.length; i += 2) {
          const lam = a[i] / q * D;
          const phi = a[i + 1] / q * D;
          r.push([lam, Math.cos(phi), Math.sin(phi), a[i] / q, a[i + 1] / q]);
        }
        return r;
      });
      data = { g: rings(d.g, 100), p: rings(d.p, 1000), b: rings(d.b, 10000), shore: rings([d.shore], 10000)[0] };
      data.g.sort((a, b) => b.length - a.length);
      return true;
    }).catch(() => false);
    if (d.fonts && d.fonts.load) d.fonts.load('italic 600 30px "Cormorant"').catch(() => {});

    function size() {
      dpr = Math.min(2, devicePixelRatio || 1);
      W = innerWidth;
      H = innerHeight;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const wob = (i, k) => ((((i * 7919 + k * 104729) % 1009) / 1009) - 0.5) * 1.7;
    const sm = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

    function state() {
      const Rr = Math.exp(cam.logR);
      return { lam: cam.lam * D, cphi: Math.cos(cam.phi * D), sphi: Math.sin(cam.phi * D), R: Rr, cx: W / 2, cy: H / 2,
        cr: Math.cos(cam.rot * D), sr: Math.sin(cam.rot * D) };
    }
    /* orthographic; hidden points go to the rim when `rim` is set, else null */
    function proj(p, S, rim) {
      const dl = p[0] - S.lam;
      const cdl = Math.cos(dl);
      const cosc = S.sphi * p[2] + S.cphi * p[1] * cdl;
      let x = p[1] * Math.sin(dl);
      let y = S.cphi * p[2] - S.sphi * p[1] * cdl;
      if (cosc <= 0) {
        if (!rim) return null;
        const L = Math.hypot(x, y) || 1;
        x /= L; y /= L;
      }
      return [S.cx + S.R * (x * S.cr - y * S.sr), S.cy - S.R * (x * S.sr + y * S.cr)];
    }
    function onscreen(q) { return q[0] > -80 && q[0] < W + 80 && q[1] > -80 && q[1] < H + 80; }
    /* a smoothed ink line through projected points, lifted at the horizon */
    function ink(ring, S, frac, k) {
      const n = Math.max(0, Math.min(ring.length, Math.ceil(ring.length * frac)));
      let run = [];
      const flush = () => {
        if (run.length > 1) {
          ctx.moveTo(run[0][0], run[0][1]);
          for (let i = 1; i < run.length - 1; i++) {
            const a = run[i];
            const b = run[i + 1];
            ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
          }
          const e = run[run.length - 1];
          ctx.lineTo(e[0], e[1]);
        }
        run = [];
      };
      let any = false;
      for (let i = 0; i < n; i++) {
        const q = proj(ring[i], S, false);
        if (!q) { flush(); continue; }
        if (onscreen(q)) any = true;
        q[0] += wob(i, k); q[1] += wob(i + 31, k);
        run.push(q);
      }
      flush();
      return any;
    }
    /* the land as one clip path. Hidden points are carried out to the rim and
       joined along it, never across the disc. A ring that holds the antipode
       then winds once round the whole disc, which would wash the sea instead
       of the land, so the disc is unwound for it. */
    function fill(rings, S) {
      const path = new Path2D();
      const TAU = Math.PI * 2;
      const at = (x, y) => [S.cx + S.R * (x * S.cr - y * S.sr), S.cy - S.R * (x * S.sr + y * S.cr)];
      const wrap = a => (a > Math.PI ? a - TAU : a < -Math.PI ? a + TAU : a);
      rings.forEach(ring => {
        const pts = [];
        let near = false;
        let turn = 0;   // how far the ring goes round the view axis
        let area = 0;   // what it encloses on the near side, in an equal-area projection
        let a0 = 0;
        let u0 = 0;
        let v0 = 0;
        let a1 = 0;
        let u1 = 0;
        let v1 = 0;
        let hid1 = false;
        for (let i = 0; i < ring.length; i++) {
          const p = ring[i];
          const dl = p[0] - S.lam;
          const cdl = Math.cos(dl);
          const cosc = S.sphi * p[2] + S.cphi * p[1] * cdl;
          let x = p[1] * Math.sin(dl);
          let y = S.cphi * p[2] - S.sphi * p[1] * cdl;
          const a = Math.atan2(y, x);
          const k = Math.sqrt(2 / Math.max(1e-6, 1 + cosc));
          const u = x * k;
          const v = y * k;
          const hid = cosc <= 0;
          if (hid) { x = Math.cos(a); y = Math.sin(a); }
          if (i) {
            const da = wrap(a - a1);
            turn += da;
            area += u1 * v - u * v1;
            if (hid && hid1) {
              const n = Math.floor(Math.abs(da) / 0.1);
              for (let j = 1; j <= n; j++) pts.push(at(Math.cos(a1 + da * j / (n + 1)), Math.sin(a1 + da * j / (n + 1))));
            }
          } else { a0 = a; u0 = u; v0 = v; }
          const q = at(x, y);
          if (onscreen(q)) near = true;
          pts.push(q);
          a1 = a; u1 = u; v1 = v; hid1 = hid;
        }
        if (!near && S.R > W) return;
        turn += wrap(a0 - a1);
        area += u1 * v0 - u0 * v1;
        pts.forEach((q, i) => { if (i) path.lineTo(q[0], q[1]); else path.moveTo(q[0], q[1]); });
        path.closePath();
        const w = Math.round(turn / TAU);
        if (w && Math.abs(area) / 2 > TAU) {
          for (let j = 0; j <= 72; j++) {
            const q = at(Math.cos(-w * TAU * j / 72), Math.sin(-w * TAU * j / 72));
            if (j) path.lineTo(q[0], q[1]); else path.moveTo(q[0], q[1]);
          }
          path.closePath();
        }
      });
      return path;
    }
    function sheet(img, S, grow) {
      if (!img.complete || !img.naturalWidth) return;
      const diag = Math.hypot(W, H);
      let r = S.R * grow;
      let cx = S.cx;
      let cy = S.cy;
      if (r > diag * 1.4) { r = diag * 1.4; cx = W / 2; cy = H / 2; }
      ctx.drawImage(img, cx - r, cy - r, 2 * r, 2 * r);
    }
    function label(txt, x, y, size, rot, a) {
      if (a <= 0.01) return;
      ctx.save();
      ctx.globalAlpha = a * cam.fade;
      ctx.translate(x, y);
      ctx.rotate(rot * D);
      ctx.font = `italic 600 ${size}px "Cormorant", Georgia, serif`;
      ctx.fillStyle = '#1c1b19';
      ctx.fillText(txt, 0, 0);
      ctx.restore();
    }
    /* a hand-drawn loop; `frac` is how far round it the pen has got */
    function loop(cx, cy, r, a, frac = 1, sx = 1.15, sy = 0.85) {
      if (a <= 0.01 || frac <= 0) return;
      ctx.save();
      ctx.globalAlpha = a * cam.fade;
      ctx.beginPath();
      ctx.lineWidth = 1.7;
      ctx.strokeStyle = '#1c1b19';
      const n = 40;
      const m = Math.round(n * clamp(frac, 0, 1));
      for (let i = 0; i <= m; i++) {
        const t = i / n;
        const ang = -0.6 + t * Math.PI * 2.2;
        const g = r * (1 + 0.06 * t);
        const x = cx + g * sx * Math.cos(ang) + wob(i, 5);
        const y = cy + g * sy * Math.sin(ang) + wob(i, 9);
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }
    function graticule(S, a) {
      if (a <= 0.01) return;
      ctx.save();
      ctx.globalAlpha = a * cam.fade;
      ctx.strokeStyle = '#8f8c85';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let lon = -180; lon < 180; lon += 30) {
        const ring = [];
        for (let lat = -88; lat <= 88; lat += 4) ring.push([lon * D, Math.cos(lat * D), Math.sin(lat * D)]);
        ink(ring, S, cam.reveal * 1.6, 100 + lon);
      }
      for (let lat = -60; lat <= 60; lat += 30) {
        const ring = [];
        for (let lon = -180; lon <= 180; lon += 4) ring.push([lon * D, Math.cos(lat * D), Math.sin(lat * D)]);
        ink(ring, S, cam.reveal * 1.6, 200 + lat);
      }
      ctx.stroke();
      // the pencil circle the rim is inked over: a construction line, wobblier than the ink
      if (cam.pencil > 0.01) {
        ctx.globalAlpha = a * cam.fade * 0.75;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        const m = 72;
        for (let i = 0; i <= m * clamp(cam.pencil, 0, 1); i++) {
          const t = -2.4 + i / m * Math.PI * 2.04;
          const x = S.cx + S.R * 1.012 * Math.cos(t) + wob(i, 11) * 1.6;
          const y = S.cy + S.R * 1.012 * Math.sin(t) + wob(i, 13) * 1.6;
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke();
        ctx.globalAlpha = a * cam.fade;
      }
      // the rim, gone over by hand
      ctx.beginPath();
      ctx.strokeStyle = '#1c1b19';
      ctx.lineWidth = 1.5;
      const n = 72;
      for (let i = 0; i <= n * 1.05 * clamp(cam.reveal * 1.8, 0, 1); i++) {   // starts with the inking, over the pencil circle
        const t = -1.9 + i / n * Math.PI * 2;
        const x = S.cx + S.R * Math.cos(t) + wob(i, 3);
        const y = S.cy + S.R * Math.sin(t) + wob(i, 7);
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }
    function coast(rings, S, a, k0, reveal) {
      if (a <= 0.01) return;
      ctx.save();
      ctx.globalAlpha = a * cam.fade;
      ctx.strokeStyle = '#1c1b19';
      ctx.lineWidth = S.R < 2000 ? 1.25 : 1.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      const N = rings.length;
      rings.forEach((ring, i) => {
        // `reveal` null: the set is complete; a number: how far the inking has got (0 is blank paper)
        const frac = reveal == null ? 1 : clamp((reveal - 0.3 * (i / N)) / 0.7, 0, 1);
        if (frac > 0) ink(ring, S, frac, k0 + i);
      });
      ctx.stroke();
      ctx.restore();
    }
    const geo = (lon, lat) => [lon * D, Math.cos(lat * D), Math.sin(lat * D)];
    const PH = geo(122.4, 11.9);
    const BAY = geo(120.97, 13.715);
    const CITY = geo(121.07, 13.76);

    function render() {
      ctx.clearRect(0, 0, W, H);
      if (!data || cam.on <= 0.01) return;
      const S = state();
      const R = S.R;
      ctx.save();
      ctx.globalAlpha = cam.on;
      // the washes: ocean under everything, land through the coastline clip
      const aG = 1 - sm(1400, 2600, R);
      const aP = sm(900, 2200, R) * (1 - sm(14000, 36000, R));
      const aB = sm(12000, 30000, R);
      ctx.save();
      ctx.globalAlpha = cam.on * cam.fade * Math.min(1, cam.reveal * 2.5);
      sheet(imgs.ocean, S, 1.09);
      const land = aB > 0.5 ? data.b : aP > 0.5 ? data.p : data.g;
      // the mainland is only in the world set: its wash fades with its line
      if (land !== data.g && aG > 0.01) {
        ctx.save();
        ctx.globalAlpha *= aG;
        ctx.clip(fill(data.g, S));
        sheet(imgs.land, S, 1.35);
        ctx.restore();
      }
      ctx.save();
      ctx.clip(fill(land, S));
      sheet(imgs.land, S, 1.35);
      ctx.restore();
      // the sun finds the islands during the hold and goes with them into the first fall
      const gA = 0.55 * cam.glow * (1 - sm(5000, 16000, R));
      if (gA > 0.01 && imgs.gold.complete && imgs.gold.naturalWidth) {
        const q = proj(PH, S, false);
        if (q) {
          ctx.globalAlpha = cam.on * cam.fade * gA;
          const r = Math.min(R * 0.27, Math.hypot(W, H) * 0.6);
          ctx.drawImage(imgs.gold, q[0] - r, q[1] - r, 2 * r, 2 * r);
        }
      }
      ctx.restore();
      graticule(S, 1 - sm(900, 2400, R));
      coast(data.g, S, aG, 1000, cam.reveal);
      coast(data.p, S, aP, 2000, null);
      coast(data.b, S, aB, 3000, null);
      // the pen circles the islands on the globe; the fall goes through the loop as it fades
      const q1 = proj(PH, S, false);
      if (q1 && cam.l0 > 0.01 && cam.l0 < 1.99) loop(q1[0], q1[1], R * 0.15, clamp(2 - cam.l0, 0, 1), cam.l0, 0.95, 1.25);
      // annotations
      if (q1 && cam.l1 > 0.01) {
        const narrow = W < 700;
        const lx = narrow ? 22 : Math.min(q1[0] + R * 0.13, W - 300);
        const ly = narrow ? 104 : q1[1] - R * 0.05;
        const Ra = narrow ? Math.min(R, W * 4.5) : R;   // keeps the arrowhead on a narrow sheet
        label('the Philippines', lx, ly, 34, 0, cam.l1);
        ctx.save();
        ctx.globalAlpha = cam.l1 * cam.fade;
        ctx.strokeStyle = '#1c1b19';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(lx + (narrow ? 150 : 20), ly + (narrow ? 8 : R * 0.015));
        ctx.quadraticCurveTo((lx + q1[0]) / 2, (ly + q1[1]) / 2 - Ra * 0.02, q1[0] + Ra * 0.045, q1[1] + Ra * 0.02);
        ctx.moveTo(q1[0] + Ra * 0.08, q1[1] + Ra * 0.004);
        ctx.lineTo(q1[0] + Ra * 0.045, q1[1] + Ra * 0.02);
        ctx.lineTo(q1[0] + Ra * 0.078, q1[1] + Ra * 0.035);
        ctx.stroke();
        ctx.restore();
      }
      const q2 = proj(CITY, S, false);
      const q3 = proj(BAY, S, false);
      if (q2 && cam.l2 > 0.01) {
        const rr = Math.max(40, R * 0.00026);
        loop(q2[0], q2[1], rr, Math.min(1, cam.l2 * 3), cam.l2);
        label('Batangas City', Math.min(q2[0] + rr * 1.3, W - 200), q2[1] - rr * 0.9, 32, 0, cam.l2);
        if (q3) label('Batangas Bay', q3[0] - 90, q3[1] + 44, 29, 0, cam.l2);
      }
      // the shoreline straightening into the first stroke
      if (morphSrc && cam.morph > 0) {
        const t = cam.morph;
        ctx.save();
        ctx.globalAlpha = cam.on;
        ctx.strokeStyle = '#1c1b19';
        ctx.lineWidth = 1.5 + 0.3 * t;
        ctx.lineCap = 'round';
        ctx.beginPath();
        const run = morphSrc.map((p, i) => [p[0] + (morphDst[i][0] - p[0]) * t, p[1] + (morphDst[i][1] - p[1]) * t]);
        ctx.moveTo(run[0][0], run[0][1]);
        for (let i = 1; i < run.length - 1; i++) {
          ctx.quadraticCurveTo(run[i][0], run[i][1], (run[i][0] + run[i + 1][0]) / 2, (run[i][1] + run[i + 1][1]) / 2);
        }
        ctx.lineTo(run[run.length - 1][0], run[run.length - 1][1]);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }
    /* resample a polyline to n points by arc length */
    function resample(pts, n) {
      const L = [0];
      for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const out = [];
      let j = 0;
      for (let k = 0; k < n; k++) {
        const s = L[L.length - 1] * k / (n - 1);
        while (j < pts.length - 2 && L[j + 1] < s) j++;
        const seg = L[j + 1] - L[j] || 1;
        const t = clamp((s - L[j]) / seg, 0, 1);
        out.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * t, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * t]);
      }
      return out;
    }
    function startMorph() {
      const S = state();
      const src = data.shore.map(p => proj(p, S, true));
      const path = $('.ink--hero [data-l="coast"] path');
      const m = path.getScreenCTM();
      const L = path.getTotalLength();
      const dst = [];
      for (let i = 0; i < 48; i++) {
        const p = path.getPointAtLength(L * i / 47);
        dst.push([m.a * p.x + m.c * p.y + m.e, m.b * p.x + m.d * p.y + m.f]);
      }
      morphSrc = resample(src, 48);
      morphDst = dst;
    }
    return { cam, loaded, size, render, startMorph, ready: () => !!data };
  })();

  /* ------------------------------------------------- hero: intro + scroll */
  const hero = $('.hero');
  const stage = $('.hero__stage');
  const scene = $('.hero__scene');
  const hl = n => $$(`.ink--hero [data-l="${n}"] path`);
  const ht = n => $$(`.ink--hero [data-l="${n}"] text`);
  const hw = n => $(`.hero__scene > .wash[data-w="${n}"]`);

  /* the ten inner pages share this script with the homepage: whatever is not on the page is skipped */
  if (hero) {
    const word = $('.hero__word');
    $('.hero__title').setAttribute('aria-label', 'Welcome to Batangas City');
    $$('.hero__title > span').forEach(s => s.setAttribute('aria-hidden', 'true'));
    word.innerHTML = Array.from(word.textContent.trim()).map(c => `<span class="l">${c}</span>`).join('');
    if (motion) { stage.appendChild($('.hero__end')); stage.appendChild($('.hero__steps')); }
  }

  /* The hero is drawn in six steps that follow one another by themselves once
     the intro is over (the client's call: a drawing that has started finishes
     without anyone scrolling). Scrolling only hurries it: a step the reader
     has scrolled past is drawn at once, and faster. */
  const STEPS = [
    { ink: ['roads', 'clouds', 'birds'], wash: [] },
    { ink: ['city-b'], wash: ['hills', 'city'] },
    { ink: ['basilica-d', 'n-basilica'], wash: ['accent'] },
    { ink: ['port', 'industry', 'smoke', 'n-port'], wash: [] },
    { ink: ['sea', 'ferry', 'small-boats', 'outrigger', 'n-bay'], wash: ['deep'] },
    { ink: ['veg', 'palm', 'banana', 'n-green'], wash: ['fore'] }
  ];
  const MARKS = [0.06, 0.18, 0.32, 0.46, 0.59, 0.72];   // where the scroll asks for each step

  function heroDraw() {
    const steps = $$('.hero__steps li');
    let started = 0;    // steps begun
    let asked = 0;      // steps the scroll position has asked for
    let prog = 0;       // scroll progress through the hero
    let playing = null;
    const done = () => started === STEPS.length && !playing;

    /* the margin index while the drawing runs; "keep scrolling" once it is done */
    const sync = () => {
      gsap.to('.hero__steps', { autoAlpha: started > 0 && !done() && prog < 0.86 ? 1 : 0, duration: 0.4, overwrite: 'auto' });
      gsap.to('.hero__scroll', { autoAlpha: done() && prog < 0.12 ? 1 : 0, duration: 0.5, overwrite: 'auto' });
    };
    const step = i => {
      const s = STEPS[i];
      const tl = gsap.timeline({
        paused: true,
        onStart() { steps.forEach((li, k) => { li.classList.toggle('is-on', k === i); li.classList.toggle('is-done', k < i); }); sync(); },
        onComplete() { steps[i].classList.replace('is-on', 'is-done'); playing = null; gsap.delayedCall(0.35, next); sync(); }
      });
      s.ink.forEach(n => {
        const p = hl(n);
        if (p.length) tl.to(p, { strokeDashoffset: 0, duration: 1.3, stagger: 1.1 / p.length, ease: 'power1.inOut' }, 0);
        const t = ht(n);
        if (t.length) tl.to(t, { opacity: 1, duration: 0.4 }, 1.3);
      });
      s.wash.forEach((w, k) => tl.add(bloom(hw(w), 1.5), 0.9 + k * 0.45));
      return tl;
    };
    const tls = STEPS.map((_, i) => step(i));
    const next = () => {
      if (playing || started >= STEPS.length) return;
      playing = tls[started++];
      playing.timeScale(asked > started ? 1.7 : lite() ? 1.3 : 1).play();   // phones draw a little quicker
    };

    /* Wide windows only: the hero stays put for two screens of scroll while the
       words go, the statement arrives and the drawing zooms a little. In the
       stacked layout (phones, tablets, narrow windows) the hero is ordinary
       page flow and none of this exists; gsap.matchMedia undoes it on the way
       out, so turning a tablet or resizing a window is safe. */
    gsap.matchMedia().add(WIDE, () => {
      gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: hero, start: 'top top', end: 'bottom bottom', scrub: 0.5,
          onUpdate(s) {
            prog = s.progress;
            asked = MARKS.filter(m => prog >= m).length;
            if (playing && asked > started) playing.timeScale(1.7);
            next();
            sync();
          }
        }
      })
        .to('.hero__tagline, .hero__lede', { autoAlpha: 0, y: -16, duration: 0.5 }, 0.15)
        /* the panel's last two rows leave before the statement arrives in their place: never both at once */
        .to('.hero__find, .hero__quick', { autoAlpha: 0, duration: 0.3 }, 8.7)
        .to('.hero__end', { autoAlpha: 1, duration: 0.6 }, 9.1)
        .to({}, { duration: 0.6 }, 9.7);
      gsap.fromTo(scene, { scale: 1 }, { scale: 1.05, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom bottom', scrub: 0.5 } });
      return () => { prog = 0; asked = 0; sync(); };
    });

    next();
  }

  function runIntro() {
    /* in the stacked layout, and on phones, the small sketch sits mid-sheet before it grows into place */
    const small = lite() || !matchMedia(WIDE).matches;
    const s0 = small ? clamp(innerWidth / scene.offsetWidth * 1.02, 0.4, 0.9) : 0.84;
    const box = scene.getBoundingClientRect();
    const dy = small ? innerHeight * 0.46 - (box.top + box.height * 0.66) : 0;
    const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
    /* the globe plays on every load, a reload included (the user's decision,
       2026-10-08); Skip intro, Esc and a tap on a phone skip it */
    const pro = globe && globe.ready();
    if (lite()) tl.timeScale(2.4);   // a phone gets the whole intro in under ten seconds
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      tl.progress(1);
      if (globe) { gsap.ticker.remove(globe.render); globe.cam.on = 0; globe.render(); }
      root.classList.remove('is-intro');
      heroDraw();
      ST.refresh();
      fitLabels();   // the scene is at its resting size only now
    };
    tl.set(scene, { scale: s0, y: dy });

    /* the prologue, about seventeen seconds, slow and cinematic (the client asked
       for drama and anticipation before the zoom, 2026-10-08, and then for slower
       and more cinematic): blank paper, a pencil circle, the globe inked on it
       while it barely turns, a long turn east until the islands rise over the
       horizon and settle at centre, a slow push in while the sun finds them and
       breathes and the pen loops them, the fall through the loop, a breath on the
       archipelago that keeps pushing in, the fall to the bay, a slow push over the
       bay, and the shoreline becomes the stroke. The camera never quite stops:
       every hold is a slow push, every move eases in and out over seconds. */
    let t0 = 0;
    if (pro) {
      const cam = globe.cam;
      const R0 = Math.min(innerWidth, innerHeight) * 0.33;
      const R1 = innerHeight * 3.1;
      const R2 = Math.max(innerWidth, innerHeight * 0.9) * 80;
      globe.size();
      Object.assign(cam, { lam: -62, phi: 28, logR: Math.log(R0), rot: 0, pencil: 0, reveal: 0, glow: 0, l0: 0, l1: 0, l2: 0, fade: 1, morph: 0, on: 1 });
      addEventListener('resize', globe.size);
      gsap.ticker.add(globe.render);
      gsap.set('.intro__note', { opacity: 0 });   // the note waits for the turn
      /* blank paper, then the globe is drawn: pencil first, then ink, the Atlantic side of the world, barely turning */
      tl.to(cam, { pencil: 1, duration: 0.7, ease: 'none' }, 0.5)
        .to(cam, { reveal: 1, duration: 2.2, ease: 'none' }, 0.8)
        .to(cam, { lam: -55, duration: 2.6, ease: 'none' }, 0)
        /* the turn east, four and a half seconds: the islands come over the eastern horizon at about 4.8 s and settle at centre */
        .to(cam, { lam: 121.6, phi: 12.8, duration: 4.5, ease: 'sine.inOut' }, 2.6)
        .to('.intro__note', { opacity: 1, duration: 0.8 }, 3.2)
        /* the hold, a slow push in: the sun finds the islands and breathes, the pen circles them */
        .to(cam, { lam: 122.3, logR: Math.log(R0 * 1.3), duration: 2.0, ease: 'sine.inOut' }, 7.1)
        .to(cam, { glow: 1, duration: 1.4, ease: 'power1.out' }, 7.0)
        .to(cam, { glow: 0.78, duration: 0.7, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 8.4)
        .to(cam, { l0: 1, duration: 0.9, ease: 'none' }, 7.6)
        /* the fall, slow to start then fast, through the loop; the breath on the archipelago keeps pushing in */
        .to(cam, { logR: Math.log(R1), phi: 12.0, rot: 20, duration: 2.2, ease: 'power3.inOut' }, 9.1)
        .to(cam, { l0: 2, duration: 1.0, ease: 'none' }, 9.6)
        .to(cam, { logR: Math.log(R1 * 1.12), duration: 1.0, ease: 'none' }, 11.3)
        .to(cam, { l1: 1, duration: 0.6, ease: 'none' }, 10.9)
        .to(cam, { l1: 0, duration: 0.5, ease: 'none' }, 12.1)
        /* the fall to the bay, banking until the coast lies along the sheet; a slow push over the bay */
        .to(cam, { logR: Math.log(R2), lam: 121.085, phi: 13.70, rot: 90, duration: 2.0, ease: 'power2.inOut' }, 12.3)
        .to(cam, { l2: 1, duration: 0.9, ease: 'none' }, 13.7)
        .to(cam, { logR: Math.log(R2 * 1.05), duration: 1.2, ease: 'none' }, 14.3)
        /* the shoreline straightens into the first stroke */
        .add(globe.startMorph, 15.5)
        .to(cam, { morph: 1, fade: 0, duration: 1.3, ease: 'power2.inOut' }, 15.5)
        .add(() => { $('.intro__note').textContent = 'sketching Batangas City…'; }, 15.6)
        .set(hl('coast'), { strokeDashoffset: 0 }, 16.8)
        .to(cam, { on: 0, duration: 0.3, ease: 'none' }, 16.8)
        /* clear the sheet by hand: a dropped frame here would leave the map up */
        .add(() => { gsap.ticker.remove(globe.render); cam.on = 0; globe.render(); }, 17.2);
      t0 = 16.8;
    } else {
      $('.intro__note').textContent = 'sketching Batangas City…';
      tl.to(hl('coast'), { strokeDashoffset: 0, duration: 1.5, ease: 'power1.inOut' }, 0.7);
      t0 = 1.0;
    }
    /* the city is drawn */
    tl.fromTo('.ink--hero .dot', { scale: 0, opacity: 1 }, { scale: 1, duration: 0.45, ease: 'back.out(3)' }, t0 + (pro ? 0.05 : -0.7))
      .to(hl('ridge'), { strokeDashoffset: 0, duration: 0.9, stagger: 0.07 }, t0 + 0.7)
      .to(hl('city-a'), { strokeDashoffset: 0, duration: 0.7, stagger: 0.03 }, t0 + 1.6)
      .add(bloom(hw('mountain'), 1.5), t0 + 2.3)
      .add(bloom(hw('bay'), 1.6), t0 + 2.9)
      .add(bloom(hw('sun'), 1.2), t0 + 3.6)
      .to('.hero__word .l', { opacity: 1, y: 0, duration: 0.8, stagger: 0.055, ease: 'power3.out' }, t0 + 4.0)
      .to('.hero__welcome', { opacity: 1, duration: 0.5 }, t0 + 4.3)
      .to('.hero__city', { opacity: 1, duration: 0.7 }, t0 + 4.7)
      .to('.hero__refrain span', { opacity: 1, y: 0, duration: 0.55, stagger: 0.42, ease: 'power2.out' }, t0 + 4.9)
      .to('.intro__note', { opacity: 0, duration: 0.4 }, t0 + 5.3)
      .to(scene, { scale: 1, y: 0, duration: 1.4, ease: 'power3.inOut' }, t0 + 5.6)
      .to('.intro__skip', { opacity: 0, duration: 0.3 }, t0 + 5.7)
      .add(done, t0 + 6.5);

    /* arriving at a section (a link to #services, say) is no moment for an intro */
    if (scrollY > 8 || location.hash.length > 1) done();
    $('#skip-intro').addEventListener('click', done);
    if (coarse) d.addEventListener('pointerdown', done, { once: true });   // on touch, a tap anywhere skips
    /* any key ends it (Tab, Enter, a scroll key…), not only Esc: a keyboard is never held; a lone modifier does not count */
    d.addEventListener('keydown', e => { if (!finished && !['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) done(); });
    /* if the tab is asleep and no frames arrive, do not hold the page hostage */
    const guard = setTimeout(done, 32000);
    window.__intro = { tl, pro, globe, hold: () => clearTimeout(guard) };
  }

  /* ---------------------------------------------- chapters: draw on arrival */
  function drawIn(el) {
    if (el.dataset.done) return;
    el.dataset.done = '1';
    const total = parseFloat(el.dataset.total || 1.8);
    const paths = $$('.ink ' + DRAW, el);
    const marks = $$('.ink text:not([data-nodraw] *), .ink .dot', el);
    const washes = $$('.wash:not(.dab):not(.zone-wash)', el);
    const tl = gsap.timeline({
      onComplete() {
        el.classList.add('is-drawn');
        if (paths.length) gsap.set(paths, { clearProps: 'strokeDashoffset' });
        if (marks.length + washes.length) gsap.set(marks.concat(washes), { clearProps: 'opacity' });
      }
    });
    if (paths.length) {
      tl.to(paths, { strokeDashoffset: 0, duration: Math.min(1.1, total * 0.5), ease: 'power2.inOut', stagger: total / paths.length }, 0);
    }
    washes.forEach((w, i) => tl.add(bloom(w, 1.5), total * 0.3 + i * 0.22));
    if (marks.length) tl.to(marks, { opacity: 1, duration: 0.5, stagger: 0.1 }, total * 0.7);
  }

  function chapters() {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      if (e.target.hasAttribute('data-draw')) drawIn(e.target);
      else e.target.classList.add('is-in');
    }), { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
    $$('[data-draw], [data-reveal]').forEach(el => io.observe(el));

    /* the portraits: pen first, then the washes (with ?photo, the photograph is wiped on instead) */
    $$('[data-portrait]').forEach(por => {
      const pio = new IntersectionObserver(es => {
        if (!es[0].isIntersecting) return;
        pio.disconnect();
        const ink = $(photo ? '.portrait__photo' : '.portrait__ink', por);
        const washes = $$('.wash', por);
        /* the portrait is wiped on in monochrome; then, as everywhere on the page, the colour comes */
        gsap.timeline({ onComplete() { por.classList.add('is-drawn'); ink.style.removeProperty('--p'); gsap.set([ink].concat(washes), { clearProps: 'opacity,filter' }); } })
          .fromTo(ink, { '--p': 0 }, { '--p': 1, duration: 2.0, ease: 'power1.inOut' }, 0)
          .add(() => washes.forEach((w, i) => bloom(w, 1.6, { delay: i * 0.25 })), 0.5)
          .fromTo(ink, { filter: 'grayscale(1)' }, { filter: 'grayscale(0)', duration: 1.8, ease: 'power1.inOut' }, 1.2)
          .to({}, { duration: 0.6 });
      }, { threshold: 0.3 });
      pio.observe(por);
    });

    const f = $('[data-fiesta]');
    const fio = new IntersectionObserver(es => {
      if (!es[0].isIntersecting) return;
      fio.disconnect();
      const bunting = $$('[data-l^="bunting"] path', f);
      const river = $$('[data-l="river"] path', f);
      const flags = $$('.wash', f);
      gsap.timeline({ onComplete() { f.classList.add('is-drawn'); gsap.set(bunting.concat(river), { clearProps: 'strokeDashoffset' }); gsap.set(flags, { clearProps: 'opacity' }); } })
        .to(bunting, { strokeDashoffset: 0, duration: 0.55, stagger: 0.12, ease: 'power2.out' }, 0)
        .add(() => flags.forEach((w, i) => bloom(w, 1.1, { delay: i * 0.12 })), 0.45)
        /* the title is up in half a second: a heading is read, not waited for */
        .fromTo($$('.fiesta__type > *, .fiesta__type h2 span', f), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.42, stagger: 0.05, ease: 'power3.out' }, 0)
        .to(river, { strokeDashoffset: 0, duration: 0.8, stagger: 1.6 / river.length, ease: 'power2.inOut' }, 1.0)
        .to({}, { duration: 1 });
    }, { threshold: 0.3 });
    if (f) fio.observe(f);
  }

  /* --------------------------------------------------------- 02 services */
  const svcItems = $$('.svc-item');
  const svcGroups = $$('.scene--street .svc');
  const dabs = $$('.scene--street .dab');
  const pan = $('.street__pan');
  const panBox = $('.street__scroll');
  let current = $('main').dataset.svc || 'certificates';   // an inner page may name the building to light
  let hovered = null;
  let panBase = 0;
  let panOff = 0;
  const fold = matchMedia('(max-width:760px)');   // a phone: the list is an accordion that starts closed

  function paintStreet() {
    svcGroups.forEach(g => {
      g.classList.toggle('is-on', g.dataset.svc === current);
      g.classList.toggle('is-hover', g.dataset.svc === hovered);
    });
    dabs.forEach(i => i.classList.toggle('is-on', i.dataset.svc === current || i.dataset.svc === hovered));
    svcItems.forEach(li => li.classList.toggle('is-hover', li.dataset.svc === hovered));
  }
  let panTo = 0;   // small screens: where the chosen building sits
  function applyPan() {
    if (!pan) return;
    const over = pan.offsetWidth - panBox.clientWidth;
    if (over <= 0) { pan.style.transform = ''; return; }
    if (innerWidth < 900) { pan.style.transform = `translate3d(${-clamp(panTo, 0, over)}px,0,0)`; return; }
    pan.style.transform = `translate3d(${-clamp(panBase * over + panOff, 0, over)}px,0,0)`;
  }
  function showBuilding(key) {
    const hit = $(`.svc[data-svc="${key}"] .hit`);
    if (!hit) return;
    const k = pan.offsetWidth / 2700;
    const a = hit.x.baseVal.value * k;
    const b = a + hit.width.baseVal.value * k;
    if (innerWidth < 900) {
      panTo = (a + b) / 2 - panBox.clientWidth / 2;
      applyPan();
      return;
    }
    const over = pan.offsetWidth - panBox.clientWidth;
    if (over <= 0) return;
    const x = clamp(panBase * over + panOff, 0, over);
    let to = x;
    if (a < x + 40) to = a - 40;
    else if (b > x + panBox.clientWidth - 40) to = b - panBox.clientWidth + 40;
    if (to === x) return;
    const o = { v: panOff };
    const goal = clamp(to, 0, over) - panBase * over;
    if (motion) gsap.to(o, { v: goal, duration: 0.7, ease: 'power2.out', onUpdate() { panOff = o.v; applyPan(); } });
    else { panOff = goal; applyPan(); }
  }
  function selectSvc(key, opts = {}) {
    if (!svcItems.some(li => li.dataset.svc === key)) return;
    const changed = key !== current;
    current = key;
    svcItems.forEach(li => {
      const on = li.dataset.svc === key;
      li.classList.toggle('is-open', on);
      $('button', li).setAttribute('aria-expanded', String(on));
    });
    paintStreet();
    if (changed && motion && !lite()) {
      const dab = dabs.find(i => i.dataset.svc === key);
      if (dab) bloom(dab, 1.1);
    }
    if (opts.reveal !== false) showBuilding(key);
    if (opts.focus) $('button', svcItems.find(li => li.dataset.svc === key)).focus({ preventScroll: true });
  }
  function closeSvc() {
    svcItems.forEach(li => { li.classList.remove('is-open'); $('button', li).setAttribute('aria-expanded', 'false'); });
  }
  /* a phone goes to the service itself, not to the head of the chapter */
  const goSvc = key => svcItems.find(li => li.dataset.svc === key).scrollIntoView({ block: 'start', behavior: motion ? 'smooth' : 'auto' });
  svcItems.forEach(li => {
    const btn = $('button', li);
    btn.addEventListener('click', () => {
      if (!fold.matches) { selectSvc(li.dataset.svc); return; }
      /* a phone: tapping the open one closes it, and the row stays under the finger */
      const y = btn.getBoundingClientRect().top;
      if (li.classList.contains('is-open')) closeSvc(); else selectSvc(li.dataset.svc);
      scrollBy({ top: btn.getBoundingClientRect().top - y, behavior: 'instant' });
    });
    li.addEventListener('pointerenter', () => { hovered = li.dataset.svc; paintStreet(); });
    li.addEventListener('pointerleave', () => { hovered = null; paintStreet(); });
  });
  svcGroups.forEach(g => {
    const hit = $('.hit', g);
    hit.addEventListener('pointerenter', () => { hovered = g.dataset.svc; paintStreet(); });
    hit.addEventListener('pointerleave', () => { hovered = null; paintStreet(); });
    hit.addEventListener('click', () => { selectSvc(g.dataset.svc, { reveal: innerWidth < 900 }); if (fold.matches) goSvc(g.dataset.svc); });
  });
  if (svcItems.length) {
    selectSvc(current, { reveal: false });
    if (fold.matches) closeSvc();
  } else if (svcGroups.length) {
    /* a page that shows the street without the list (Emergency): its own building is the one lit */
    paintStreet();
    addEventListener('load', () => showBuilding(current));
  }
  fold.addEventListener('change', () => { if (!fold.matches && svcItems.length) selectSvc(current, { reveal: false }); });

  /* English and Tagalog, the words people actually type */
  const KEYS = {
    /* the Mayor's flagship first, so it wins a tie (it has no building on the street) */
    mac: 'ebd mac flagship action center centre healthcard card hospitalization hospitalisation bill bills guarantee medical assistance burial funeral legal lawyer caravan tulong ayuda abuloy libing pagpapaospital',
    certificates: 'certificate certificates birth marriage death cedula civil registry registrar licence license record records certified copy community tax psa sedula sertipiko katibayan kapanganakan kasal kamatayan rehistro',
    permits: 'permit permits business building occupancy zoning locational clearance renewal bplo construction construct renovate negosyo permiso lisensya gusali pagtatayo tindahan',
    taxes: 'tax taxes property amilyar payment pay treasurer transfer receipt rpt assessment buwis bayad bayaran lupa resibo',
    health: 'health clinic doctor immunisation immunization vaccine sanitary medical hospital checkup consultation kalusugan bakuna doktor ospital gamot sentro',
    social: 'senior seniors pwd solo parent social welfare assistance crisis osca disability cswd lolo lola magulang tulong ayuda pamilya kapansanan',
    education: 'school schools scholarship scholarships library education student students learning tuition eskwela eskuwela paaralan iskolar aklatan estudyante matrikula',
    jobs: 'job jobs work vacancy vacancies employment peso career careers hiring fair trabaho hanapbuhay bakante empleyo aplikante',
    emergency: 'emergency 911 fire police rescue disaster flood typhoon evacuation hotline hotlines ambulance earthquake sunog pulis bumbero baha bagyo lindol aksidente sakuna ambulansya'
  };
  function matchSvc(q) {
    const words = q.toLowerCase().split(/[^a-z0-9ñ]+/).filter(w => w.length > 1);
    let best = null;
    let score = 0;
    Object.keys(KEYS).forEach(k => {
      const bag = KEYS[k].split(' ');
      const s = words.reduce((n, w) => n + (bag.some(b => b === w) ? 2 : bag.some(b => b.startsWith(w) || w.startsWith(b)) ? 1 : 0), 0);
      if (s > score) { score = s; best = k; }
    });
    return best;
  }
  /* the same box twice: in the hero and at the head of the street */
  $$('form.find').forEach(form => {
    const input = $('input', form);
    const msg = $('#' + form.id + '-msg');
    const inHero = form.id === 'find-hero';
    form.addEventListener('submit', e => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) { msg.textContent = 'Type what you need, for example “taxes”, “permit” or “birth certificate”.'; return; }
      const k = matchSvc(q);
      if (!k) {   /* not one of the doors on the street: ask the site's search instead */
        const best = searchFor(q)[0];
        const safe = q.replace(/[<>&"]/g, '');
        msg.innerHTML = best
          ? `Not one of the doors on this street, but the City has this: <a class="lk" href="${best.href}">${best.label}</a>.`
          : `Nothing matches “${safe}”. Try another word, or open the menu.`;
        return;
      }
      if (k === 'mac') {   /* no building for it: its card on the homepage, its section on Services, or that page */
        const to = $('#flagship') || $('#mac');
        const answer = "That would be EBD and the Mayor's Action Center.";
        msg.textContent = answer;
        if (inHero) { $('#find-q').value = q; $('#find-msg').textContent = answer; }
        if (!to) { location.href = 'services.html#mac'; return; }
        to.scrollIntoView({ block: 'start', behavior: motion ? 'smooth' : 'auto' });
        const link = $('h3 a', to);
        if (link) link.focus({ preventScroll: true });
        return;
      }
      selectSvc(k, { focus: true });
      const answer = `That would be ${$('b', svcItems.find(li => li.dataset.svc === k)).textContent}.`;
      msg.textContent = answer;
      if (inHero) { $('#find-q').value = q; $('#find-msg').textContent = answer; }
      if (fold.matches) goSvc(k);
      else $('#svc-list').scrollIntoView({ block: inHero ? 'start' : 'nearest', behavior: motion ? 'smooth' : 'auto' });
    });
  });
  d.addEventListener('click', e => {
    const a = e.target.closest('[data-svc-link], [data-zone-link]');
    if (!a) return;
    if (a.dataset.svcLink) {
      selectSvc(a.dataset.svcLink, { reveal: true });
      if (fold.matches) { e.preventDefault(); goSvc(a.dataset.svcLink); }
    }
    if (a.dataset.zoneLink) setZone(a.dataset.zoneLink);
  });

  /* ---------------------------------------------------------- 03 explore */
  const ex = $('.explore');
  const exPin = $('.explore__pin');
  const track = $('#ex-track');
  const spreads = track ? $$('.spread', track) : [];
  const exNow = $('#ex-now');
  let pinned = false;
  let travel = 0;
  let exTween = null;
  let exIndex = 0;

  const exDots = spreads.map((s, i) => {
    const b = d.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', 'Page ' + (i + 1) + ': ' + $('.spread__no span', s).textContent);
    b.addEventListener('click', () => goSpread(i));
    $('#ex-dots').appendChild(b);
    return b;
  });
  const spreadX = i => spreads[i].offsetLeft + spreads[i].offsetWidth / 2 - innerWidth / 2;
  function setCount(x) {
    let best = 0;
    spreads.forEach((s, i) => { if (Math.abs(spreadX(i) - x) < Math.abs(spreadX(best) - x)) best = i; });
    if (best !== exIndex || !exNow.textContent) { exIndex = best; exNow.textContent = String(best + 1).padStart(2, '0'); }
    exDots.forEach((b, i) => { if (i === best) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    /* the pages either side show their drawing only: their words, cut by the window's edge, read as broken */
    spreads.forEach((sp, i) => sp.classList.toggle('is-away', i !== best));
  }
  function goSpread(i, instant) {
    i = clamp(i, 0, spreads.length - 1);
    const x = spreadX(i);
    const behavior = motion && !instant ? 'smooth' : 'auto';
    if (pinned) scrollTo({ top: ex.offsetTop + clamp(x, 0, travel), behavior });
    else track.scrollTo({ left: x, behavior });
  }
  function setupExplore() {
    if (!ex) return;
    const want = motion && !coarse && innerWidth >= 900 && innerHeight >= 620;
    if (exTween) { exTween.scrollTrigger.kill(); exTween.kill(); exTween = null; gsap.set(track, { clearProps: 'transform' }); }
    pinned = want;
    root.classList.toggle('can-pin', want);
    if (!want) { ex.style.removeProperty('--travel'); return; }
    travel = Math.max(0, track.scrollWidth - innerWidth);
    ex.style.setProperty('--travel', travel + 'px');
    /* when the scrolling stops between two pages, the book settles on the nearer one */
    const pages = spreads.map((_, i) => clamp(spreadX(i), 0, travel) / travel);
    exTween = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: ex, start: 'top top', end: 'bottom bottom', scrub: 0.4, onUpdate: s => setCount(s.progress * travel),
        snap: { snapTo: v => pages.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a), inertia: false, directional: false, duration: { min: 0.2, max: 0.45 }, delay: 0.08, ease: 'power1.inOut' }
      }
    })
      .to(track, { x: -travel, duration: 1 }, 0)
      .fromTo('.thread path', { strokeDashoffset: 105, strokeDasharray: '100 110' }, { strokeDashoffset: 0, duration: 1 }, 0);
  }
  if (ex) {
    track.addEventListener('scroll', () => { if (!pinned) setCount(track.scrollLeft); }, { passive: true });
    $('#ex-prev').addEventListener('click', () => goSpread(exIndex - 1));
    $('#ex-next').addEventListener('click', () => goSpread(exIndex + 1));
    spreads.forEach((s, i) => s.addEventListener('focusin', () => {
      if (!pinned) return;
      exPin.scrollLeft = 0;
      if (Math.abs(spreadX(i) - (scrollY - ex.offsetTop)) > s.offsetWidth * 0.35) goSpread(i, true);
    }));
    setCount(0);
  }

  /* -------------------------------------------------------------- 06 map */
  const ZONE = {
    poblacion: ['the old town', 'Poblacion', 'City Hall, the Basilica and Plaza Mabini stand within a few blocks of each other, a short way up the Calumpang from the bay.', 'Walk the old town', 'heritage.html#houses'],
    port: ['ferries and cranes', 'The port', 'Batangas International Port, at Sta. Clara. Passenger ferries leave for Mindoro and the islands beyond, and container ships load beside them.', 'Port and logistics', 'business.html#port'],
    north: ['where the tollway ends', 'Alangilan & Balagtas', 'STAR Tollway arrives here from Manila, beside the bus terminal and the university campuses.', 'Getting to the city', 'visit.html#plan'],
    coast: ['the working shore', 'The industrial coast', 'From Tabangao to Ilijan the coast holds fuel import terminals, a petrochemical complex and gas-fired power plants.', 'Doing business', 'business.html#invest'],
    uplands: ['the high ground', 'Mt. Banoy uplands', 'The city climbs from the bay to Mt. Banoy, its highest point at about 968 m, on the eastern edge in Talumpok Silangan.', 'Destinations', 'visit.html#plan'],
    verde: ['across the water', 'Verde Island', 'Island barangays in the middle of the Verde Island Passage, reached by boat from the city.', 'The bay and the passage', 'visit.html#plan']
  };
  const zoneGroups = $$('.scene--map .zone');
  const zoneWashes = $$('.scene--map .zone-wash');
  const zoneBtns = $$('#zones button');
  const card = $('#zone-card');
  let zone = null;
  function setZone(key) {
    if (!card || !ZONE[key] || key === zone) return;
    zone = key;
    zoneGroups.forEach(g => g.classList.toggle('is-on', g.dataset.zone === key));
    zoneWashes.forEach(w => {
      const on = w.dataset.zone === key;
      w.classList.toggle('is-on', on);
      if (on && motion && !lite() && card.dataset.ready) {
        w.classList.add('blooming');
        gsap.fromTo(w, { '--b': 0 }, { '--b': 1, duration: 1.1, ease: 'power1.out', onComplete() { w.classList.remove('blooming'); w.style.removeProperty('--b'); } });
      }
    });
    zoneBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.zone === key)));
    const z = ZONE[key];
    $('#zone-hand').textContent = z[0];
    $('#zone-title').textContent = z[1];
    $('#zone-text').textContent = z[2];
    const link = $('#zone-link');
    link.firstChild.textContent = z[3] + ' ';
    link.setAttribute('href', z[4]);
    card.classList.remove('is-swap');
    void card.offsetWidth;
    card.classList.add('is-swap');
    card.dataset.ready = '1';
  }
  zoneBtns.forEach(b => b.addEventListener('click', () => setZone(b.dataset.zone)));
  zoneGroups.forEach(g => {
    const hit = $('.hit', g);
    hit.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') setZone(g.dataset.zone); });
    hit.addEventListener('click', () => setZone(g.dataset.zone));
  });
  setZone('poblacion');

  /* ----------------------------------------------------------- 07 people */
  const pScene = $('.scene--people');
  const persons = pScene ? $$('.person', pScene) : [];
  const pDabs = pScene ? $$('.dab', pScene) : [];
  const who = $$('#who a');
  function setPerson(key) {
    pScene.classList.toggle('has-on', !!key);
    persons.forEach(g => g.classList.toggle('is-on', g.dataset.person === key));
    pDabs.forEach(i => i.classList.toggle('is-on', i.dataset.person === key));
    who.forEach(a => a.classList.toggle('is-on', a.dataset.person === key));
  }
  persons.forEach(g => {
    const hit = $('.hit', g);
    hit.addEventListener('pointerenter', () => setPerson(g.dataset.person));
    hit.addEventListener('pointerleave', () => setPerson(null));
    hit.addEventListener('click', () => {
      const a = who.find(x => x.dataset.person === g.dataset.person);
      if (coarse) { setPerson(g.dataset.person); a.scrollIntoView({ block: 'nearest', behavior: motion ? 'smooth' : 'auto' }); } else a.click();
    });
  });
  who.forEach(a => {
    a.addEventListener('pointerenter', () => setPerson(a.dataset.person));
    a.addEventListener('pointerleave', () => setPerson(null));
    a.addEventListener('focus', () => setPerson(a.dataset.person));
    a.addEventListener('blur', () => setPerson(null));
  });

  /* ------------------------------------------------------ 08 fiesta, 09 news */
  (function feast() {
    /* the date in the Philippines, whatever the visitor's own clock says (a resident abroad, a laptop set to another zone) */
    const now = new Date();
    const ph = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    if ($('#today')) $('#today').textContent = now.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (!$('#days')) return;
    const today = new Date(ph.getFullYear(), ph.getMonth(), ph.getDate());
    let f = new Date(today.getFullYear(), 0, 16);
    if (f < today) f = new Date(today.getFullYear() + 1, 0, 16);
    const days = Math.round((f - today) / 864e5);
    $('#days').textContent = days === 0 ? 'Today' : String(days);
    $('#feast-date').textContent = '16 January ' + f.getFullYear();
  })();

  const filters = $$('.filters button');
  const stories = $$('#news-grid .story');
  filters.forEach(b => b.addEventListener('click', () => {
    const cat = b.dataset.filter;
    filters.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    stories.forEach(s => { s.hidden = cat !== 'all' && s.dataset.cat !== cat; s.classList.add('is-in'); });
  }));
  /* the news page's pictograms pick a filter */
  $$('[data-jump-filter]').forEach(a => a.addEventListener('click', () => { const b = filters.find(x => x.dataset.filter === a.dataset.jumpFilter); if (b) b.click(); }));

  /* ------------------------------------------------------- ambient motion */
  /* every chapter is live from the start (the client's call); the movers are
     compositor-only, and everything pauses while the tab is hidden */
  if (motion) {
    $$('.hero, main > section.ch, .foot').forEach(el => el.classList.add('is-live'));
    d.addEventListener('visibilitychange', () => root.classList.toggle('is-asleep', d.hidden));
  }

  /* ------------------------------------------------------ nav, menu, search */
  const nav = $('#nav');
  /* the way back up: shown once the hero is all but gone. Where the gutter is
     narrower than the button (tablets, phones) it would sit on the text, so
     there it comes with the upward scroll, like the bar */
  const totop = $('#totop');
  let past = false;
  let goingUp = false;
  const showTop = () => totop.classList.toggle('is-on', past && (innerWidth > 1100 || goingUp));
  new IntersectionObserver(es => { past = !es[0].isIntersecting; showTop(); }, { rootMargin: '0px 0px -75% 0px' }).observe(hero || $('.page__head') || $('main'));
  totop.addEventListener('click', e => {
    e.preventDefault();   // no #top in the address: a reload should still play the intro
    scrollTo({ top: 0, behavior: motion ? 'smooth' : 'auto' });
    $('.nav__brand').focus({ preventScroll: true });
  });
  let lastY = scrollY;
  const onScroll = () => {
    nav.classList.toggle('is-scrolled', scrollY > 40);
    /* on a phone the bar steps aside while reading down and returns on the way up */
    if (Math.abs(scrollY - lastY) > 6) {
      nav.classList.toggle('is-away', innerWidth <= 760 && scrollY > lastY && scrollY > 200);
      goingUp = scrollY < lastY;
      showTop();
      lastY = scrollY;
    }
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* the section spy is the homepage's; an inner page marks its own link when it is built */
  if (hero) {
    const links = $$('.nav__links a');
    const spy = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      links.forEach(a => {
        if (a.getAttribute('href') === '#' + e.target.id) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    }), { rootMargin: '-45% 0px -50% 0px' });
    $$('main > section[id], footer').forEach(s => spy.observe(s));
  }

  let layer = null;
  let lastFocus = null;
  const behind = [$('main'), nav, $('.foot'), $('#dock'), totop];
  function openLayer(id) {
    if (layer) closeLayer(true);
    layer = $('#' + id);
    lastFocus = d.activeElement;
    layer.hidden = false;
    root.style.overflow = 'hidden';
    behind.forEach(n => { n.inert = true; });
    requestAnimationFrame(() => { if (layer) layer.classList.add('is-open'); });
    if (id === 'menu' && motion) {
      const w = $('.menu__wash', layer);
      w.classList.add('blooming');
      gsap.fromTo(w, { '--b': 0 }, { '--b': 1, duration: 1.15, ease: 'power2.out', onComplete() { w.classList.remove('blooming'); w.style.removeProperty('--b'); } });
    }
    const first = id === 'search' ? $('#q') : $('.menu__main a', layer);
    setTimeout(() => first.focus({ preventScroll: true }), 40);
    if (id === 'search') renderResults('');
  }
  function closeLayer(silent) {
    if (!layer) return;
    layer.classList.remove('is-open');
    layer.hidden = true;
    layer = null;
    root.style.overflow = '';
    behind.forEach(n => { n.inert = false; });
    if (!silent && lastFocus) lastFocus.focus({ preventScroll: true });
  }
  /* the openers are links (to the site map, to the services) so they still go somewhere without scripts; here they become buttons */
  $$('[data-open]').forEach(b => {
    if (b.tagName === 'A') {
      b.setAttribute('role', 'button');
      b.setAttribute('aria-haspopup', 'dialog');
      b.setAttribute('aria-controls', b.dataset.open);
      b.addEventListener('keydown', e => { if (e.key === ' ') { e.preventDefault(); openLayer(b.dataset.open); } });
    }
    b.addEventListener('click', e => { e.preventDefault(); openLayer(b.dataset.open); });
  });
  $$('[data-close]').forEach(b => b.addEventListener('click', () => closeLayer()));
  d.addEventListener('keydown', e => {
    if (!layer) return;
    if (e.key === 'Escape') { closeLayer(); return; }
    if (e.key !== 'Tab') return;
    const f = $$('a[href], button, input', layer).filter(n => n.offsetParent !== null);
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && d.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  $$('.menu a[href^="#"]').forEach(a => a.addEventListener('click', () => closeLayer(true)));

  /* the search index is whatever is on the page */
  const index = [];
  index.push({ label: "EBD and the Mayor's Action Center", kind: 'Service', href: 'services.html#mac', words: KEYS.mac });
  svcItems.forEach(li => {
    const name = $('b', li).textContent;
    index.push({ label: name, kind: 'Service', href: '#services', svc: li.dataset.svc, words: KEYS[li.dataset.svc] });
    /* each service's own sheet (on Services: its anchor there), with what to bring */
    $$('.svc-item__body li a', li).forEach(a => index.push({ label: a.textContent, kind: name, href: a.getAttribute('href'), words: '' }));
  });
  /* an inner page sends the homepage's chapters back to the homepage */
  const home = hero ? '' : 'index.html';
  /* "isla verde" is never shown: it is what residents type for Verde Island */
  Object.keys(ZONE).forEach(k => index.push({ label: ZONE[k][1], kind: 'City map', href: home + '#map', zone: k, home: 1, words: ZONE[k][2] + (k === 'verde' ? ' isla verde' : '') }));
  [['Explore Batangas', 'Discover', '#discover', 'tourism food culture festival subli barako bulalo montemaria plaza mabini basilica visit'],
    ['Built on heritage', 'The city', '#heritage', 'history basilica heritage 1581 founding church'],
    ['Business and investment', 'Business', '#business', 'invest port logistics bids procurement ferry tollway'],
    ['Viva Sto. Niño', 'Fiesta', '#fiesta', 'fiesta feast sto nino january procession'],
    ["The Mayor's corner", 'City Hall', '#mayor', 'mayor marvey mariño mariño message office executive order speech'],
    ["The Congresswoman's corner", 'Congress', '#congress', 'congresswoman congressman representative beverley dimacuha mariño house district bills'],
    ['News, advisories and notices', 'News', '#news', 'news advisory advisories notice events announcement'],
    ['Contact City Hall', 'Contact', '#contact', 'contact address phone hotline office city hall'],
    ['City Government', 'Government', '#government', 'mayor council sanggunian departments barangay transparency']
  ].forEach(r => index.push({ label: r[0], kind: r[1], href: home + r[2], home: 1, words: r[3] }));
  /* the ten pages and their sections, written by the build into assets/data/pages.js */
  (window.__pages || []).forEach(p => index.push(p));

  /* Every word typed must be found, in the title, the keywords or the words of
     the section, allowing for the other language, a plural or one slip of the
     finger. Titles weigh double; services come first, then pages, then sections. */
  const plain = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const toks = s => plain(s).split(/[^a-z0-9]+/).filter(Boolean);
  const STOPQ = new Set('a an and the of for to in on at by is are be do does i im my me we our you your how what where when who can get need want find please po ba ng sa na ang mga ko ako paano saan'.split(' '));
  const SAME = ['birth kapanganakan ipinanganak psa nso', 'death kamatayan namatay', 'marriage kasal wedding married', 'certificate certificates sertipiko katibayan',
    'cedula sedula ctc community', 'barangay brgy baranggay', 'clearance clearances', 'garbage basura waste trash rubbish environment cenro',
    'tax taxes buwis', 'property amilyar rpt lupa', 'permit permits permiso license licence lisensya', 'business negosyo tindahan store',
    'building gusali construction renovate', 'job jobs trabaho work employment hanapbuhay vacancy vacancies hiring peso',
    'scholarship scholarships scholar iskolar tuition matrikula', 'school schools paaralan eskwela eskuwela', 'senior seniors lolo lola elderly osca',
    'pwd disability disabled kapansanan', 'health kalusugan clinic doctor doktor', 'hospital hospitals ospital hospitalisation hospitalization',
    'vaccine vaccines bakuna immunisation immunization vaccination', 'medical medicine medicines gamot', 'assistance tulong ayuda help aid',
    'burial funeral libing abuloy', 'fire fires sunog bumbero bfp', 'police pulis pnp crime blotter', 'flood floods baha',
    'typhoon bagyo storm weather signal pagasa', 'suspension suspensions', 'earthquake lindol', 'evacuation evacuate likas',
    'emergency sakuna rescue hotline hotlines', 'mayor alkalde meyor', 'council sanggunian councilor konsehal', 'ordinance ordinances resolution resolutions',
    'congresswoman congressman representative kongresista', 'bids bid procurement philgeps tender award awards', 'budget disclosure transparency fdp',
    'ferry ferries pantalan port boat', 'fiesta feast pista', 'nino santo', 'food eat kain restaurant restaurants', 'coffee kape barako',
    'tourism tourist visit pasyalan', 'water tubig primewater', 'electricity kuryente meralco power brownout', 'library aklatan',
    'news balita advisory advisories announcement abiso anunsyo'].map(g => g.split(' '));
  const alts = t => SAME.find(g => g.includes(t)) || [t];
  /* one slip of the finger: a letter missing, added or changed, or two swapped */
  const near = (a, b) => {
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    if (i === a.length && i === b.length) return true;
    return a.slice(i + 1) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i) || a.slice(i) === b.slice(i + 1)
      || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
  };
  const hitIn = (words, a) => {
    let best = 0;
    for (const w of words) {
      if (w === a) return 3;
      if (a.length >= 3 && w.startsWith(a)) best = 2;
      else if (!best && a.length >= 5 && near(w, a)) best = 1;
    }
    return best;
  };
  const docs = index.map(e => ({ e, title: toks(e.label), all: toks([e.label, e.words, e.text, e.kind].join(' ')) }));
  const RANK = { Service: 4, Page: 3 };
  function searchFor(q) {
    const qt = toks(q).filter(t => !STOPQ.has(t));
    if (!qt.length) return [];
    const rate = (doc, spare) => {
      let score = 0, inTitle = 0, missed = 0;
      for (const t of qt) {
        let s = 0;
        for (const a of alts(t)) {   /* the word itself counts a little more than its synonyms */
          const ti = hitIn(doc.title, a);
          s = Math.max(s, (ti ? ti * 2 + 1 : hitIn(doc.all, a)) - (a === t ? 0 : 1));
        }
        if (!s && ++missed > spare) return null;   // every word must be found somewhere (or all but `spare`)
        if (s > 3) inTitle++;
        score += s;
      }
      /* a title the query says in full ("mayor" for The Mayor) beats one that only contains it */
      const rest = doc.title.filter(w => !STOPQ.has(w));
      if (rest.length && rest.every(w => qt.some(t => alts(t).some(a => w === a || (a.length >= 3 && w.startsWith(a)))))) score += 2;
      /* a page wins on its title; found only in its keywords, its sections come first */
      const rank = doc.e.kind === 'Page' ? (inTitle ? 3 : 1) : RANK[doc.e.kind] || (doc.e.home ? 1 : 2);
      return score * 10 + rank;
    };
    let out = [];
    docs.forEach(doc => { const s = rate(doc, 0); if (s !== null) out.push({ e: doc.e, score: s }); });
    /* nothing has every word ("garbage collection"): the places that have all but one */
    if (!out.length && qt.length > 1) docs.forEach(doc => { const s = rate(doc, 1); if (s !== null) out.push({ e: doc.e, score: s }); });
    /* one line per place: the same sheet can be in the index twice (from this page's list and from the pages) */
    const here = location.pathname.split('/').pop() || 'index.html';
    const seen = new Set();
    return out.sort((a, b) => b.score - a.score).map(x => x.e).filter(e => {
      const k = e.svc ? 'svc:' + e.svc : (e.href.startsWith('#') ? here + e.href : e.href);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  const TOP = [["EBD and the Mayor's Action Center", 'services.html#mac'], ['Birth, marriage and death certificates', 'services.html#birth-marriage-death-certificates'],
    ['Business permit', 'services.html#business-permit'], ['Real property tax', 'services.html#real-property-tax'], ["The City's hotlines", 'emergency.html#hotlines']];
  const results = $('#q-results');
  let showAll = false;
  function renderResults(q) {
    q = q.trim();
    const first = svcItems.length ? index.filter(i => i.kind === 'Service') : index.filter(i => i.kind === 'Service' || i.kind === 'Page');
    const all = q ? searchFor(q) : first;
    const hits = showAll ? all : all.slice(0, 8);
    const safe = q.replace(/[<>&"]/g, '');
    results.innerHTML = hits.length
      ? hits.map(h => `<li><a href="${h.href}" data-i="${index.indexOf(h)}">${h.label}<span>${h.kind}</span></a></li>`).join('')
        + (all.length > hits.length ? `<li class="more"><button type="button" class="cta" data-all>Show all ${all.length} results</button></li>` : '')
      : `<li class="none">Nothing here matches “${safe}”. Most people come for:</li>`
        + TOP.map(t => `<li><a href="${t[1]}">${t[0]}<span>Service</span></a></li>`).join('')
        + '<li class="none">In an emergency call <a class="lk" href="tel:911">911</a>, or <a class="lk" href="#contact">contact City Hall</a>.</li>';
    /* a screen reader hears how many, not the whole list again on every key */
    $('#q-count').textContent = !q ? '' : all.length ? `${all.length} result${all.length > 1 ? 's' : ''}` : 'No results';
  }
  results.addEventListener('click', e => {
    if (!e.target.closest('[data-all]')) return;
    showAll = true;
    renderResults($('#q').value);
    const a = $$('a', results)[8];
    if (a) a.focus();
  });
  $('#q').addEventListener('input', e => { showAll = false; renderResults(e.target.value); });
  /* Enter takes the first result, never one of the suggestions shown when nothing matched */
  $('#q').addEventListener('keydown', e => { if (e.key === 'Enter') { const a = $('a[data-i]', results); if (a) a.click(); } });
  results.addEventListener('click', e => {
    const a = e.target.closest('a');
    if (!a) return;
    const hit = index[+a.dataset.i];
    closeLayer(true);
    if (!hit) return;
    if (hit.svc) {
      selectSvc(hit.svc);
      if (fold.matches) { e.preventDefault(); goSvc(hit.svc); }
    }
    if (hit.zone) setZone(hit.zone);
  });

  /* inner pages: a link to something inside a fold opens the fold first */
  function openFold(id, smooth) {
    const t = id && d.getElementById(id);
    const det = t && (t.tagName === 'DETAILS' ? t : t.closest('details'));
    if (!det) return false;
    det.open = true;
    requestAnimationFrame(() => t.scrollIntoView({ block: 'start', behavior: smooth && motion ? 'smooth' : 'auto' }));
    return true;
  }
  if ($('details.fold')) {
    openFold(decodeURIComponent(location.hash.slice(1)), false);
    d.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (a && a.getAttribute('href').length > 1 && openFold(decodeURIComponent(a.getAttribute('href').slice(1)), true)) {
        e.preventDefault();
        history.replaceState(null, '', a.getAttribute('href'));
      }
    });
  }

  /* pages outside the prototype: say so instead of jumping back to the top */
  const note = $('#note');
  let noteTimer;
  d.addEventListener('click', e => {
    const a = e.target.closest('a[href="#"]');
    if (!a) return;
    e.preventDefault();
    note.textContent = 'This page is not part of the prototype yet.';
    note.classList.add('is-on');
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => note.classList.remove('is-on'), 2600);
  });

  /* ------------------------------------------------------------- footer */
  /* On a phone the four lists of links fold under their headings (the first
     stays open); on anything wider they are simply lists. */
  (function folds() {
    const mq = matchMedia('(max-width:760px)');
    const navs = $$('.foot__grid nav').map(n => {
      const h = $('h2', n);
      const b = d.createElement('button');
      b.type = 'button';
      b.textContent = h.textContent;
      h.textContent = '';
      h.appendChild(b);
      b.addEventListener('click', () => set(n, b, !n.classList.contains('is-open')));
      return [n, b];
    });
    function set(n, b, open) {
      n.classList.toggle('is-open', open);
      if (mq.matches) b.setAttribute('aria-expanded', String(open)); else b.removeAttribute('aria-expanded');
      b.tabIndex = mq.matches ? 0 : -1;
    }
    const sync = () => navs.forEach(([n, b], i) => set(n, b, mq.matches ? i === 0 : true));
    sync();
    mq.addEventListener('change', sync);
  })();

  /* --------------------------------------------------------------- cursor */
  /* ?plain keeps the system pointer, for a presenter in front of a room */
  if (motion && !coarse && !/[?&]plain\b/.test(location.search)) {
    const cur = $('#cursor');
    const label = $('b', cur);
    const LABELS = [['.svc .hit', 'Open'], ['.zone .hit', 'Explore'], ['.person .hit', 'Meet']];
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      root.classList.add('has-cursor');
      cur.style.transform = `translate3d(${e.clientX}px,${e.clientY}px,0)`;
      const t = e.target.closest ? e.target.closest('a, button, .hit, label') : null;
      cur.classList.toggle('is-link', !!t);
      let text = '';
      if (t) {
        text = t.dataset.cursor || '';
        LABELS.forEach(l => { if (t.matches(l[0])) text = l[1]; });
      }
      label.textContent = text;
      cur.classList.toggle('has-label', !!text);
      cur.classList.toggle('is-light', !!(e.target.closest && e.target.closest('.foot__in, .menu')));
    }, { passive: true });
    d.addEventListener('pointerleave', () => root.classList.remove('has-cursor'));
  }

  /* ------------------------------------------------- labels in the drawings */
  /* A label that would come out under 14px on this screen is hidden: the text
     beside every drawing names what it shows. Measured from the sheet's layout
     width, so a scene that is mid-zoom is judged at its resting size. */
  function fitLabels() {
    $$('.scene svg.ink text').forEach(t => {
      const svg = t.ownerSVGElement;
      const k = svg.closest('.scene').offsetWidth / svg.viewBox.baseVal.width;
      t.classList.toggle('is-tiny', parseFloat(t.getAttribute('font-size')) * k < 14);
    });
    /* in the hero, a label gives way to any interface text it would touch:
       the panel, the statement that replaces it, the step index, the hint,
       and the title itself; one cut by the edge of the window goes too */
    const guards = $$('.hero__panel, .hero__stage > .hero__end, .hero__steps, .hero__scroll, .hero__word, .hero__city, .hero__welcome')
      .map(e => e.getBoundingClientRect()).filter(r => r.width && r.height);
    $$('.ink--hero text').forEach(t => {
      const b = t.getBoundingClientRect();
      t.classList.toggle('is-covered', b.left < 4 || b.right > root.clientWidth - 4 || guards.some(r => b.left < r.right + 12 && b.right > r.left - 12 && b.top < r.bottom + 8 && b.bottom > r.top - 8));
    });
  }
  fitLabels();
  addEventListener('load', fitLabels);
  let labelW = innerWidth;
  let labelT;
  addEventListener('resize', () => {
    if (coarse && innerWidth === labelW) return;   // a phone's browser bar coming and going
    labelW = innerWidth;
    clearTimeout(labelT);
    labelT = setTimeout(fitLabels, 200);
  });

  /* ------------------------------------------------------------------ go */
  if (motion) {
    const go = () => { if (!root.classList.contains('is-intro')) return; runIntro(); };
    if (hero) {
      if (globe) Promise.race([globe.loaded, new Promise(r => setTimeout(r, 1800))]).then(go, go);
      else go();
    }
    chapters();
    if ($('.street')) ST.create({ trigger: '.street', start: 'top bottom', end: 'bottom top', scrub: 0.6, onUpdate(s) { panBase = s.progress; applyPan(); } });
    setupExplore();
    /* on a phone the browser bar hiding and showing is a resize too: only a
       change of width (a turn of the phone) is worth rebuilding for */
    let rt;
    let lastW = innerWidth;
    addEventListener('resize', () => {
      if (coarse && innerWidth === lastW) return;
      lastW = innerWidth;
      clearTimeout(rt);
      rt = setTimeout(() => { setupExplore(); applyPan(); ST.refresh(); }, 180);
    });
    addEventListener('load', () => { setupExplore(); ST.refresh(); });
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(() => { setupExplore(); ST.refresh(); });
  }
})();
