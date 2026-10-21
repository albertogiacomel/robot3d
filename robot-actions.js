/**
 * Logica di interazione del robot: input, macchina a stati, animazioni.
 *
 * Principi applicati (skill `videogiochi`):
 *  - simulazione separata dal rendering, passo fisso 60 Hz con catch-up limitato;
 *  - input combinato da tastiera, touch e gamepad, azzerato su blur / tab nascosta;
 *  - confini di movimento e camera verificati insieme;
 *  - audio sbloccato solo dopo un gesto utente.
 *
 * Stati: idle | walk | laugh | wave | approach | reach | grab | lift | carry | place
 */

import * as THREE from 'three';

const DEG = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);

export const STATE = {
  IDLE: 'idle',
  WALK: 'walk',
  LAUGH: 'laugh',
  WAVE: 'wave',
  APPROACH: 'approach',
  REACH: 'reach',
  GRAB: 'grab',
  LIFT: 'lift',
  CARRY: 'carry',
  PLACE: 'place',
};

export const STATE_LABEL = {
  idle: 'In attesa',
  walk: 'Cammina',
  laugh: 'Ride',
  wave: 'Saluta',
  approach: 'Avvicina alla scatola',
  reach: 'Si china per afferrare',
  grab: 'Afferra la scatola',
  lift: 'Solleva la scatola',
  carry: 'Trasporta la scatola',
  place: 'Posa la scatola',
};

const FIXED_DT = 1 / 60;
const MAX_STEPS = 10;
const PLAY_RADIUS = 9.5;
const SPEED_WALK = 2.1;
const SPEED_RUN = 3.9;

const LAUGH_DUR = 2.8;
const WAVE_DUR = 1.8;
const REACH_DUR = 1.15;
const GRAB_DUR = 0.5;
const LIFT_DUR = 1.05;
const PLACE_DUR = 1.15;

/**
 * Posa base delle braccia.
 * down: braccia abbassate lungo il corpo (default di partenza)
 * up:   braccia in V, come nel disegno originale
 */
const ARM_POSE = {
  down: { R: -85 * DEG, L: 265 * DEG },
  up: { R: 52 * DEG, L: 128 * DEG },
};

/* ------------------------------------------------------------------ *
 * Input: tastiera + touch + gamepad
 * ------------------------------------------------------------------ */
function createInput(dom) {
  const keys = new Set();
  const touch = { forward: false, back: false, left: false, right: false, run: false };
  const onAction = [];
  let muted = false;

  const MOVE_KEYS = new Set([
    'w', 'a', 's', 'd',
    'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
  ]);

  function clear() {
    keys.clear();
    touch.forward = touch.back = touch.left = touch.right = touch.run = false;
  }

  function keydown(e) {
    const k = (e.key || '').toLowerCase();
    if (MOVE_KEYS.has(k) || k === ' ') e.preventDefault();
    if (keys.has(k)) return;
    keys.add(k);
    if (k === 'l') onAction.forEach((fn) => fn('laugh'));
    if (k === 'g') onAction.forEach((fn) => fn('grab'));
    if (k === ' ') onAction.forEach((fn) => fn('wave'));
    if (k === 'r') onAction.forEach((fn) => fn('reset'));
  }

  function keyup(e) {
    keys.delete((e.key || '').toLowerCase());
  }

  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clear();
  });

  // Touch / puntatore: pulsanti con data-key
  dom.querySelectorAll('[data-key]').forEach((btn) => {
    const key = btn.dataset.key;
    const set = (v) => (e) => {
      e.preventDefault();
      touch[key] = v;
      btn.classList.toggle('is-active', v);
    };
    btn.addEventListener('pointerdown', set(true));
    btn.addEventListener('pointerup', set(false));
    btn.addEventListener('pointercancel', set(false));
    btn.addEventListener('pointerleave', set(false));
  });

  return {
    /** Vettore di movimento grezzo (x = destra, y = avanti) e flag corsa. */
    read() {
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('arrowleft') || touch.left) x -= 1;
      if (keys.has('d') || keys.has('arrowright') || touch.right) x += 1;
      if (keys.has('w') || keys.has('arrowup') || touch.forward) y += 1;
      if (keys.has('s') || keys.has('arrowdown') || touch.back) y -= 1;

      let run = keys.has('shift') || touch.run;

      // Gamepad: stick sinistro + d-pad
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const pad of pads) {
        if (!pad) continue;
        const ax = pad.axes[0] || 0;
        const ay = pad.axes[1] || 0;
        const dead = 0.25;
        if (Math.abs(ax) > dead) x += ax;
        if (Math.abs(ay) > dead) y -= ay;
        if (pad.buttons[12]?.pressed) x -= 1;
        if (pad.buttons[13]?.pressed) x += 1;
        if (pad.buttons[14]?.pressed) y += 1;
        if (pad.buttons[15]?.pressed) y -= 1;
        if (pad.buttons[10]?.pressed || pad.buttons[6]?.pressed) run = true;
        break;
      }

      const len = Math.hypot(x, y);
      if (len > 1) {
        x /= len;
        y /= len;
      }
      return { x, y, run, len: Math.min(1, len) };
    },
    on(fn) {
      onAction.push(fn);
    },
    setMuted(v) {
      muted = v;
      return muted;
    },
    isMuted: () => muted,
    clear,
  };
}

/* ------------------------------------------------------------------ *
 * Audio: risata sintetizzata (nessun asset esterno)
 * ------------------------------------------------------------------ */
function createAudio() {
  let ctx = null;
  let muted = false;

  function context() {
    if (!ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  return {
    setMuted(v) {
      muted = v;
    },
    laugh() {
      if (muted) return;
      const c = context();
      if (!c) return;
      const t0 = c.currentTime;
      for (let i = 0; i < 4; i++) {
        const osc = c.createOscillator();
        const gain = c.createGain();
        const start = t0 + i * 0.23;
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(330 - i * 26, start);
        osc.frequency.exponentialRampToValueAtTime(150 - i * 10, start + 0.19);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.16, start + 0.035);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
        osc.connect(gain).connect(c.destination);
        osc.start(start);
        osc.stop(start + 0.22);
      }
    },
  };
}

/* ------------------------------------------------------------------ *
 * IK a due ossa per le braccia
 *
 * Le braccia del disegno sono piatte (nel piano XY); per afferrare la
 * scatola servono invece braccia che puntino in avanti e gomiti piegati.
 * Si risolve l'IK analitico (intersezione di due circoli) e si orientano
 * i gruppi con una base ortonormale stabile.
 * ------------------------------------------------------------------ */
const ARM_UPPER = 1.72; // spalla -> gomito
const ARM_FORE = 1.3; // gomito -> mano

const _s = new THREE.Vector3();
const _h = new THREE.Vector3();
const _u = new THREE.Vector3();
const _w = new THREE.Vector3();
const _e = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _ax = new THREE.Vector3();
const _ay = new THREE.Vector3();
const _az = new THREE.Vector3();
const _mat = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _handR = new THREE.Vector3();
const _handL = new THREE.Vector3();
const FWD_LOCAL = new THREE.Vector3(0, 0, 1);

/** Orienta un gruppo in modo che il suo +X locale punti da `from` verso `to`. */
function aimGroup(group, from, to) {
  _dir.subVectors(to, from);
  if (_dir.lengthSq() < 1e-8) return;
  _dir.normalize();
  _az.copy(FWD_LOCAL).addScaledVector(_dir, -FWD_LOCAL.dot(_dir));
  if (_az.lengthSq() < 1e-6) {
    _az.set(0, 1, 0).addScaledVector(_dir, -_dir.y);
  }
  _az.normalize();
  _ay.crossVectors(_az, _dir).normalize();
  _mat.makeBasis(_dir, _ay, _az);
  group.quaternion.setFromRotationMatrix(_mat);
}

/**
 * Orienta braccio + avambraccio perché la mano arrivi a `handTarget`
 * (coordinate nello spazio del busto).
 */
function solveArm(arm, handTarget) {
  _s.copy(arm.group.position);
  _h.copy(handTarget);

  let d = _dir.subVectors(_h, _s).length();
  const min = Math.abs(ARM_UPPER - ARM_FORE) + 0.02;
  const max = ARM_UPPER + ARM_FORE - 0.02;
  d = THREE.MathUtils.clamp(d, min, max);

  _u.subVectors(_h, _s).normalize();
  const a = (ARM_UPPER * ARM_UPPER - ARM_FORE * ARM_FORE + d * d) / (2 * d);
  const hgt = Math.sqrt(Math.max(0, ARM_UPPER * ARM_UPPER - a * a));

  // Vettore di polarizzazione: gomito verso l'esterno e leggermente indietro
  _w.set(arm.side * 0.85, -0.45, -0.55);
  _w.addScaledVector(_u, -_w.dot(_u));
  if (_w.lengthSq() < 1e-6) _w.set(arm.side, 0, 0);
  _w.normalize();

  _e.copy(_s).addScaledVector(_u, a).addScaledVector(_w, hgt);

  // Braccio superiore
  aimGroup(arm.group, _s, _e);

  // Avambraccio: stessa direzione, espressa nello spazio locale del braccio
  _dir.subVectors(_h, _e).normalize();
  _q.copy(arm.group.quaternion).invert();
  _dir.applyQuaternion(_q);
  aimGroup(arm.elbow, new THREE.Vector3(0, 0, 0), _dir);
}

/** Obiettivi delle mani nello spazio del busto (x = destra del robot). */
const HAND_TARGETS = {
  reach: { x: 0.45, y: -1.1, z: 1.12 },
  carry: { x: 0.45, y: -0.15, z: 0.75 },
};

/* ------------------------------------------------------------------ *
 * Controller
 * ------------------------------------------------------------------ */
export function createRobotActions({ robot, body, rig, crate, scene, camera, controls, dom, onState }) {
  const input = createInput(dom);
  const audio = createAudio();

  let state = STATE.IDLE;
  let stateTime = 0;
  let walkPhase = 0;
  let carrying = false;
  let armPose = 'down';
  let autoTarget = null;
  let autoTargetYaw = null;
  let accumulator = 0;
  let demo = [];
  let demoIndex = 0;
  let demoTimer = 0;
  let demoStepStarted = false;
  let clock = 0;

  const tmpVec = new THREE.Vector3();
  const tmpVec2 = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  const camRight = new THREE.Vector3();
  const moveVec = new THREE.Vector3();

  /* ---------------- Posa: valori target e smorzamento ---------------- */
  const base = {
    armRZ: ARM_POSE.down.R,
    armLZ: ARM_POSE.down.L,
    armRX: 0,
    armLX: 0,
    elbowR: 0,
    elbowL: 0,
    elbowPitch: 0.3,
    legRX: 0,
    legLX: 0,
    kneeR: 0,
    kneeL: 0,
    bodyY: 0,
    bodyRotZ: 0,
    torsoX: 0,
    headX: 0,
    headY: 0,
    headZ: 0,
    mouthLaugh: 0,
    eyeY: 1,
    antennaZ: 0,
    clawR: 0,
    clawL: 0,
  };

  const pose = { ...base };
  const poseTarget = { ...base };

  function resetPoseTarget() {
    Object.assign(poseTarget, base);
  }

  function damp(key, lambda) {
    const k = 1 - Math.exp(-lambda * FIXED_DT);
    pose[key] += (poseTarget[key] - pose[key]) * k;
  }

  function applyPose() {
    rig.arms.R.group.rotation.z = pose.armRZ;
    rig.arms.R.group.rotation.x = pose.armRX;
    rig.arms.R.elbow.rotation.z = pose.elbowR;
    rig.arms.R.elbow.rotation.y = pose.elbowPitch;
    rig.arms.L.group.rotation.z = pose.armLZ;
    rig.arms.L.group.rotation.x = pose.armLX;
    rig.arms.L.elbow.rotation.z = pose.elbowL;
    rig.arms.L.elbow.rotation.y = pose.elbowPitch;

    rig.legs.R.group.rotation.x = pose.legRX;
    rig.legs.R.knee.rotation.x = pose.kneeR;
    rig.legs.L.group.rotation.x = pose.legLX;
    rig.legs.L.knee.rotation.x = pose.kneeL;

    body.position.y = pose.bodyY;
    body.rotation.z = pose.bodyRotZ;
    rig.chest.rotation.x = pose.torsoX;
    rig.head.rotation.x = pose.headX;
    rig.head.rotation.y = pose.headY;
    rig.head.rotation.z = pose.headZ;

    // La bocca e uno "schermo": il riso deforma i denti, non compare una bocca aperta
    rig.mouth.scale.y = 1 + pose.mouthLaugh * 0.16;
    rig.mouth.scale.x = 1 + pose.mouthLaugh * 0.05;
    const n = rig.teeth.length;
    rig.teeth.forEach((tooth, i) => {
      const u = n > 1 ? (i - (n - 1) / 2) / ((n - 1) / 2) : 0;
      const arc = 0.13 * (1 - u * u);
      tooth.position.y = pose.mouthLaugh * arc;
      tooth.position.x = tooth.userData.baseX + pose.mouthLaugh * u * 0.07;
      tooth.rotation.z = pose.mouthLaugh * -u * 0.42;
      tooth.scale.y = 1 - pose.mouthLaugh * 0.1;
    });
    rig.eyes.forEach((e) => (e.scale.y = pose.eyeY));
    rig.antennae.rotation.z = pose.antennaZ;
    rig.claws[0].rotation.z = pose.clawR;
    rig.claws[1].rotation.z = pose.clawL;
  }

  /* ---------------- Stato ---------------- */
  function setState(next) {
    if (state === next) return;
    state = next;
    stateTime = 0;
    if (onState) onState(next, STATE_LABEL[next] || next);
  }

  function getState() {
    return state;
  }

  /* ---------------- Scatola ---------------- */
  function crateWorldTarget(out) {
    return rig.carryAnchor.getWorldPosition(out);
  }

  function attachCrate() {
    rig.carryAnchor.add(crate);
    crate.position.set(0, 0, 0);
    crate.rotation.set(0, 0, 0);
    carrying = true;
  }

  function detachCrate() {
    scene.add(crate);
    const yaw = robot.rotation.y;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    crate.position.set(
      robot.position.x + fx * 0.75,
      0.35,
      robot.position.z + fz * 0.75
    );
    crate.rotation.set(0, yaw, 0);
    carrying = false;
  }

  /* ---------------- Azioni pubbliche ---------------- */
  function laugh() {
    if (state === STATE.LAUGH) return;
    setState(STATE.LAUGH);
    audio.laugh();
  }

  function wave() {
    if (state === STATE.LAUGH || state === STATE.APPROACH) return;
    setState(STATE.WAVE);
  }

  function startApproach() {
    if (carrying || state === STATE.APPROACH) return;
    const dx = crate.position.x - robot.position.x;
    const dz = crate.position.z - robot.position.z;
    const dist = Math.hypot(dx, dz) || 1;
    const ux = dx / dist;
    const uz = dz / dist;
    autoTarget = new THREE.Vector3(
      crate.position.x - ux * 1.0,
      0,
      crate.position.z - uz * 1.0
    );
    autoTargetYaw = Math.atan2(ux, uz);
    setState(STATE.APPROACH);
  }

  function toggleGrab() {
    if (carrying) {
      if (state === STATE.PLACE) return;
      setState(STATE.PLACE);
      return;
    }
    startApproach();
  }

  function resetAll() {
    carrying = false;
    armPose = 'down';
    scene.add(crate);
    crate.position.set(2.6, 0.35, 2.2);
    crate.rotation.set(0, 0.4, 0);
    robot.position.set(0, 0, 0);
    robot.rotation.y = 0;
    autoTarget = null;
    demo = [];
    resetPoseTarget();
    setState(STATE.IDLE);
  }

  function runDemo() {
    demo = [
      {
        name: 'Cammina',
        dur: 4,
        enter: () => {
          autoTarget = new THREE.Vector3(1.6, 0, 3.4);
        },
        done: () => autoTarget === null,
      },
      {
        name: 'Ridere',
        dur: 3.4,
        enter: () => laugh(),
        done: () => state !== STATE.LAUGH,
      },
      {
        name: 'Prendi la scatola',
        dur: 9,
        enter: () => startApproach(),
        done: () => state === STATE.CARRY || state === STATE.IDLE,
      },
    ];
    demoIndex = 0;
    demoTimer = 0;
    demoStepStarted = false;
  }

  input.on((action) => {
    if (action === 'laugh') laugh();
    if (action === 'grab') toggleGrab();
    if (action === 'wave') wave();
    if (action === 'reset') resetAll();
  });

  /* ---------------- Movimento ---------------- */
  function movementVector(out) {
    const raw = input.read();

    if (autoTarget) {
      const dx = autoTarget.x - robot.position.x;
      const dz = autoTarget.z - robot.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.12) {
        autoTarget = null;
        return out.set(0, 0, 0);
      }
      out.set(dx / dist, 0, dz / dist);
      return out;
    }

    if (raw.len < 0.01) return out.set(0, 0, 0);

    camera.getWorldDirection(camDir);
    camDir.y = 0;
    if (camDir.lengthSq() < 1e-6) camDir.set(0, 0, 1);
    camDir.normalize();
    camRight.crossVectors(camDir, UP).normalize();

    out.set(0, 0, 0);
    out.addScaledVector(camDir, raw.y);
    out.addScaledVector(camRight, raw.x);
    if (out.lengthSq() > 1e-6) out.normalize();
    return out;
  }

  function moveRobot(dir, dt, speed) {
    if (dir.lengthSq() < 1e-6) return false;

    const step = tmpVec.copy(dir).multiplyScalar(speed * dt);
    const nextX = robot.position.x + step.x;
    const nextZ = robot.position.z + step.z;

    // Confini di gioco: disco centrato sull'origine
    const r = Math.hypot(nextX, nextZ);
    if (r > PLAY_RADIUS) {
      const k = PLAY_RADIUS / r;
      robot.position.x = nextX * k;
      robot.position.z = nextZ * k;
    } else {
      robot.position.x = nextX;
      robot.position.z = nextZ;
    }

    // Orientamento: ruota verso la direzione di marcia
    let targetYaw = Math.atan2(dir.x, dir.z);
    if (autoTarget && autoTargetYaw !== null) targetYaw = autoTargetYaw;
    const delta = ((targetYaw - robot.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    robot.rotation.y += delta * (1 - Math.exp(-9 * FIXED_DT));

    return true;
  }

  /* ---------------- Ciclo a stati ---------------- */
  function step(dt) {
    clock += dt;
    stateTime += dt;

    const dir = movementVector(moveVec);

    switch (state) {
      case STATE.IDLE:
      case STATE.WALK: {
        const speed = input.read().run ? SPEED_RUN : SPEED_WALK;
        const moving = moveRobot(dir, dt, speed);
        if (moving) {
          walkPhase += dt * (speed > SPEED_WALK ? 11 : 8.5);
          setState(STATE.WALK);
        } else {
          walkPhase *= 1 - Math.min(1, dt * 6);
          if (state === STATE.WALK) setState(STATE.IDLE);
        }
        break;
      }

      case STATE.LAUGH: {
        // nessun movimento
        if (stateTime > LAUGH_DUR) setState(carrying ? STATE.CARRY : STATE.IDLE);
        break;
      }

      case STATE.WAVE: {
        if (stateTime > WAVE_DUR) setState(carrying ? STATE.CARRY : STATE.IDLE);
        break;
      }

      case STATE.APPROACH: {
        const speed = SPEED_WALK;
        moveRobot(dir, dt, speed);
        walkPhase += dt * 8.5;
        if (!autoTarget) setState(STATE.REACH);
        break;
      }

      case STATE.REACH: {
        if (stateTime > REACH_DUR) setState(STATE.GRAB);
        break;
      }

      case STATE.GRAB: {
        const target = crateWorldTarget(tmpVec2);
        crate.position.lerp(target, 1 - Math.exp(-9 * dt));
        if (stateTime > GRAB_DUR) {
          attachCrate();
          setState(STATE.LIFT);
        }
        break;
      }

      case STATE.LIFT: {
        if (stateTime > LIFT_DUR) setState(STATE.CARRY);
        break;
      }

      case STATE.CARRY: {
        const speed = input.read().run ? SPEED_RUN : SPEED_WALK;
        const moving = moveRobot(dir, dt, speed);
        if (moving) walkPhase += dt * (speed > SPEED_WALK ? 11 : 8.5);
        else walkPhase *= 1 - Math.min(1, dt * 6);
        break;
      }

      case STATE.PLACE: {
        if (stateTime > PLACE_DUR) {
          detachCrate();
          setState(STATE.IDLE);
        }
        break;
      }
    }

    /* ---------------- Posa per stato ---------------- */
    resetPoseTarget();

    const sway = Math.sin(clock * 0.85);
    const phase = walkPhase;
    const ap = ARM_POSE[armPose];

    // Default: respiro e micro-movimenti
    poseTarget.bodyY = Math.sin(clock * 1.15) * 0.03;
    poseTarget.headZ = Math.sin(clock * 0.75) * 0.035;
    poseTarget.headY = Math.sin(clock * 0.45) * 0.06;
    poseTarget.armRZ = ap.R + sway * 0.04;
    poseTarget.armLZ = ap.L - sway * 0.04;
    poseTarget.elbowPitch = armPose === 'up' ? 0 : 0.3;
    poseTarget.antennaZ = Math.sin(clock * 1.6) * 0.07;
    poseTarget.clawR = Math.sin(clock * 0.9) * 0.18;
    poseTarget.clawL = Math.sin(clock * 0.9 + Math.PI) * 0.18;

    if (state === STATE.WALK || state === STATE.CARRY || state === STATE.APPROACH) {
      const sw = Math.sin(phase);
      poseTarget.bodyY += Math.abs(Math.sin(phase)) * 0.06;
      poseTarget.bodyRotZ = sw * 0.04;
      poseTarget.legRX = -sw * 0.5;
      poseTarget.legLX = sw * 0.5;
      poseTarget.kneeR = Math.max(0, sw) * 0.7;
      poseTarget.kneeL = Math.max(0, -sw) * 0.7;
      poseTarget.armRX = sw * 0.12;
      poseTarget.armLX = -sw * 0.12;
    }

    if (state === STATE.LAUGH) {
      const beat = Math.sin(clock * 11);
      poseTarget.bodyY = Math.abs(Math.sin(clock * 14)) * 0.09;
      poseTarget.headX = -0.3 + Math.sin(clock * 9) * 0.13;
      poseTarget.headZ = Math.sin(clock * 7.5) * 0.09;
      poseTarget.mouthLaugh = 0.55 + Math.max(0, beat) * 0.45;
      poseTarget.eyeY = 0.45 + Math.abs(Math.sin(clock * 9)) * 0.25;
      poseTarget.armRZ = ap.R + Math.sin(clock * 9) * 0.13;
      poseTarget.armLZ = ap.L - Math.sin(clock * 9) * 0.13;
      poseTarget.bodyRotZ = Math.sin(clock * 7) * 0.05;
    }

    if (state === STATE.WAVE) {
      // Braccio destro alzato in V e oscillato (saluto)
      poseTarget.armRZ = ARM_POSE.up.R - 0.2 + Math.sin(clock * 8) * 0.18;
      poseTarget.armRX = Math.sin(clock * 8) * 0.45;
      poseTarget.mouthLaugh = 0.3 + Math.max(0, Math.sin(clock * 8)) * 0.25;
      poseTarget.eyeY = 0.75;
    }

    if (state === STATE.REACH || state === STATE.GRAB || state === STATE.PLACE) {
      poseTarget.bodyY = -0.6;
      poseTarget.torsoX = 0.28;
      poseTarget.headX = 0.3;
      poseTarget.legRX = -0.25;
      poseTarget.legLX = -0.25;
      poseTarget.kneeR = 0.85;
      poseTarget.kneeL = 0.85;
      poseTarget.armRZ = -102 * DEG;
      poseTarget.armLZ = -78 * DEG;
      poseTarget.armRX = 0.2;
      poseTarget.armLX = 0.2;
    }

    if (state === STATE.LIFT || state === STATE.CARRY) {
      poseTarget.torsoX = 0.06;
      poseTarget.armRZ = -102 * DEG;
      poseTarget.armLZ = -78 * DEG;
      poseTarget.armRX = 0.2;
      poseTarget.armLX = 0.2;
    }

    // Applicazione con smorzamento
    Object.keys(pose).forEach((k) =>
      damp(k, k === 'mouthLaugh' || k === 'eyeY' ? 15 : 9)
    );
    applyPose();

    // IK delle braccia: le mani seguono i bersagli di reach / carry
    if (
      state === STATE.REACH ||
      state === STATE.GRAB ||
      state === STATE.PLACE ||
      state === STATE.LIFT ||
      state === STATE.CARRY
    ) {
      const reach = HAND_TARGETS.reach;
      const carry = HAND_TARGETS.carry;
      const k =
        state === STATE.LIFT
          ? Math.min(1, stateTime / LIFT_DUR)
          : state === STATE.CARRY
            ? 1
            : 0;
      const tx = THREE.MathUtils.lerp(reach.x, carry.x, k);
      const ty = THREE.MathUtils.lerp(reach.y, carry.y, k);
      const tz = THREE.MathUtils.lerp(reach.z, carry.z, k);
      _handR.set(tx, ty, tz);
      _handL.set(-tx, ty, tz);
      solveArm(rig.arms.R, _handR);
      solveArm(rig.arms.L, _handL);
    }

    // La scatola appoggiata a terra resta ferma
    if (!carrying && state !== STATE.GRAB) {
      crate.position.y = 0.35;
    }

    /* ---------------- Demo ---------------- */
    if (demo.length) {
      const stepDef = demo[demoIndex];
      if (!demoStepStarted) {
        demoStepStarted = true;
        stepDef.enter();
      }
      demoTimer += dt;
      if (stepDef.done() || demoTimer > stepDef.dur) {
        demoIndex += 1;
        demoTimer = 0;
        demoStepStarted = false;
        if (demoIndex >= demo.length) demo = [];
      }
    }
  }

  /* ---------------- API pubblica ---------------- */
  function update(dtRaw) {
    accumulator += Math.min(dtRaw, 0.2);
    let steps = 0;
    while (accumulator >= FIXED_DT && steps < MAX_STEPS) {
      step(FIXED_DT);
      accumulator -= FIXED_DT;
      steps += 1;
    }
    if (steps >= MAX_STEPS) accumulator = 0;
  }

  function info() {
    return {
      state,
      label: STATE_LABEL[state] || state,
      carrying,
      position: { x: robot.position.x, z: robot.position.z },
      walkPhase,
    };
  }

  return {
    update,
    info,
    getState,
    laugh,
    wave,
    toggleGrab,
    resetAll,
    runDemo,
    isDemoRunning: () => demo.length > 0,
    setArmPose(mode) {
      armPose = mode === 'up' ? 'up' : 'down';
      return armPose;
    },
    getArmPose: () => armPose,
    setMuted: (v) => {
      audio.setMuted(v);
      input.setMuted(v);
    },
    isMuted: input.isMuted,
  };
}
