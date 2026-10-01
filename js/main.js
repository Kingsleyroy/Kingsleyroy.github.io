/* =========================================================
   Kingsley Roy — portfolio
   3D scene (three.js) + scroll choreography (GSAP/Lenis)
   ========================================================= */
(() => {
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = matchMedia('(hover:none), (pointer:coarse)').matches;
const isSmall = () => innerWidth < 900;
const hasGsap = !!(window.gsap && window.ScrollTrigger);
if (hasGsap) gsap.registerPlugin(ScrollTrigger);

/* ---------- shared state, driven by scroll sections ---------- */
const state = { hue: 0, trend: 0, veil: 0 };
const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
const PALETTE = ['#8b5cf6', '#22d3ee', '#b8ff5c', '#ff5ca8'].map(c => new THREE.Color(c));
const accent = new THREE.Color(PALETTE[0]);
const accent2 = new THREE.Color(PALETTE[1]);
function updateAccent(){
  const n = PALETTE.length, h = ((state.hue % n) + n) % n, i = Math.floor(h), f = h - i;
  accent.copy(PALETTE[i]).lerp(PALETTE[(i + 1) % n], f);
  const h2 = (h + 1) % n, j = Math.floor(h2), g = h2 - j;
  accent2.copy(PALETTE[j]).lerp(PALETTE[(j + 1) % n], g);
  const root = document.documentElement.style;
  root.setProperty('--accent', '#' + accent.getHexString());
  root.setProperty('--accent-2', '#' + accent2.getHexString());
}

/* =========================================================
   1. LOADER
   ========================================================= */
const loadBar = $('#loadBar'), loadPct = $('#loadPct');
let seen = false;
try { seen = sessionStorage.getItem('kr-seen') === '1'; sessionStorage.setItem('kr-seen', '1'); } catch (e) {}
if (seen) $('#loader').style.display = 'none';   // repeat visit in the same session: no loader
let loadValue = 0;
function setLoad(p){
  loadValue = Math.max(loadValue, p);
  const v = Math.round(loadValue * 100);
  loadBar.style.width = v + '%'; loadPct.textContent = v;
}
let loadDone = false;
function finishLoad(){
  if (loadDone) return; loadDone = true;
  setLoad(1);
  setTimeout(revealSite, 120);
}
setTimeout(finishLoad, 2500); // safety net: never keep visitors waiting

/* =========================================================
   2. THREE.JS SCENE
   ========================================================= */
const canvas = $('#gl');
let gl = null; // { render, onResize, hero, ... }

function initScene(){
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !isTouch, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isTouch ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x07070d, 0.028);
  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, .1, 120);
  camera.position.set(0, 0, 9);
  scene.add(camera);

  /* lights tinted by the accent colours */
  scene.add(new THREE.AmbientLight(0xffffff, .55));
  const key = new THREE.PointLight(0xffffff, 1.4, 40); key.position.set(5, 4, 6); scene.add(key);
  const rim = new THREE.PointLight(0xffffff, 1.6, 40); rim.position.set(-6, -2, 4); camera.add(rim); rim.position.set(-6, -2, -2);
  camera.add(key); key.position.set(5, 4, -3);

  const tintMats = [];  // [{ mat, mode:'color'|'emissive', mix }]
  const tint = (mat, mode = 'color', k = 1) => { tintMats.push({ mat, mode, k }); return mat; };

  /* ----- hero group: portrait + rings + glow ----- */
  const hero = new THREE.Group(); scene.add(hero);
  const portraitH = 5.7, portraitW = portraitH * (1267 / 1400);

  const portraitUniforms = { map: { value: null }, opacity: { value: 0 }, tint: { value: new THREE.Color(1, 1, 1) }, mode: { value: 0 } };
  const portraitMat = new THREE.ShaderMaterial({
    uniforms: portraitUniforms, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D map; uniform float opacity; uniform vec3 tint; uniform float mode; varying vec2 vUv;
      void main(){
        vec4 c = texture2D(map, vUv);
        float fade = smoothstep(0.0, 0.16, vUv.y);
        vec3 col = mix(c.rgb, tint, mode);
        gl_FragColor = vec4(col, c.a * fade * opacity);
      }`
  });
  const portrait = new THREE.Mesh(new THREE.PlaneGeometry(portraitW, portraitH), portraitMat);
  portrait.position.y = -.35;
  hero.add(portrait);

  /* accent "rim" copy of the portrait behind it, additive, slightly larger */
  const rimUniforms = { map: portraitUniforms.map, opacity: { value: 0 }, tint: { value: accent }, mode: { value: 1 } };
  const rimMat = new THREE.ShaderMaterial({
    uniforms: rimUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: portraitMat.vertexShader, fragmentShader: portraitMat.fragmentShader
  });
  const rimMesh = new THREE.Mesh(new THREE.PlaneGeometry(portraitW, portraitH), rimMat);
  rimMesh.position.set(0, -.35, -.25); rimMesh.scale.setScalar(1.02);
  hero.add(rimMesh);

  /* radial glow disc */
  const gc = document.createElement('canvas'); gc.width = gc.height = 256;
  const gx = gc.getContext('2d'), grd = gx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,255,255,.9)'); grd.addColorStop(.35, 'rgba(255,255,255,.28)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  gx.fillStyle = grd; gx.fillRect(0, 0, 256, 256);
  const glowMat = tint(new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, color: 0x8b5cf6 }));
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), glowMat);
  glow.position.set(0, 0, -2); hero.add(glow);

  /* orbit rings + satellites */
  const ringMat1 = tint(new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0 }));
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(3.5, .012, 8, 220), ringMat1);
  ring1.rotation.x = 1.25; ring1.position.y = -.3; hero.add(ring1);
  const ringMat2 = tint(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0 }), 'color', 1);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(4.3, .008, 8, 220), ringMat2);
  ring2.rotation.set(1.05, .5, 0); ring2.position.y = -.3; hero.add(ring2);
  const sats = [];
  for (let i = 0; i < 3; i++){
    const m = tint(new THREE.MeshStandardMaterial({ color: 0x1b1b2a, emissive: 0x8b5cf6, emissiveIntensity: 1.6, metalness: .3, roughness: .3, transparent: true, opacity: 0 }), 'emissive');
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(i === 0 ? .17 : .1, 1), m);
    hero.add(s); sats.push({ mesh: s, r: i === 0 ? 3.5 : 4.3, a: i * 2.1, sp: .45 - i * .1, tilt: i === 0 ? 1.25 : 1.05 });
  }

  /* ----- floating geometry that the camera drifts past while scrolling ----- */
  const DEPTH = 34;                       // how far the camera travels downward
  const floaters = [];
  const geos = [
    () => new THREE.IcosahedronGeometry(1, 0),
    () => new THREE.TorusKnotGeometry(.7, .22, 120, 14),
    () => new THREE.OctahedronGeometry(1, 0),
    () => new THREE.TorusGeometry(.9, .22, 14, 40),
    () => new THREE.DodecahedronGeometry(.9, 0),
    () => new THREE.BoxGeometry(1.1, 1.1, 1.1),
    () => new THREE.ConeGeometry(.8, 1.5, 5)
  ];
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const N = isTouch ? 12 : 20;
  for (let i = 0; i < N; i++){
    const g = geos[i % geos.length]();
    const wire = i % 3 === 0;
    const mat = wire
      ? tint(new THREE.MeshBasicMaterial({ color: 0x8b5cf6, wireframe: true, transparent: true, opacity: .55 }))
      : tint(new THREE.MeshStandardMaterial({ color: 0x14141f, emissive: 0x8b5cf6, emissiveIntensity: .18, metalness: .85, roughness: .22, flatShading: i % 2 === 0 }), 'emissive');
    const mesh = new THREE.Mesh(g, mat);
    const side = i % 2 ? 1 : -1;
    const y = -3.5 - (i / N) * DEPTH + (rnd() - .5) * 1.5;
    mesh.position.set(side * (3.8 + rnd() * 4.2), y, -1 - rnd() * 7);
    const sc = .55 + rnd() * 1.1; mesh.scale.setScalar(sc);
    mesh.rotation.set(rnd() * 6, rnd() * 6, rnd() * 6);
    scene.add(mesh);
    floaters.push({ mesh, base: mesh.position.clone(), rs: new THREE.Vector3(rnd() - .5, rnd() - .5, rnd() - .5).multiplyScalar(.6), ph: rnd() * 6 });
  }

  /* ----- particles ----- */
  const PN = isTouch ? 900 : 2400;
  const pPos = new Float32Array(PN * 3);
  for (let i = 0; i < PN; i++){
    pPos[i * 3] = (rnd() - .5) * 34;
    pPos[i * 3 + 1] = 6 - rnd() * (DEPTH + 14);
    pPos[i * 3 + 2] = -rnd() * 22 + 4;
  }
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = tint(new THREE.PointsMaterial({ size: .045, color: 0x8b5cf6, transparent: true, opacity: .75, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  const points = new THREE.Points(pGeo, pMat); scene.add(points);

  /* ----- the "uptrend": 3D bar chart + rising line. Child of the camera so it sits on screen ----- */
  const trend = new THREE.Group(); camera.add(trend);
  trend.position.set(-3.6, -1.3, -9); trend.rotation.set(.08, .5, 0);
  const heights = [.7, 1.0, .9, 1.5, 1.9, 2.6, 3.4];
  const bars = [];
  const barMat = tint(new THREE.MeshStandardMaterial({ color: 0x1a1a28, emissive: 0x8b5cf6, emissiveIntensity: .55, metalness: .6, roughness: .3, transparent: true, opacity: 0 }), 'emissive');
  const edgeMat = tint(new THREE.LineBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0 }));
  heights.forEach((h, i) => {
    const geo = new THREE.BoxGeometry(.5, h, .5); geo.translate(0, h / 2, 0);
    const m = new THREE.Mesh(geo, barMat);
    m.position.x = (i - 3) * .78; m.scale.y = .0001;
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat); m.add(e);
    trend.add(m); bars.push(m);
  });
  const pts = heights.map((h, i) => new THREE.Vector3((i - 3) * .78, h + .4, 0));
  const curve = new THREE.CatmullRomCurve3(pts);
  const lineMat = tint(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0 }), 'color');
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, .035, 8, false), lineMat);
  tube.geometry.setDrawRange(0, 0); trend.add(tube);
  const tipMat = tint(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }), 'color');
  const tip = new THREE.Mesh(new THREE.SphereGeometry(.11, 16, 16), tipMat); trend.add(tip);
  const tubeIdx = tube.geometry.index.count;

  /* ----- texture ----- */
  new THREE.TextureLoader().load('images/portrait.webp', tex => {
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    portraitUniforms.map.value = tex; gl.ready = true;
    setLoad(1); finishLoad();
  }, undefined, () => { gl.failed = true; finishLoad(); });

  /* ----- API ----- */
  const intro = { v: 0 };            // 0 → 1 as the hero arrives
  const heroScroll = { p: 0 };       // 0 → 1 as the hero scrolls away
  let scrollCur = 0, scrollTarget = 0;
  const clock = new THREE.Clock();
  let paused = false;

  function layout(){
    const portraitView = innerWidth / innerHeight < .9;
    hero.userData.baseScale = portraitView ? .78 : 1;
    hero.userData.baseY = portraitView ? -.5 : 0;
    trend.position.set(portraitView ? 0 : -3.9, portraitView ? -3 : -1.3, -9);
    trend.scale.setScalar(portraitView ? .62 : .95);
  }
  layout();

  function onResize(){
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isTouch ? 1.5 : 2));
    renderer.setSize(innerWidth, innerHeight, false);
    layout();
  }

  function frame(){
    if (paused) return;
    const t = clock.getElapsedTime();
    updateAccent();
    tintMats.forEach(({ mat, mode, k }) => (mode === 'emissive' ? mat.emissive : mat.color).copy(accent).multiplyScalar(k));
    ringMat2.color.copy(accent2); lineMat.color.copy(accent2);
    key.color.copy(accent); rim.color.copy(accent2);

    scrollTarget = scrollMax() > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollMax())) : 0;
    scrollCur += (scrollTarget - scrollCur) * .075;
    mouse.sx += (mouse.x - mouse.sx) * .05; mouse.sy += (mouse.y - mouse.sy) * .05;

    /* camera glides down through the scene, with a gentle S-curve sway */
    camera.position.y = -scrollCur * DEPTH;
    camera.position.x = Math.sin(scrollCur * Math.PI * 4) * 1.1 + mouse.sx * .7;
    camera.rotation.z = Math.sin(scrollCur * Math.PI * 2) * .025;
    camera.lookAt(camera.position.x * .35, camera.position.y - mouse.sy * .4, 0);

    /* hero: arrival + tilt toward the cursor + leaving on scroll */
    const arr = intro.v, leave = heroScroll.p;
    const bs = hero.userData.baseScale;
    hero.position.y = hero.userData.baseY + Math.sin(t * .9) * .08;
    hero.position.z = -leave * 5.5 + (1 - arr) * -5;
    hero.rotation.y = mouse.sx * .35 - leave * .9 + (1 - arr) * 1.4;
    hero.rotation.x = -mouse.sy * .12;
    hero.scale.setScalar(bs * (.85 + arr * .15));
    const heroOpacity = arr * (1 - Math.min(1, leave * 1.15));
    portraitUniforms.opacity.value = heroOpacity;
    rimUniforms.opacity.value = heroOpacity * .4;
    glowMat.opacity = heroOpacity * .6;
    ringMat1.opacity = heroOpacity * .4; ringMat2.opacity = heroOpacity * .25;
    ring1.rotation.z = t * .15; ring2.rotation.z = -t * .1;
    sats.forEach(s => {
      s.a += .006 * s.sp * 6;
      const x = Math.cos(s.a) * s.r, z = Math.sin(s.a) * s.r * Math.sin(s.tilt), y = Math.sin(s.a) * s.r * Math.cos(s.tilt) * .35 - .3;
      s.mesh.position.set(x, y, z); s.mesh.material.opacity = heroOpacity;
    });

    /* floaters */
    floaters.forEach((f, i) => {
      f.mesh.rotation.x += f.rs.x * .01; f.mesh.rotation.y += f.rs.y * .012; f.mesh.rotation.z += f.rs.z * .008;
      f.mesh.position.y = f.base.y + Math.sin(t * .6 + f.ph) * .35;
      f.mesh.position.x = f.base.x + Math.sin(t * .3 + f.ph) * .25 + mouse.sx * (i % 2 ? .6 : -.6);
    });
    points.rotation.y = t * .012; points.position.y = camera.position.y * .12;

    /* uptrend chart, grows as you reach "about" */
    const g = state.trend;
    bars.forEach((b, i) => {
      const k = Math.min(1, Math.max(0, g * 1.5 - i * .09));
      b.scale.y = Math.max(.0001, 1 - Math.pow(1 - k, 3));
    });
    barMat.opacity = g * .9; edgeMat.opacity = g * .9; lineMat.opacity = g; tipMat.opacity = g;
    const lg = Math.min(1, Math.max(0, (g - .3) / .7));
    tube.geometry.setDrawRange(0, Math.floor(tubeIdx * lg / 3) * 3);
    tip.position.copy(curve.getPoint(lg)); tip.scale.setScalar(.9 + Math.sin(t * 4) * .15);
    trend.rotation.y = .5 + Math.sin(t * .5) * .12 + mouse.sx * .2;
    trend.visible = g > .001;

    renderer.render(scene, camera);
  }

  const api = {
    ready: false, failed: false, intro, heroScroll, frame, onResize,
    pause(v){ paused = v; },
    get paused(){ return paused; }
  };
  return api;
}
const scrollMax = () => Math.max(1, document.documentElement.scrollHeight - innerHeight);

try { gl = initScene(); }
catch (err){
  console.warn('WebGL unavailable, using static portrait.', err);
  gl = null;
  const fb = $('#portraitFallback'); fb.hidden = false;
  if (fb.complete) finishLoad(); else { fb.onload = finishLoad; fb.onerror = finishLoad; }
  setLoad(.6);
}
if (gl) setLoad(.5);

/* =========================================================
   3. SMOOTH SCROLL + RAF
   ========================================================= */
let lenis = null;
if (window.Lenis && !reduceMotion){
  lenis = new Lenis({ lerp: .085, wheelMultiplier: .95 });
  if (hasGsap){
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
}
if (!lenis || !hasGsap){
  (function loop(){ if (lenis) lenis.raf(performance.now()); requestAnimationFrame(loop); })();
}
if (hasGsap) gsap.ticker.add(() => { if (gl) gl.frame(); });
else (function loop(){ if (gl) gl.frame(); requestAnimationFrame(loop); })();
window.addEventListener('load', () => { if (hasGsap) ScrollTrigger.refresh(); });
window.addEventListener('resize', () => { if (gl) gl.onResize(); if (hasGsap) ScrollTrigger.refresh(); });
window.addEventListener('pointermove', e => {
  mouse.x = (e.clientX / innerWidth - .5) * 2;
  mouse.y = (e.clientY / innerHeight - .5) * 2;
}, { passive: true });

/* =========================================================
   4. PAGE TRANSITIONS (curtain wipe)
   ========================================================= */
const curtain = $('#curtain'), curtainCols = $$('#curtain i'), curtainLabel = $('#curtainLabel');
let transitioning = false;
function transition(label, swap){
  if (transitioning) return;
  if (!hasGsap || reduceMotion){ swap(); return; }
  transitioning = true;
  curtain.classList.add('on'); curtainLabel.textContent = label || '';
  gsap.set(curtainCols, { transformOrigin: 'bottom', scaleY: 0 });
  gsap.timeline({ onComplete: () => { curtain.classList.remove('on'); transitioning = false; } })
    .to(curtainCols, { scaleY: 1, duration: .6, ease: 'power4.inOut', stagger: { each: .06, from: 'start' } })
    .to(curtainLabel, { opacity: 1, y: 0, duration: .4, ease: 'power2.out' }, '-=.2')
    .add(swap)
    .to(curtainLabel, { opacity: 0, duration: .25 }, '+=.2')
    .set(curtainCols, { transformOrigin: 'top' })
    .to(curtainCols, { scaleY: 0, duration: .65, ease: 'power4.inOut', stagger: { each: .06, from: 'start' } });
}

/* =========================================================
   5. SITE REVEAL
   ========================================================= */
function splitWords(el){
  if (el.dataset.split) return;
  el.dataset.split = '1';
  const frag = document.createDocumentFragment();
  el.childNodes.forEach(node => {
    const words = (node.textContent || '').split(/(\s+)/);
    words.forEach(w => {
      if (!w.trim()){ frag.appendChild(document.createTextNode(w)); return; }
      const outer = document.createElement('span');
      outer.style.cssText = 'display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:.1em;margin-bottom:-.1em';
      const inner = document.createElement('span');
      inner.style.cssText = 'display:inline-block;will-change:transform';
      inner.className = 'w'; inner.textContent = w; outer.appendChild(inner); frag.appendChild(outer);
    });
  });
  el.textContent = ''; el.appendChild(frag);
}

function revealSite(){
  document.body.classList.remove('is-loading');
  const loader = $('#loader');
  const lines = $$('.hero-title .line > span');
  setupScroll();
  if (!hasGsap || reduceMotion){
    loader.style.display = 'none';
    if (gl) gl.intro.v = 1;
    return;
  }
  gsap.set(lines, { yPercent: 110 });
  gsap.set('.hero-bgtext span', { yPercent: 40, opacity: 0 });
  gsap.set('.hero-role, .hero-sub, .hero-cta, .scroll-cue, .nav', { opacity: 0, y: 18 });
  const tl = gsap.timeline();
  tl.to('.loader__inner', { y: -20, opacity: 0, duration: .3, ease: 'power2.in' })
    .to(loader, { clipPath: 'inset(0 0 100% 0)', duration: .6, ease: 'power4.inOut' }, '-=.1')
    .set(loader, { display: 'none' });
  if (gl) tl.to(gl.intro, { v: 1, duration: 1.8, ease: 'power3.out' }, '-=.4');
  tl.to('.hero-bgtext span', { yPercent: 0, opacity: 1, duration: 1.4, ease: 'power4.out', stagger: .12 }, '-=2')
    .to(lines, { yPercent: 0, duration: 1.1, ease: 'power4.out', stagger: .09 }, '-=1.6')
    .to('.hero-role, .hero-sub, .hero-cta, .scroll-cue, .nav', { opacity: 1, y: 0, duration: .9, ease: 'power3.out', stagger: .07, clearProps: 'transform' }, '-=1');
}

/* =========================================================
   6. SCROLL CHOREOGRAPHY
   ========================================================= */
function setupScroll(){
  if (!hasGsap) return;

  /* progress bar + nav state */
  const bar = $('#scrollBar'), nav = $('#nav');
  let lastY = 0;
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: self => {
      bar.style.transform = `scaleX(${self.progress})`;
      const y = self.scroll();
      nav.classList.toggle('scrolled', y > 40);
      nav.classList.toggle('hide', y > 500 && y > lastY + 4 && !document.body.classList.contains('menu-open'));
      if (y < lastY - 4 || y < 500) nav.classList.remove('hide');
      lastY = y;
    }
  });

  /* hero leaves: portrait turns away, copy lifts and fades, background text drifts */
  if (gl){
    ScrollTrigger.create({
      trigger: '.hero', start: 'top top', end: 'bottom bottom', scrub: true,
      onUpdate: self => { gl.heroScroll.p = self.progress; }
    });
  }
  gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom bottom', scrub: true } })
    .to('.hero-copy', { yPercent: -12, opacity: 0, ease: 'power1.in' }, .35)
    .to('.hero-bgtext span:first-child', { xPercent: -14, ease: 'none' }, 0)
    .to('.hero-bgtext span:last-child', { xPercent: 14, ease: 'none' }, 0)
    .to('.hero-bgtext', { opacity: 0, ease: 'power1.in' }, .45);

  /* scene changes: each section sets the hue, veil strength and chart visibility */
  $$('[data-hue]').forEach(sec => {
    const hue = parseFloat(sec.dataset.hue);
    const to = () => gsap.to(state, { hue, duration: 1.6, ease: 'power2.inOut', overwrite: 'auto' });
    ScrollTrigger.create({ trigger: sec, start: 'top 55%', end: 'bottom 55%', onEnter: to, onEnterBack: to });
  });
  ScrollTrigger.create({ trigger: '#about', start: 'top 70%', onEnter: () => gsap.to(state, { veil: 1, duration: 1.2 }), onLeaveBack: () => gsap.to(state, { veil: 0, duration: 1.2 }) });
  gsap.ticker.add(() => { $('#veil').style.opacity = state.veil; });

  ScrollTrigger.create({
    trigger: '#about', start: 'top 60%', endTrigger: '#method', end: 'top 70%',
    onEnter: () => gsap.to(state, { trend: 1, duration: 2.4, ease: 'power3.out', overwrite: 'auto' }),
    onLeave: () => gsap.to(state, { trend: 0, duration: 1, ease: 'power2.in', overwrite: 'auto' }),
    onEnterBack: () => gsap.to(state, { trend: 1, duration: 1.8, ease: 'power3.out', overwrite: 'auto' }),
    onLeaveBack: () => gsap.to(state, { trend: 0, duration: 1, ease: 'power2.in', overwrite: 'auto' })
  });

  /* active nav link */
  $$('.nav__links a').forEach(a => {
    const sec = $(a.getAttribute('href'));
    if (!sec) return;
    ScrollTrigger.create({ trigger: sec, start: 'top 50%', end: 'bottom 50%', toggleClass: { targets: a, className: 'active' } });
  });

  if (reduceMotion) return;

  /* headings: word-by-word rise */
  $$('main h2, .why__list').forEach(el => {
    if (el.matches('h2')){
      splitWords(el);
      gsap.from(el.querySelectorAll('.w'), { yPercent: 115, duration: 1.1, ease: 'power4.out', stagger: .045,
        scrollTrigger: { trigger: el, start: 'top 88%' } });
    }
  });

  /* general reveals */
  const revealSel = '.about__text p, .method__intro, .steps li, .project__meta, .project h3, .project > div:last-child > p, .project__tools, .project__link, .service, .why__list li, .ach__list li, .community p, .community .btn, .contact__lead, .contact__links li, .form, .skills__tabs, .skills__cloud, .work__head p, .kicker';
  gsap.set(revealSel, { y: 46, opacity: 0 });
  ScrollTrigger.batch(revealSel, {
    start: 'top 92%', once: true,
    onEnter: els => gsap.to(els, { y: 0, opacity: 1, duration: 1, ease: 'power3.out', stagger: .07, clearProps: 'transform,opacity' })
  });

  /* stat cards: rise + count up */
  $$('.stat').forEach((card, i) => {
    const b = $('b', card), txt = b.textContent;
    const m = txt.match(/^(\D*)(\d+)(.*)$/);
    gsap.from(card, { y: 70, opacity: 0, duration: 1.1, ease: 'power3.out', delay: i * .08, scrollTrigger: { trigger: '.stats', start: 'top 85%' }, clearProps: 'transform,opacity' });
    if (m){
      const o = { n: 0 };
      ScrollTrigger.create({ trigger: '.stats', start: 'top 85%', once: true, onEnter: () => {
        gsap.to(o, { n: +m[2], duration: 2, ease: 'power2.out', delay: i * .08, onUpdate: () => { b.textContent = m[1] + Math.round(o.n) + m[3]; } });
      } });
      b.textContent = m[1] + '0' + m[3];
    }
  });

  /* project cards: parallax in the SVG visual + wipe reveal */
  $$('.project__visual').forEach(v => {
    gsap.fromTo(v, { clipPath: 'inset(100% 0 0 0 round 28px)' }, { clipPath: 'inset(0% 0 0 0 round 28px)', duration: 1.3, ease: 'power4.out',
      scrollTrigger: { trigger: v, start: 'top 85%' }, onComplete: () => { v.style.clipPath = ''; } });
    gsap.fromTo($('svg', v), { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: v, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  /* method: highlight the step in focus */
  $$('.steps li').forEach(li => {
    ScrollTrigger.create({ trigger: li, start: 'top 60%', end: 'bottom 40%', toggleClass: { targets: li, className: 'in-focus' } });
  });
}

/* =========================================================
   7. MARQUEE (speed follows scroll velocity)
   ========================================================= */
(() => {
  const track = $('.marquee__track'); if (!track) return;
  let x = 0, dir = -1, speed = 1.1;
  const half = () => track.scrollWidth / 2;
  const tick = () => {
    const vel = lenis ? lenis.velocity : 0;
    if (vel) dir = vel > 0 ? -1 : 1;
    x += dir * (speed + Math.min(Math.abs(vel) * .6, 22));
    const h = half(); if (x <= -h) x += h; if (x > 0) x -= h;
    track.style.transform = `translate3d(${x}px,0,0)`;
  };
  if (reduceMotion) return;
  hasGsap ? gsap.ticker.add(tick) : (function l(){ tick(); requestAnimationFrame(l); })();
})();

/* =========================================================
   8. LINKS, MENU, CASE STUDIES
   ========================================================= */
let openCaseEl = null, lastFocus = null;
const menuBtn = $('#menuBtn'), menu = $('#mobileMenu');
function closeMenu(){
  menu.classList.remove('open'); menu.setAttribute('aria-hidden', 'true');
  menuBtn.setAttribute('aria-expanded', 'false'); menuBtn.textContent = 'Menu';
  document.body.classList.remove('menu-open'); if (lenis && !openCaseEl) lenis.start();
}
menuBtn.addEventListener('click', () => {
  if (menu.classList.contains('open')) return closeMenu();
  menu.classList.add('open'); menu.setAttribute('aria-hidden', 'false');
  menuBtn.setAttribute('aria-expanded', 'true'); menuBtn.textContent = 'Close';
  document.body.classList.add('menu-open'); if (lenis) lenis.stop();
});

function goTo(target){
  if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.8, easing: t => 1 - Math.pow(1 - t, 4) });
  else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
}
$$('a[href^="#"]').forEach(a => {
  if (a.dataset.case) return;
  a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const target = $(id);
    if (!target) return;
    e.preventDefault();
    const wasOpen = menu.classList.contains('open');
    closeMenu();
    if (openCaseEl){ closeCase(false, () => goTo(target)); return; }
    if (wasOpen) setTimeout(() => goTo(target), 350); else goTo(target);
  });
});

function showCase(el){
  if (openCaseEl && openCaseEl !== el){ openCaseEl.hidden = true; if (openCaseEl._ctx) openCaseEl._ctx.revert(); }
  openCaseEl = el; el.hidden = false; el.scrollTop = 0;
  document.body.classList.add('case-open');
  if (lenis) lenis.stop();
  if (gl) gl.pause(true);
  el.querySelector('.case__close').focus({ preventScroll: true });
  if (hasGsap && !reduceMotion){
    el._ctx = gsap.context(() => {
      gsap.from('.case__hero > *, .case__facts div', { y: 50, opacity: 0, duration: 1, ease: 'power3.out', stagger: .08, delay: .1 });
      $$('.case__block, .case__next', el).forEach(b => gsap.from(b, { y: 60, opacity: 0, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: b, scroller: el, start: 'top 92%' } }));
      $$('.steps li, .results div, .flow__node', el).forEach(s => gsap.from(s, { y: 30, opacity: 0, duration: .8, ease: 'power3.out',
        scrollTrigger: { trigger: s, scroller: el, start: 'top 94%' } }));
    }, el);
  }
}
function openCase(id, push = true, label){
  const el = document.getElementById(id); if (!el) return;
  if (!openCaseEl) lastFocus = document.activeElement;
  const title = label || $('h2', el).textContent;
  transition(title, () => { showCase(el); if (push) history.pushState(null, '', '#' + id); });
}
function closeCase(updateUrl = true, after){
  if (!openCaseEl) return;
  const el = openCaseEl;
  transition('Back to work', () => {
    el.hidden = true; openCaseEl = null; if (el._ctx) el._ctx.revert();
    document.body.classList.remove('case-open');
    if (hasGsap) ScrollTrigger.refresh();
    if (gl) gl.pause(false);
    if (lenis) lenis.start();
    if (updateUrl) history.pushState(null, '', '#work');
    if (lastFocus) lastFocus.focus({ preventScroll: true });
    if (after) after();
  });
}
$$('[data-case]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); openCase(a.dataset.case); }));
$$('.case__close').forEach(b => b.addEventListener('click', () => closeCase()));
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (openCaseEl) closeCase(); else closeMenu();
});
window.addEventListener('popstate', () => {
  const h = location.hash.slice(1);
  if (h.startsWith('case-')) openCase(h, false); else closeCase(false);
});
if (location.hash.startsWith('#case-')) window.addEventListener('load', () => setTimeout(() => { const el = document.getElementById(location.hash.slice(1)); if (el) showCase(el); }, 100));

/* =========================================================
   9. SKILLS FILTER, FORM
   ========================================================= */
const cloud = $('#skillCloud');
$$('.skills__tabs button').forEach(btn => btn.addEventListener('click', () => {
  $$('.skills__tabs button').forEach(b => b.setAttribute('aria-pressed', b === btn));
  const g = btn.dataset.group;
  cloud.classList.toggle('filtering', g !== 'all');
  $$('span', cloud).forEach(s => s.classList.toggle('on', s.dataset.g === g));
}));

/* Contact form.
   GitHub Pages can't send email, so the form posts to Formspree (free).
   1. Create a form at https://formspree.io (use kingsleyroy14@gmail.com)
   2. Paste its ID (the part after /f/ in the endpoint URL) below.
   Until an ID is set, the form falls back to opening the visitor's email app. */
const FORMSPREE_ID = '';

$('#contactForm').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target, el = form.elements, note = $('#formNote'), btn = $('button[type=submit]', form);
  const name = el.name.value.trim(), email = el.email.value.trim(), msg = el.message.value.trim();
  if (!name || !email || !msg || !el.email.checkValidity()){
    note.textContent = 'Add your name, a valid email and a message, then send again.';
    return;
  }
  if (el._gotcha.value) return;   // spam bot
  if (!FORMSPREE_ID){
    const subject = encodeURIComponent(`New enquiry: ${el.type.value}`);
    const body = encodeURIComponent(`${msg}\n\n${name}\n${email}`);
    window.location.href = `mailto:kingsleyroy14@gmail.com?subject=${subject}&body=${body}`;
    note.textContent = 'Your email app should open with the message ready to send.';
    return;
  }
  btn.disabled = true; note.textContent = 'Sending…';
  try {
    const res = await fetch('https://formspree.io/f/' + FORMSPREE_ID, {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, type: el.type.value, message: msg, _subject: `Portfolio enquiry: ${el.type.value}` })
    });
    if (!res.ok) throw new Error(res.status);
    form.reset(); note.textContent = 'Thanks, your message has been sent. I will reply soon.';
  } catch (err){
    note.textContent = 'Sorry, that did not send. Please email kingsleyroy14@gmail.com directly.';
  } finally { btn.disabled = false; }
});

/* =========================================================
   10. INTERACTION POLISH: tilt cards, magnetic buttons, cursor
   ========================================================= */
if (!isTouch && !reduceMotion){
  $$('.tilt-card').forEach(card => {
    const v = $('.project__visual', card);
    card.addEventListener('pointermove', e => {
      const r = v.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      v.style.transition = 'box-shadow .6s var(--ease)';
      v.style.transform = `rotateY(${(px - .5) * 14}deg) rotateX(${(.5 - py) * 12}deg) translateZ(20px)`;
      v.style.setProperty('--mx', px * 100 + '%'); v.style.setProperty('--my', py * 100 + '%');
    });
    card.addEventListener('pointerleave', () => { v.style.transition = ''; v.style.transform = ''; });
  });

  $$('.magnetic').forEach(btn => {
    btn.addEventListener('pointermove', e => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
      btn.style.transform = `translate(${x * .25}px, ${y * .35}px)`;
    });
    btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
  });
}

const cursor = $('#cursor'), cursorText = $('#cursorText');
if (matchMedia('(hover:hover) and (pointer:fine)').matches){
  let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
  addEventListener('mousemove', e => { x = e.clientX; y = e.clientY; }, { passive: true });
  (function loop(){
    cx += (x - cx) * .22; cy += (y - cy) * .22;
    cursor.style.transform = `translate(${cx}px, ${cy}px)`;
    requestAnimationFrame(loop);
  })();
  document.addEventListener('mouseover', e => {
    const labelled = e.target.closest('[data-cursor]');
    const interactive = e.target.closest('a, button, select, input, textarea');
    cursor.classList.toggle('label', !!labelled);
    cursor.classList.toggle('hover', !labelled && !!interactive);
    if (labelled) cursorText.textContent = labelled.dataset.cursor;
  });
  document.addEventListener('mouseleave', () => cursor.style.opacity = 0);
  document.addEventListener('mouseenter', () => cursor.style.opacity = 1);
}

})();
