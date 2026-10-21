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
 *
 * Gerarchia di scena (necessaria alle animazioni):
 *   robot (radice, posizione sul terreno e orientamento)
 *     └ body (respiro, inclinazioni)
 *         ├ torso / neck / head / antenne
 *         ├ arms[L|R]  (pivot spalla) └ elbow (pivot gomito) └ claw
 *         ├ legs[L|R]  (pivot anca)   └ knee  (pivot ginocchio) └ piede
 *         └ carryAnchor (punto in cui la scatola viene agganciata)
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { N8AOPass } from 'n8ao';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createRobotActions } from './robot-actions.js';

const T0 = performance.now();
const DEG = Math.PI / 180;

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
  cardboard: 0xc98f4e,
  cardboardDark: 0xb87a3c,
  tape: 0xd9b48a,
};

/* ------------------------------------------------------------------ *
 * Materiali e helper di geometria
 * ------------------------------------------------------------------ */
const matCache = new Map();

/** Materiale standard condiviso (cache per colore + finitura). */
function mat(color, { rough = 0.74, metal = 0.1, flat = false, env = 0.35 } = {}) {
  const key = `${color}|${rough}|${metal}|${flat}|${env}`;
  if (!matCache.has(key)) {
    matCache.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        roughness: rough,
        metalness: metal,
        flatShading: flat,
        envMapIntensity: env,
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
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.target.set(0, 3.4, 0);
controls.minDistance = 6;
controls.maxDistance = 34;
controls.maxPolarAngle = Math.PI * 0.52;
controls.autoRotateSpeed = 1.1;

/* ------------------------------------------------------------------ *
 * Illuminazione e resa
 *
 * - env map PBR (RoomEnvironment) per i riflessi sui materiali
 * - key light unica sorgente di ombre, con frustum stretto che segue
 *   il robot: ombre definite e costanti in tutta l'area di gioco
 * - fill/rim/hemisphere tenuti bassi: le ombre restano leggibili
 * - SSAO per le occlusioni di contatto (senza ombre \"flottanti\")
 * ------------------------------------------------------------------ */
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
scene.environment = envRT.texture;

const hemisphere = new THREE.HemisphereLight(0xffffff, 0xbfa98f, 0.22);
scene.add(hemisphere);

const key = new THREE.DirectionalLight(0xfff6e8, 2.9);
key.position.set(6, 12, 9);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
key.shadow.camera.near = 1;
key.shadow.camera.far = 32;
// Il frustum segue il robot: deve coprire robot + scatola + terreno
key.shadow.camera.left = -6;
key.shadow.camera.right = 6;
key.shadow.camera.top = 9;
key.shadow.camera.bottom = -6;
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.028;
key.shadow.radius = 2;
scene.add(key);
scene.add(key.target);

const fill = new THREE.DirectionalLight(0xdfe9ff, 0.2);
fill.position.set(-8, 5, 6);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffffff, 0.45);
rim.position.set(-2, 7, -10);
scene.add(rim);

/* ------------------------------------------------------------------ *
 * Pipeline di post-processing: N8AO (occlusioni) + OutputPass
 *
 * N8AO sostituisce il RenderPass: calcola l'occlusione ambientale in un
 * solo passaggio con denoise bilaterale, quindi meno draw call di SSAOPass
 * (che richiedeva un re-render di depth e normali).
 * ------------------------------------------------------------------ */
const composer = new EffectComposer(renderer);

const n8ao = new N8AOPass(scene, camera, canvas.clientWidth, canvas.clientHeight);
n8ao.configuration.aoRadius = 0.6; // raggio di campionamento in unita mondo
n8ao.configuration.distanceFalloff = 1;
n8ao.configuration.intensity = 1.9;
n8ao.configuration.color = new THREE.Color(0x000000);
n8ao.configuration.denoiseRadius = 14;
n8ao.configuration.denoiseSamples = 8;
n8ao.configuration.gammaCorrection = false; // la correzione gamma e gestita da OutputPass
composer.addPass(n8ao);
composer.addPass(new OutputPass());

// Pavimento
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(28, 96),
  new THREE.MeshStandardMaterial({
    color: 0xe9e2d4,
    roughness: 0.96,
    metalness: 0,
    envMapIntensity: 0.12,
  })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

/* ---------------- Tema chiaro / scuro ---------------- */
const THEMES = {
  light: { bg: 0xf3efe6, ground: 0xe9e2d4, key: 2.9, env: 0.12 },
  dark: { bg: 0x0d0f14, ground: 0x171a21, key: 2.2, env: 0.2 },
};

function applyThemeColors(name) {
  const t = THEMES[name] || THEMES.light;
  scene.background = new THREE.Color(t.bg);
  if (scene.fog) scene.fog.color.set(t.bg);
  ground.material.color.set(t.ground);
  ground.material.envMapIntensity = t.env;
  key.intensity = t.key;
  key.color.set(name === 'dark' ? 0xdfe6ff : 0xfff6e8);
  hemisphere.color.set(name === 'dark' ? 0x8fa0c0 : 0xffffff);
  hemisphere.groundColor.set(name === 'dark' ? 0x14161c : 0xbfa98f);
}

applyThemeColors(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
window.addEventListener('robot-theme', (e) => applyThemeColors(e.detail.theme));

/* ------------------------------------------------------------------ *
 * Costruzione del robot
 * ------------------------------------------------------------------ */
const robot = new THREE.Group();
scene.add(robot);

const body = new THREE.Group();
robot.add(body);

// Busto: pivot alla vita, permette l'inclinazione in avanti (reach, saluto)
const chest = new THREE.Group();
chest.position.y = 2.75;
body.add(chest);

const rig = {
  body,
  chest,
  torso: null,
  neck: null,
  head: null,
  antennae: null,
  mouth: null,
  teeth: [],
  eyes: [],
  arms: {},
  legs: {},
  claws: [],
  carryAnchor: null,
};

/* ---------------- Torso ---------------- */
const torsoGroup = new THREE.Group();
torsoGroup.position.y = 0.9; // 3.65 assoluti
chest.add(torsoGroup);
rig.torso = torsoGroup;

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
  neck.position.y = 1.87; // 4.62 assoluti
  chest.add(neck);
  rig.neck = neck;
  cylinder(0.3, 0.33, 0.36, 28, mat(C.pink), neck, { pos: [0, 0, 0], axis: 'y' });
  mesh(new THREE.TorusGeometry(0.31, 0.05, 10, 30), mat(C.blue), neck, {
    pos: [0, 0.09, 0],
    rot: [Math.PI / 2, 0, 0],
  });
}

/* ---------------- Testa ---------------- */
function buildHead() {
  const head = new THREE.Group();
  head.position.y = 2.9; // 5.65 assoluti
  chest.add(head);
  rig.head = head;

  // Cranio
  mesh(rbox(2.5, 1.95, 1.5, 0.32, 4), mat(C.headGrey), head, { name: 'head' });

  // Maschera frontale piu scura
  mesh(rbox(2.0, 1.5, 0.22, 0.2, 4), mat(C.headDark), head, {
    pos: [0, 0, 0.8],
    name: 'face',
  });

  // Occhi neri con riflesso (gruppo per lo squilibrio durante il riso)
  [-0.52, 0.52].forEach((x) => {
    const eye = new THREE.Group();
    eye.position.set(x, 0.16, 0.93);
    head.add(eye);
    mesh(new THREE.SphereGeometry(0.36, 32, 24), mat(C.black, { rough: 0.35 }), eye, {
      scale: [1, 1, 0.72],
      outline: false,
    });
    mesh(new THREE.SphereGeometry(0.09, 16, 12), mat(C.white, { rough: 0.2 }), eye, {
      pos: [-0.12, 0.13, 0.19],
      outline: false,
    });
    rig.eyes.push(eye);
  });

  // Bocca: uno "schermo" scuro con i denti sopra, come il display del robot.
  // Nessuna bocca aperta: durante il riso cambiano forma i denti.
  const mouth = new THREE.Group();
  mouth.position.set(0, -0.44, 0.94);
  head.add(mouth);
  rig.mouth = mouth;

  mesh(rbox(1.74, 0.68, 0.12, 0.12), mat(0x1b1b1b, { rough: 0.42, env: 0.5 }), mouth, {
    pos: [0, 0, -0.03],
    outline: false,
    name: 'mouth-screen',
  });

  // Denti: elementi separati, il loro profilo si modifica durante il riso
  rig.teeth = [];
  const TEETH = 5;
  const SPAN = 0.32;
  for (let i = 0; i < TEETH; i += 1) {
    const x = (i - (TEETH - 1) / 2) * SPAN;
    const tooth = mesh(rbox(0.28, 0.5, 0.14, 0.05), mat(C.white), mouth, {
      pos: [x, 0, 0.04],
      name: `tooth-${i}`,
    });
    tooth.userData.baseX = x;
    rig.teeth.push(tooth);
  }

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
  rig.antennae = antennae;

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
  const key = side === 1 ? 'R' : 'L';
  const arm = new THREE.Group();
  arm.position.set(side * 1.05, 1.6, 0.22); // spalla a 4.35 assoluti, davanti al torace
  arm.rotation.z = side === 1 ? 52 * DEG : 128 * DEG;
  chest.add(arm);

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

  // Avambraccio (pivot gomito)
  const elbow = new THREE.Group();
  elbow.position.set(1.72, 0, 0);
  arm.add(elbow);

  const fore = [C.green, C.orange, C.lavender, C.yellow];
  fore.forEach((c, i) => {
    mesh(rbox(0.21, 0.36, 0.34, 0.06), mat(c), elbow, {
      pos: [0.18 + i * 0.21, 0, 0],
      name: 'forearm-band',
    });
  });

  // Polso
  mesh(new THREE.SphereGeometry(0.15, 20, 16), mat(C.greyPanel), elbow, {
    pos: [0.9, 0, 0],
    name: 'wrist',
  });

  // Mano a pinza C
  const claw = new THREE.Group();
  claw.position.set(1.3, 0, 0);
  elbow.add(claw);
  rig.claws.push(claw);

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

  rig.arms[key] = { group: arm, elbow, side, base: arm.rotation.z };
}

/* ---------------- Gambe ---------------- */
function buildLeg(side) {
  const key = side === 1 ? 'R' : 'L';
  const leg = new THREE.Group();
  leg.position.set(side * 0.6, 2.75, 0);
  leg.rotation.z = side * 8 * DEG;
  body.add(leg);

  // Giunto d'anca
  cylinder(0.38, 0.38, 0.52, 32, mat(C.tan), leg, { pos: [0, -0.05, 0], outline: false });
  cylinder(0.25, 0.25, 0.16, 28, mat(C.pink), leg, { pos: [0, -0.05, 0.3], outline: false });

  // Coscia
  mesh(rbox(0.62, 1.22, 0.62, 0.14, 3), mat(C.lavender), leg, {
    pos: [0, -0.68, 0],
    name: 'thigh',
  });

  // Ginocchio (pivot)
  const knee = new THREE.Group();
  knee.position.set(0, -1.34, 0);
  leg.add(knee);

  mesh(new THREE.SphereGeometry(0.48, 28, 20), mat(C.orange), knee, {
    scale: [1, 0.62, 1],
    name: 'knee',
  });

  // Tibia a bande
  const shin = [C.blueLight, C.yellow, C.orange, C.yellow];
  shin.forEach((c, i) => {
    mesh(rbox(0.6, 0.26, 0.6, 0.06), mat(c), knee, {
      pos: [0, -0.2 - i * 0.27, 0],
      name: 'shin-band',
    });
  });

  // Piede
  mesh(rbox(0.78, 0.34, 1.0, 0.12, 3), mat(C.blueLight), knee, {
    pos: [0, -1.0, 0.12],
    name: 'foot',
  });
  mesh(rbox(0.8, 0.12, 1.02, 0.05), mat(C.orange), knee, {
    pos: [0, -1.31, 0.12],
    name: 'foot-sole',
  });

  rig.legs[key] = { group: leg, knee, side };
}

/* ---------------- Punto di aggancio della scatola ---------------- */
const carryAnchor = new THREE.Group();
carryAnchor.position.set(0, -0.15, 0.75); // spazio del busto: centro della scatola
chest.add(carryAnchor);
rig.carryAnchor = carryAnchor;

/* ---------------- Scatola di cartone ---------------- */
function buildCrate() {
  const crate = new THREE.Group();
  crate.name = 'crate';
  mesh(rbox(0.8, 0.7, 0.8, 0.04), mat(C.cardboard), crate, { name: 'crate-body' });
  mesh(rbox(0.84, 0.07, 0.84, 0.02), mat(C.tape), crate, { pos: [0, 0.36, 0], name: 'crate-tape' });
  [-0.28, 0.28].forEach((x) => {
    mesh(rbox(0.09, 0.72, 0.84, 0.02), mat(C.cardboardDark), crate, {
      pos: [x, 0, 0],
      name: 'crate-strap',
    });
  });
  mesh(rbox(0.34, 0.24, 0.02, 0.01), mat(C.white), crate, {
    pos: [0, 0.02, 0.41],
    outline: false,
    name: 'crate-label',
  });
  crate.position.set(2.6, 0.35, 2.2);
  crate.rotation.y = 0.4;
  scene.add(crate);
  return crate;
}

/* ---------------- Montaggio ---------------- */
buildTorso();
buildNeck();
buildHead();
buildArm(1);
buildArm(-1);
buildLeg(1);
buildLeg(-1);
const crate = buildCrate();

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
    // offset costante di ~0.055 unita mondo sul bordo della silhouette
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
buildOutlines(crate);

/* ------------------------------------------------------------------ *
 * Interazione: input, macchina a stati, animazioni
 * ------------------------------------------------------------------ */
const stateLabel = document.getElementById('state-label');

const actions = createRobotActions({
  robot,
  body,
  rig,
  crate,
  scene,
  camera,
  controls,
  dom: document,
  onState: (state, label) => {
    if (stateLabel) stateLabel.textContent = label;
    // site.js gestisce la traduzione dell'etichetta
    window.dispatchEvent(new CustomEvent('robot-state', { detail: { state, label } }));
  },
});

/* ------------------------------------------------------------------ *
 * Direttore di camera
 *
 * - in pausa: il target segue il robot (orbita libera dell'utente)
 * - in "cinema": la camera si posa su inquadrature calcolate dallo stato
 *   del robot, con dissolvenze morbide; l'input dell'utente ha sempre
 *   la precedenza e sospende il direttore per qualche secondo.
 * ------------------------------------------------------------------ */
const cameraDirector = {
  cinema: false,
  userUntil: 0,
  current: 'idle',
};

/** Regia cinematografica attivata dall'utente (la demo la attiva da sola). */
let cinemaEnabled = false;

const shotPos = new THREE.Vector3();
const shotTarget = new THREE.Vector3();
let cameraClock = 0;

controls.addEventListener('start', () => {
  cameraDirector.userUntil = performance.now() + 2400;
});

/** Inquadratura consigliata per lo stato corrente (coordinate mondo). */
function shotForState(state) {
  const p = robot.position;
  const yaw = robot.rotation.y;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);

  // Dolly lento per dare vita alle inquadrature
  const drift = 1 + 0.045 * Math.sin(cameraClock * 0.45);

  switch (state) {
    case 'laugh':
      // Primo piano sulla testa
      return {
        pos: [p.x + (fx * 6.2 + rx * 1.6) * drift, 6.0, p.z + (fz * 6.2 + rz * 1.6) * drift],
        target: [p.x, 5.3, p.z],
      };
    case 'wave':
      return {
        pos: [p.x + (fx * 7.5 + rx * 3.0) * drift, 5.4, p.z + (fz * 7.5 + rz * 3.0) * drift],
        target: [p.x, 4.4, p.z],
      };
    case 'reach':
    case 'grab':
    case 'lift':
      // Contrasto basso sulla scatola, a 3/4
      return {
        pos: [
          p.x + (fx * 4.4 + rx * 3.2) * drift,
          3.0,
          p.z + (fz * 4.4 + rz * 3.2) * drift,
        ],
        target: [p.x + fx * 0.9, 1.2, p.z + fz * 0.9],
      };
    case 'carry':
      // Piano medio sul robot che trasporta
      return {
        pos: [
          p.x + (fx * 8.0 + rx * 4.0) * drift,
          4.2,
          p.z + (fz * 8.0 + rz * 4.0) * drift,
        ],
        target: [p.x, 2.9, p.z],
      };
    case 'walk':
    case 'approach':
      // Campo largo per seguire il cammino
      return {
        pos: [
          p.x + (fx * 12.0 + rx * 5.5) * drift,
          5.4,
          p.z + (fz * 12.0 + rz * 5.5) * drift,
        ],
        target: [p.x + fx * 1.5, 3.0, p.z + fz * 1.5],
      };
    case 'place':
      return {
        pos: [
          p.x + (fx * 6.5 + rx * 2.6) * drift,
          3.4,
          p.z + (fz * 6.5 + rz * 2.6) * drift,
        ],
        target: [p.x + fx * 0.9, 1.0, p.z + fz * 0.9],
      };
    default:
      return { pos: [0.8, 4.9, 15.5], target: [p.x, 3.4, p.z] };
  }
}

function updateCamera(dt) {
  const now = performance.now();
  const state = actions.getState();
  cameraClock += dt;
  cameraDirector.cinema = cinemaEnabled || actions.isDemoRunning();

  if (cameraDirector.cinema && now > cameraDirector.userUntil) {
    const shot = shotForState(state);
    shotPos.set(shot.pos[0], shot.pos[1], shot.pos[2]);
    shotTarget.set(shot.target[0], shot.target[1], shot.target[2]);
    const k = 1 - Math.exp(-2.2 * dt);
    camera.position.lerp(shotPos, k);
    controls.target.lerp(shotTarget, k);
    cameraDirector.current = state;
    return;
  }

  // Camera manuale: il target segue il robot mantenendo l'orbita
  shotTarget.set(robot.position.x, 3.4, robot.position.z);
  controls.target.lerp(shotTarget, 1 - Math.exp(-2.5 * dt));
}

/* ------------------------------------------------------------------ *
 * Loop di animazione
 * ------------------------------------------------------------------ */
const clock = new THREE.Clock();
const statsEl = document.getElementById('stat-tri');
let nextStat = 0;

// Con il composer le info vanno accumulate su tutti i pass
renderer.info.autoReset = false;

function animate() {
  const dt = clock.getDelta();
  const t = clock.elapsedTime;

  // Statistiche di rendering (draw call / triangoli) del frame precedente
  if (t > nextStat) {
    nextStat = t + 0.5;
    const r = renderer.info.render;
    statsEl.textContent = `${outlineMeshes.length} mesh · ${r.calls} draw call · ${(
      r.triangles / 1000
    ).toFixed(1)}k tri`;
  }

  actions.update(dt);
  updateCamera(dt);

  // La key light (unica sorgente di ombre) segue il robot: ombre nitide ovunque
  key.position.set(robot.position.x + 6, 12, robot.position.z + 9);
  key.target.position.set(robot.position.x, 2.4, robot.position.z);
  key.target.updateMatrixWorld();

  controls.update();
  renderer.info.reset();
  composer.render();
  requestAnimationFrame(animate);
}

animate();

window.addEventListener('resize', resize);
resize();

/** Adatta renderer, composer e camera alle dimensioni reali del canvas. */
function resize() {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  if (w === 0 || h === 0) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  n8ao.setSize(w, h);
}

// Il canvas cambia dimensione con il layout (griglia, responsive)
if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(resize).observe(canvas);
}

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

bindToggle('btn-flat', false, (v) => {
  matCache.forEach((m) => {
    m.flatShading = v;
    m.needsUpdate = true;
  });
});

const audioToggle = bindToggle('btn-audio', true, (v) => {
  actions.setMuted(!v);
});

/* Braccia: abbassate (default) o in V come nel disegno */
let armsUp = false;
bindToggle('btn-arms', false, (v) => {
  armsUp = v;
  actions.setArmPose(v ? 'up' : 'down');
});

/* Regia cinematografica: inquadrature guidate dallo stato del robot */
bindToggle('btn-cinema', false, (v) => {
  cinemaEnabled = v;
});

/* ---------------- Preset di camera ---------------- */
const VIEWS = {
  front: { pos: [0.8, 4.9, 15.5], target: [0, 3.4, 0] },
  hero: { pos: [7.5, 6.4, 10.5], target: [0, 3.4, 0] },
  side: { pos: [15.5, 4.9, 0.6], target: [0, 3.4, 0] },
  back: { pos: [-0.8, 4.9, -15.5], target: [0, 3.4, 0] },
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
  actions.resetAll();
});

/* ---------------- Azioni narrative ---------------- */
document.getElementById('btn-laugh').addEventListener('click', () => actions.laugh());
document.getElementById('btn-wave').addEventListener('click', () => actions.wave());
document.getElementById('btn-grab').addEventListener('click', () => actions.toggleGrab());
document.getElementById('btn-demo').addEventListener('click', () => {
  actions.runDemo();
  autoRotate.set(false);
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
if (params.get('audio') === '0') {
  audioToggle.set(false);
}

/* Esposizione per test automatici (Playwright/Puppeteer) */
window.__robot = {
  actions,
  scene,
  renderer,
  camera,
  lights: { key, fill, rim },
  rig,
  crateObject: crate,
  info: () => actions.info(),
  state: () => actions.getState(),
  position: () => ({ x: robot.position.x, z: robot.position.z }),
  crate: () => ({ x: crate.position.x, y: crate.position.y, z: crate.position.z }),
  crateWorld: () => {
    const v = new THREE.Vector3();
    crate.getWorldPosition(v);
    return { x: v.x, y: v.y, z: v.z };
  },
  carrying: () => actions.info().carrying,
  setLang: (lang) => window.dispatchEvent(new CustomEvent('robot-lang', { detail: { lang } })),
};
