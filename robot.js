/**
 * Robot 3D — ricostruzione tridimensionale del disegno a mano (Three.js).
 *
 * Il modello e interamente procedurale: nessuna mesh esterna, nessuna texture.
 * Ogni parte del disegno originale e mappata su primitive Three.js
 * (rounded box, cylinder, sphere, torus, estrusione di un profilo 2D).
 *
 * Struttura del robot (coordinate Y, origine ai piedi):
 *   piedi 0.04 - 0.42 | tibia 0.40 - 1.34 | ginocchio 1.41
 *   coscia 1.46 - 2.68 | anca 2.75 | torso 2.75 - 4.55 | collo 4.62
 *   testa 4.68 - 6.62 | cupola 6.60 - 7.10 | antenne fino a ~7.80
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const T0 = performance.now();

/* ------------------------------------------------------------------ *
 * Palette ( campionata dal disegno originale )
 * ------------------------------------------------------------------ */
const C = {
  headGrey: 0x8a8a8a,
  headDark: 0x6d6d6d,
  headLight: 0xb8b8b8,
  black: 0x0d0d0d,
  white: 0xf4f4f2,
  blue: 0x5e9ed7,
  blueDark: 0x3c74b0,
  blueLight: 0xa8d3e6,
  pink: 0xe9a8b1,
  red: 0xd24f4a,
  redDark: 0xa83a36,
  lavender: 0xcdc3e6,
  yellow: 0xe8df87,
  green: 0xbdd08a,
  orange: 0xe2a87c,
  tan: 0xd2b0a3,
  greyPanel: 0xb6b6b6,
};

/* ------------------------------------------------------------------ *
 * Materiali e helper di geometria
 * ------------------------------------------------------------------ */
const matCache = new Map();

/** Materiale standard condiviso (cache per colore + finitura). */
function mat(color, { rough = 0.74, metal = 0.1, flat = false } = {}) {
  const key = `${color}|${rough}|${metal}|${flat}`;
  if (!matCache.has(key)) {
    matCache.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        roughness: rough,
        metalness: metal,
        flatShading: flat,
      })
    );
  }
  return matCache.get(key);
}

/** Rounded box con raggio clampato (evita geometrie degenerate). */
function rbox(w, h, d, r = 0.08, seg = 3) {
  const radius = Math.max(0.001, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
  return new RoundedBoxGeometry(w, h, d, seg, radius);
}

/** Crea mesh, la aggiunge al parent e la registra per ombre/outline. */
function mesh(geometry, material, parent, { pos, rot, scale, outline = true, name } = {}) {
  const m = new THREE.Mesh(geometry, material);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  if (scale) m.scale.set(scale[0], scale[1], scale[2]);
  m.castShadow = true;
  m.receiveShadow = true;
  m.userData.outline = outline;
  if (name) m.name = name;
  parent.add(m);
  return m;
}

/** Cilindro con asse Z (default), X oppure Y. */
function cylinder(rTop, rBot, height, segments, material, parent, opts = {}) {
  const geo = new THREE.CylinderGeometry(rTop, rBot, height, segments);
  const rot =
    opts.axis === 'x' ? [0, 0, Math.PI / 2] : opts.axis === 'y' ? [0, 0, 0] : [Math.PI / 2, 0, 0];
  return mesh(geo, material, parent, { ...opts, rot });
}

/* ------------------------------------------------------------------ *
 * Scene, renderer, luci
 * ------------------------------------------------------------------ */
const canvas = document.getElementById('scene');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf3efe6);
scene.fog = new THREE.Fog(0xf3efe6, 24, 50);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0.8, 4.9, 15.5);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.set(0, 3.9, 0);
controls.minDistance = 6;
controls.maxDistance = 34;
controls.maxPolarAngle = Math.PI * 0.52;
controls.autoRotateSpeed = 1.1;

scene.add(new THREE.HemisphereLight(0xffffff, 0xbfa98f, 0.75));

const key = new THREE.DirectionalLight(0xfff6e8, 2.3);
key.position.set(6, 12, 9);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 1;
key.shadow.camera.far = 44;
key.shadow.camera.left = -12;
key.shadow.camera.right = 12;
key.shadow.camera.top = 15;
key.shadow.camera.bottom = -2;
key.shadow.bias = -0.0009;
key.shadow.normalBias = 0.02;
scene.add(key);

const fill = new THREE.DirectionalLight(0xdfe9ff, 0.55);
fill.position.set(-8, 5, 6);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffffff, 0.85);
rim.position.set(-2, 7, -10);
scene.add(rim);

// Pavimento
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(28, 72),
  new THREE.MeshStandardMaterial({ color: 0xe9e2d4, roughness: 1, metalness: 0 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

/* ------------------------------------------------------------------ *
 * Costruzione del robot
 * ------------------------------------------------------------------ */
const robot = new THREE.Group();
scene.add(robot);

const animated = {
  head: null,
  antennae: null,
  arms: [],
  claws: [],
};

/* ---------------- Torso ---------------- */
const torsoGroup = new THREE.Group();
torsoGroup.position.y = 3.65;
robot.add(torsoGroup);

function buildTorso() {
  const wTop = 1.5;
  const wBot = 1.95;
  const h = 1.8;
  const d = 0.74;

  const shape = new THREE.Shape();
  shape.moveTo(-wTop / 2, h / 2);
  shape.lineTo(wTop / 2, h / 2);
  shape.lineTo(wBot / 2, -h / 2);
  shape.lineTo(-wBot / 2, -h / 2);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.07,
    bevelSegments: 3,
    curveSegments: 4,
  });
  geo.center();

  mesh(geo, mat(C.blue), torsoGroup, { name: 'torso' });

  // Fasce orizzontali blu scuro (segmentazione del corpo nel disegno)
  [-0.66, -0.02, 0.66].forEach((y) => {
    mesh(rbox(1.62, 0.12, 0.1, 0.04), mat(C.blueDark), torsoGroup, {
      pos: [0, y, 0.43],
      name: 'torso-band',
    });
  });

  // Bretelle scure laterali
  [-0.62, 0.62].forEach((x) => {
    mesh(rbox(0.2, 0.86, 0.12, 0.05), mat(C.blueDark), torsoGroup, {
      pos: [x, 0.42, 0.45],
      name: 'torso-strap',
    });
  });

  // Quadrante rosso con corona
  const dial = new THREE.Group();
  dial.position.set(-0.38, -0.22, 0.46);
  torsoGroup.add(dial);
  cylinder(0.42, 0.42, 0.16, 40, mat(C.red), dial, { pos: [0, 0, 0], outline: false });
  mesh(new THREE.TorusGeometry(0.46, 0.06, 12, 44), mat(C.redDark), dial, {
    pos: [0, 0, 0.06],
    name: 'dial-ring',
  });
  cylinder(0.13, 0.13, 0.2, 24, mat(C.greyPanel), dial, { pos: [0, 0, 0.02], outline: false });
  mesh(rbox(0.035, 0.3, 0.06, 0.01), mat(C.black), dial, {
    pos: [0, 0, 0.12],
    outline: false,
  });

  // Pannello quadrato con 4 pulsanti rossi
  const panel = new THREE.Group();
  panel.position.set(0.46, -0.2, 0.46);
  torsoGroup.add(panel);
  mesh(rbox(0.74, 0.74, 0.16, 0.1), mat(C.greyPanel), panel, { name: 'panel' });
  [
    [-0.17, 0.17],
    [0.17, 0.17],
    [-0.17, -0.17],
    [0.17, -0.17],
  ].forEach(([x, y]) => {
    cylinder(0.11, 0.11, 0.09, 24, mat(C.red), panel, { pos: [x, y, 0.1], outline: false });
  });
}

/* ---------------- Collo ---------------- */
function buildNeck() {
  const neck = new THREE.Group();
  neck.position.y = 4.62;
  robot.add(neck);
  cylinder(0.3, 0.33, 0.36, 28, mat(C.pink), neck, { pos: [0, 0, 0], axis: 'y' });
  mesh(new THREE.TorusGeometry(0.31, 0.05, 10, 30), mat(C.blue), neck, {
    pos: [0, 0.09, 0],
    rot: [Math.PI / 2, 0, 0],
  });
}

/* ---------------- Testa ---------------- */
function buildHead() {
  const head = new THREE.Group();
  head.position.y = 5.65;
  robot.add(head);
  animated.head = head;

  // Cranio
  mesh(rbox(2.5, 1.95, 1.5, 0.32, 4), mat(C.headGrey), head, { name: 'head' });

  // Maschera frontale piu scura
  mesh(rbox(2.0, 1.5, 0.22, 0.2, 4), mat(C.headDark), head, {
    pos: [0, 0, 0.8],
    name: 'face',
  });

  // Occhi neri con riflesso
  [-0.52, 0.52].forEach((x) => {
    mesh(new THREE.SphereGeometry(0.36, 32, 24), mat(C.black, { rough: 0.35 }), head, {
      pos: [x, 0.16, 0.93],
      scale: [1, 1, 0.72],
      outline: false,
    });
    mesh(new THREE.SphereGeometry(0.09, 16, 12), mat(C.white, { rough: 0.2 }), head, {
      pos: [x - 0.12, 0.29, 1.12],
      outline: false,
    });
  });

  // Bocca sorridente con separatori
  mesh(rbox(1.62, 0.55, 0.18, 0.13, 3), mat(C.white), head, {
    pos: [0, -0.44, 0.94],
    name: 'mouth',
  });
  [-0.48, -0.16, 0.16, 0.48].forEach((x) => {
    mesh(rbox(0.05, 0.5, 0.07, 0.01), mat(C.black, { rough: 0.5 }), head, {
      pos: [x, -0.44, 1.04],
      outline: false,
    });
  });

  // Auricolari laterali
  [-1, 1].forEach((s) => {
    cylinder(0.5, 0.5, 0.36, 32, mat(C.headLight), head, {
      pos: [s * 1.4, 0, 0],
      axis: 'x',
    });
    cylinder(0.26, 0.26, 0.12, 24, mat(C.headDark), head, {
      pos: [s * 1.6, 0, 0],
      axis: 'x',
      outline: false,
    });
  });

  // Cupola centrale
  mesh(new THREE.SphereGeometry(0.5, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2), mat(C.headGrey), head, {
    pos: [0, 0.95, 0],
    name: 'dome',
  });

  // Antenne con sfera nera
  const antennae = new THREE.Group();
  head.add(antennae);
  animated.antennae = antennae;

  [-1, 1].forEach((s) => {
    const ant = new THREE.Group();
    ant.position.set(s * 0.25, 1.15, 0);
    ant.rotation.z = -s * 0.22;
    antennae.add(ant);
    cylinder(0.055, 0.055, 0.92, 12, mat(C.headDark), ant, {
      pos: [0, 0.46, 0],
      axis: 'y',
    });
    mesh(new THREE.SphereGeometry(0.15, 20, 16), mat(C.black, { rough: 0.35 }), ant, {
      pos: [0, 0.95, 0],
      outline: false,
    });
  });
}

/* ---------------- Braccia ---------------- */
/**
 * Braccio: pivot alla spalla, direzione locale +X = verso l'esterno.
 * side = +1 (x positivo) oppure -1 (x negativo).
 */
function buildArm(side) {
  const arm = new THREE.Group();
  arm.position.set(side * 1.05, 4.35, 0);
  arm.rotation.z = side === 1 ? THREE.MathUtils.degToRad(52) : THREE.MathUtils.degToRad(128);
  robot.add(arm);
  animated.arms.push({ arm, base: arm.rotation.z, side });

  // Giunto radice
  cylinder(0.46, 0.46, 0.6, 32, mat(C.tan), arm, { pos: [0, 0, 0], outline: false });
  cylinder(0.3, 0.3, 0.16, 28, mat(C.pink), arm, { pos: [0, 0, 0.34], outline: false });

  // Braccio superiore a bande
  const upper = [C.lavender, C.yellow, C.green, C.orange, C.lavender, C.blueLight];
  upper.forEach((c, i) => {
    mesh(rbox(0.22, 0.4, 0.38, 0.06), mat(c), arm, {
      pos: [0.47 + i * 0.22, 0, 0],
      name: 'upper-arm-band',
    });
  });

  // Piccolo disco centrale
  cylinder(0.17, 0.17, 0.16, 24, mat(C.white), arm, { pos: [0.91, 0, 0.25], outline: false });

  // Avambraccio a bande
  const fore = [C.green, C.orange, C.lavender, C.yellow];
  fore.forEach((c, i) => {
    mesh(rbox(0.21, 0.36, 0.34, 0.06), mat(c), arm, {
      pos: [1.9 + i * 0.21, 0, 0],
      name: 'forearm-band',
    });
  });

  // Polso
  mesh(new THREE.SphereGeometry(0.15, 20, 16), mat(C.greyPanel), arm, {
    pos: [2.62, 0, 0],
    name: 'wrist',
  });

  // Mano a pinza C
  const claw = new THREE.Group();
  claw.position.set(3.02, 0, 0);
  arm.add(claw);
  animated.claws.push(claw);

  const gap = Math.PI * 0.45;
  const arc = Math.PI * 2 - gap * 2;

  cylinder(0.26, 0.26, 0.12, 32, mat(C.white), claw, { pos: [0, 0, 0.02], outline: false });

  const cShape = mesh(
    new THREE.TorusGeometry(0.44, 0.12, 14, 48, arc),
    mat(C.red),
    claw,
    { pos: [0, 0, 0], rot: [0, 0, gap], name: 'claw-arc' }
  );
  cShape.castShadow = true;

  // Estremita della pinza (blocchetti bianchi)
  [gap, -gap].forEach((a) => {
    mesh(rbox(0.16, 0.14, 0.2, 0.04), mat(C.white), claw, {
      pos: [0.44 * Math.cos(a), 0.44 * Math.sin(a), 0],
      rot: [0, 0, a],
      outline: false,
    });
  });
}

/* ---------------- Gambe ---------------- */
function buildLeg(side) {
  const leg = new THREE.Group();
  leg.position.set(side * 0.6, 2.75, 0);
  leg.rotation.z = THREE.MathUtils.degToRad(side * 8);
  robot.add(leg);

  // Giunto d'anca
  cylinder(0.38, 0.38, 0.52, 32, mat(C.tan), leg, { pos: [0, -0.05, 0], outline: false });
  cylinder(0.25, 0.25, 0.16, 28, mat(C.pink), leg, { pos: [0, -0.05, 0.3], outline: false });

  // Coscia
  mesh(rbox(0.62, 1.22, 0.62, 0.14, 3), mat(C.lavender), leg, {
    pos: [0, -0.68, 0],
    name: 'thigh',
  });

  // Ginocchio
  mesh(new THREE.SphereGeometry(0.48, 28, 20), mat(C.orange), leg, {
    pos: [0, -1.34, 0],
    scale: [1, 0.62, 1],
    name: 'knee',
  });

  // Tibia a bande
  const shin = [C.blueLight, C.yellow, C.orange, C.yellow];
  shin.forEach((c, i) => {
    mesh(rbox(0.6, 0.26, 0.6, 0.06), mat(c), leg, {
      pos: [0, -1.54 - i * 0.27, 0],
      name: 'shin-band',
    });
  });

  // Piede
  mesh(rbox(0.78, 0.34, 1.0, 0.12, 3), mat(C.blueLight), leg, {
    pos: [0, -2.5, 0.12],
    name: 'foot',
  });
  mesh(rbox(0.8, 0.12, 1.02, 0.05), mat(C.orange), leg, {
    pos: [0, -2.65, 0.12],
    name: 'foot-sole',
  });
}

/* ---------------- Montaggio ---------------- */
buildTorso();
buildNeck();
buildHead();
buildArm(1);
buildArm(-1);
buildLeg(1);
buildLeg(-1);

/* ------------------------------------------------------------------ *
 * Passata outline (stile "disegno a mano": silhouette nera)
 * ------------------------------------------------------------------ */
const outlineMaterial = new THREE.MeshBasicMaterial({
  color: 0x1b1b1b,
  side: THREE.BackSide,
});

const outlineMeshes = [];

function buildOutlines(root) {
  const targets = [];
  root.traverse((o) => {
    if (o.isMesh && o.userData.outline !== false) targets.push(o);
  });

  targets.forEach((m) => {
    m.geometry.computeBoundingBox();
    const size = new THREE.Vector3();
    m.geometry.boundingBox.getSize(size);
    const scale = new THREE.Vector3().copy(m.scale);
    const maxDim = Math.max(
      size.x * Math.abs(scale.x),
      size.y * Math.abs(scale.y),
      size.z * Math.abs(scale.z)
    );
    if (!Number.isFinite(maxDim) || maxDim <= 0) return;

    const o = new THREE.Mesh(m.geometry, outlineMaterial);
    // offset costante di ~0.045 unita mondo sul bordo della silhouette
    o.scale.copy(scale).multiplyScalar(1 + 0.11 / maxDim);
    o.position.copy(m.position);
    o.quaternion.copy(m.quaternion);
    o.castShadow = false;
    o.receiveShadow = false;
    o.renderOrder = -1;
    o.userData.isOutline = true;
    m.parent.add(o);
    outlineMeshes.push(o);
  });
}

buildOutlines(robot);

// Tempo di costruzione della scena (ms)
const BUILD_MS = performance.now() - T0;

/* ------------------------------------------------------------------ *
 * Loop di animazione
 * ------------------------------------------------------------------ */
const clock = new THREE.Clock();
const statsEl = document.getElementById('stat-tri');
let nextStat = 0;

function animate() {
  const t = clock.getElapsedTime();

  // Statistiche di rendering (draw call / triangoli)
  if (t > nextStat) {
    nextStat = t + 0.5;
    const r = renderer.info.render;
    statsEl.textContent = `${outlineMeshes.length} mesh · ${r.calls} draw call · ${(
      r.triangles / 1000
    ).toFixed(1)}k tri · build ${BUILD_MS.toFixed(0)} ms`;
  }

  // Respiro
  robot.position.y = Math.sin(t * 1.15) * 0.035;
  robot.scale.y = 1 + Math.sin(t * 1.15) * 0.006;

  // Testa: lieve dondolio
  if (animated.head) {
    animated.head.rotation.z = Math.sin(t * 0.75) * 0.035;
    animated.head.rotation.y = Math.sin(t * 0.45) * 0.06;
  }

  // Antenne
  if (animated.antennae) {
    animated.antennae.rotation.z = Math.sin(t * 1.6) * 0.07;
  }

  // Braccia: oscillazione simmetrica
  animated.arms.forEach(({ arm, base, side }) => {
    arm.rotation.z = base + Math.sin(t * 0.85 + (side > 0 ? 0 : Math.PI)) * 0.05;
    arm.rotation.x = Math.sin(t * 0.6) * 0.03;
  });

  // Pinze: rotazione lenta
  animated.claws.forEach((claw, i) => {
    claw.rotation.z = Math.sin(t * 0.9 + i * Math.PI) * 0.18;
  });

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ------------------------------------------------------------------ *
 * UI
 * ------------------------------------------------------------------ */
function bindToggle(id, initial, onChange) {
  const btn = document.getElementById(id);
  let state = initial;
  const paint = () => {
    btn.classList.toggle('is-on', state);
    btn.setAttribute('aria-pressed', String(state));
  };
  btn.addEventListener('click', () => {
    state = !state;
    paint();
    onChange(state);
  });
  paint();
  return {
    get: () => state,
    set: (v) => {
      state = v;
      paint();
      onChange(state);
    },
  };
}

const autoRotate = bindToggle('btn-rotate', true, (v) => {
  controls.autoRotate = v;
});
bindToggle('btn-outline', true, (v) => {
  outlineMeshes.forEach((o) => (o.visible = v));
});

bindToggle('btn-flat', false, (v) => {
  matCache.forEach((m) => {
    m.flatShading = v;
    m.needsUpdate = true;
  });
});

/* ---------------- Preset di camera ---------------- */
const VIEWS = {
  front: { pos: [0.8, 4.9, 15.5], target: [0, 3.9, 0] },
  hero: { pos: [7.5, 6.4, 10.5], target: [0, 3.9, 0] },
  side: { pos: [15.5, 4.9, 0.6], target: [0, 3.9, 0] },
  back: { pos: [-0.8, 4.9, -15.5], target: [0, 3.9, 0] },
  closeup: { pos: [3.6, 7.2, 8.6], target: [0, 5.3, 0] },
};

function applyView(name) {
  const v = VIEWS[name] || VIEWS.front;
  camera.position.set(v.pos[0], v.pos[1], v.pos[2]);
  controls.target.set(v.target[0], v.target[1], v.target[2]);
  controls.update();
}

const viewSelect = document.getElementById('view-select');
viewSelect.addEventListener('change', () => {
  applyView(viewSelect.value);
  autoRotate.set(false);
});

document.getElementById('btn-reset').addEventListener('click', () => {
  viewSelect.value = 'front';
  applyView('front');
  autoRotate.set(true);
});

/* Parametri URL: ?view=hero&still=1 */
const params = new URLSearchParams(window.location.search);
const urlView = params.get('view');
if (urlView && VIEWS[urlView]) {
  viewSelect.value = urlView;
  applyView(urlView);
}
if (params.get('still') === '1') {
  autoRotate.set(false);
}

document.getElementById('stat-tri').textContent = `${outlineMeshes.length} mesh`;
