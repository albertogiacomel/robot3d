/**
 * Shell del sito: tema chiaro/scuro e bilingue IT/EN.
 * Allineato ai pattern del sito giacomel.info (design-token.css, SiteShell).
 */

const I18N = {
  it: {
    skip: 'Salta al contenuto',
    'nav.robot': 'Robot 3D',
    'nav.storia': 'Storia',
    'nav.comandi': 'Comandi',
    'hero.eyebrow': 'Esperimento Three.js · Geometria procedurale',
    'hero.title': 'Un disegno a mano diventa un videogioco',
    'hero.lead':
      'Il robot del foglio è ricostruito pezzo per pezzo con primitive 3D: nessuna mesh importata, nessuna texture. Si muove nella scena, cammina, ride e sa afferrare la scatola di cartone.',
    'hero.cta1': 'La storia',
    'hero.cta2': 'Comandi',
    'hero.cta3': 'Codice su GitHub',
    'stat.mesh': 'mesh procedurali',
    'stat.texture': 'texture',
    'stat.states': 'stati animati',
    'hud.title': 'Controlli',
    'hud.laugh': 'Ridere',
    'hud.wave': 'Saluta',
    'hud.grab': 'Scatola',
    'hud.demo': 'Demo',
    'hud.arms': 'Braccia V',
    'hud.cinema': 'Cinema',
    'hud.rotate': 'Rotazione',
    'hud.flat': 'Flat shading',
    'hud.audio': 'Audio',
    'hud.reset': 'Reimposta',
    'hud.more': 'Impostazioni',
    'hud.view': 'Vista',
    'hud.hint': 'WASD cammina · L ride · Spazio saluta · G scatola',
    'view.front': 'Frontale',
    'view.hero': '3/4',
    'view.side': 'Laterale',
    'view.back': 'Posteriore',
    'view.closeup': 'Primo piano testa',
    'story.eyebrow': 'La spalla',
    'story.title': 'Dal foglio al videogioco',
    'story.lead':
      "Quattro passaggi, ognuno verificato nel browser: il disegno, la geometria, il rig animato e infine il gioco con controller, scatola e regia cinematografica.",
    'story.fig1':
      'Il foglio di partenza: matita a pastello, contorni tratteggiati e colori a tempera.',
    'story.fig2':
      'La ricostruzione: 66 mesh generate a runtime, contorni neri in stile disegno.',
    'story.fig3': 'Il rig: busto, gomiti e ginocchi come pivot, IK a due ossa per le braccia.',
    'story.fig4':
      'Il videogioco: muovimento libero, scatola da trasportare e regia cinematografica.',
    'story.h1': 'Il disegno',
    'story.p1':
      'Testa a televisore, antenne a sfera, braccia aperte a V con pinze a “C”, torso blu con quadrante rosso e pannello a quattro pulsanti, cosce lavanda e tibie a bande. Ogni elemento del foglio è diventato una specifica di costruzione.',
    'story.t1': 'proporzioni',
    'story.t2': 'palette',
    'story.t3': 'articolazioni',
    'story.h2': 'La geometria',
    'story.p2':
      'RoundedBoxGeometry per cranio e arti, cilindri per giunti e collo, sfere per occhi e ginocchi, un TorusGeometry ad arco per la pinza “C” e un’ExtrudeGeometry per il profilo trapezoidale del torso. I contorni sono una seconda passata di mesh con side: BackSide.',
    'story.h3': 'Il rig animato',
    'story.p3':
      'Dieci stati (idle, walk, laugh, wave, approach, reach, grab, lift, carry, place) pilotati da una macchina a stati a passo fisso a 60 Hz. Le braccia usano l’IK analitica a due ossa per afferrare la scatola, il busto si inclina per raggiungere il terreno.',
    'story.h4': 'Il videogioco',
    'story.p4':
      'Tastiera, touch e gamepad alimentano lo stesso controller; la camera segue il robot e, in modalità Cinema, cambia inquadratura in base allo stato (primo piano per la risata, campo basso per la scatola). Il tutto gira senza asset esterni.',
    'cmd.eyebrow': 'Controller',
    'cmd.title': 'Comandi',
    'cmd.h1': 'Movimento',
    'cmd.h2': 'Animazioni',
    'cmd.h3': 'Scena',
    'cmd.d1': 'Cammina',
    'cmd.d2': 'Corri',
    'cmd.d3': 'Stick sinistro e d-pad',
    'cmd.d4': 'Orbita la camera',
    'cmd.d5': 'Ride (i denti si deformano sullo schermo)',
    'cmd.d6': 'Saluta',
    'cmd.d7': 'Prende o posa la scatola',
    'cmd.d8': 'Reset della scena',
    'cmd.d9': 'Cammina, ride e raccoglie la scatola',
    'cmd.d10': 'Inquadrature guidate dallo stato',
    'cmd.d11': 'Riporta le braccia del disegno',
    'cmd.d12': 'Risata sintetizzata',
    'footer.projects': 'Progetti',
    'footer.repo': 'Repository',
  },
  en: {
    skip: 'Skip to content',
    'nav.robot': 'Robot 3D',
    'nav.storia': 'Story',
    'nav.comandi': 'Controls',
    'hero.eyebrow': 'Three.js experiment · Procedural geometry',
    'hero.title': 'A hand drawing becomes a video game',
    'hero.lead':
      'The robot from the sheet is rebuilt piece by piece with 3D primitives: no imported mesh, no texture. It moves around the scene, walks, laughs and picks up the cardboard box.',
    'hero.cta1': 'The story',
    'hero.cta2': 'Controls',
    'hero.cta3': 'Code on GitHub',
    'stat.mesh': 'procedural meshes',
    'stat.texture': 'textures',
    'stat.states': 'animated states',
    'hud.title': 'Controls',
    'hud.laugh': 'Laugh',
    'hud.wave': 'Wave',
    'hud.grab': 'Box',
    'hud.demo': 'Demo',
    'hud.arms': 'V arms',
    'hud.cinema': 'Cinema',
    'hud.rotate': 'Rotate',
    'hud.flat': 'Flat shading',
    'hud.audio': 'Audio',
    'hud.reset': 'Reset',
    'hud.more': 'Settings',
    'hud.view': 'View',
    'hud.hint': 'WASD walks · L laughs · Space waves · G grabs the box',
    'view.front': 'Front',
    'view.hero': '3/4',
    'view.side': 'Side',
    'view.back': 'Back',
    'view.closeup': 'Head close-up',
    'story.eyebrow': 'The shoulder',
    'story.title': 'From the sheet to the video game',
    'story.lead':
      'Four steps, each verified in the browser: the drawing, the geometry, the animated rig and finally the game with controller, box and cinematic direction.',
    'story.fig1':
      'The starting sheet: pencil and pastel, dashed outlines and gouache colours.',
    'story.fig2': 'The rebuild: 66 meshes generated at runtime, black outlines in drawing style.',
    'story.fig3': 'The rig: chest, elbows and knees as pivots, two-bone IK for the arms.',
    'story.fig4':
      'The video game: free movement, a box to carry and a cinematic camera director.',
    'story.h1': 'The drawing',
    'story.p1':
      'TV-shaped head, ball-tipped antennae, arms open in a V with “C” claws, blue torso with a red dial and a four-button panel, lavender thighs and striped shins. Every element of the sheet became a construction spec.',
    'story.t1': 'proportions',
    'story.t2': 'palette',
    'story.t3': 'joints',
    'story.h2': 'The geometry',
    'story.p2':
      'RoundedBoxGeometry for the head and limbs, cylinders for joints and neck, spheres for eyes and knees, a partial TorusGeometry for the “C” claw and an ExtrudeGeometry for the trapezoid torso. Outlines are a second pass of BackSide meshes.',
    'story.h3': 'The animated rig',
    'story.p3':
      'Ten states (idle, walk, laugh, wave, approach, reach, grab, lift, carry, place) driven by a fixed-step 60 Hz state machine. The arms use analytic two-bone IK to grab the box, the chest leans to reach the ground.',
    'story.h4': 'The video game',
    'story.p4':
      'Keyboard, touch and gamepad feed the same controller; the camera follows the robot and, in Cinema mode, changes shot according to the state (close-up for the laugh, low angle for the box). All of it runs without external assets.',
    'cmd.eyebrow': 'Controller',
    'cmd.title': 'Controls',
    'cmd.h1': 'Movement',
    'cmd.h2': 'Animations',
    'cmd.h3': 'Scene',
    'cmd.d1': 'Walk',
    'cmd.d2': 'Run',
    'cmd.d3': 'Left stick and d-pad',
    'cmd.d4': 'Orbit the camera',
    'cmd.d5': 'Laugh (the teeth morph on the screen)',
    'cmd.d6': 'Wave',
    'cmd.d7': 'Pick up or drop the box',
    'cmd.d8': 'Reset the scene',
    'cmd.d9': 'Walks, laughs and collects the box',
    'cmd.d10': 'Shot driven by the robot state',
    'cmd.d11': 'Restores the drawing arms',
    'cmd.d12': 'Synthesised laugh',
    'footer.projects': 'Projects',
    'footer.repo': 'Repository',
  },
};

const STATE_LABEL = {
  idle: { it: 'In attesa', en: 'Idle' },
  walk: { it: 'Cammina', en: 'Walking' },
  laugh: { it: 'Ride', en: 'Laughing' },
  wave: { it: 'Saluta', en: 'Waving' },
  approach: { it: 'Avvicina alla scatola', en: 'Approaching the box' },
  reach: { it: 'Si china per afferrare', en: 'Bending down' },
  grab: { it: 'Afferra la scatola', en: 'Grabbing the box' },
  lift: { it: 'Solleva la scatola', en: 'Lifting the box' },
  carry: { it: 'Trasporta la scatola', en: 'Carrying the box' },
  place: { it: 'Posa la scatola', en: 'Putting the box down' },
};

const THEME = {
  light: {
    bg: 0xf3efe6,
    ground: 0xe9e2d4,
    fog: 0xf3efe6,
    stage: ['#f3efe6', '#e7e0d2'],
  },
  dark: {
    bg: 0x0d0f14,
    ground: 0x171a21,
    fog: 0x0d0f14,
    stage: ['#14161c', '#0d0f14'],
  },
};

let lang = 'it';
let theme = 'light';

function applyI18n() {
  const dict = I18N[lang];
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (dict[key]) el.textContent = dict[key];
  });
  document.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.lang === lang));
  });
  refreshStateLabel();
  window.dispatchEvent(new CustomEvent('robot-lang', { detail: { lang } }));
}

/** Etichetta di stato corrente nella lingua attiva. */
function refreshStateLabel() {
  const el = document.getElementById('state-label');
  const state = window.__robot?.info?.().state;
  const label = STATE_LABEL[state];
  if (el && label) el.textContent = label[lang] || label.it;
}

function applyTheme() {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.querySelector('[data-theme-icon]').textContent = theme === 'dark' ? '☀' : '◐';
  try {
    localStorage.setItem('robot3d-theme', theme);
  } catch {
    /* storage non disponibile: si resta sul tema di default */
  }
  window.dispatchEvent(new CustomEvent('robot-theme', { detail: { theme } }));
}

document.querySelectorAll('[data-lang]').forEach((btn) => {
  btn.addEventListener('click', () => {
    lang = btn.dataset.lang === 'en' ? 'en' : 'it';
    applyI18n();
  });
});

document.getElementById('theme-toggle').addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  applyTheme();
});

try {
  const saved = localStorage.getItem('robot3d-theme');
  if (saved === 'dark' || saved === 'light') theme = saved;
} catch {
  /* storage non disponibile */
}

applyI18n();
applyTheme();

// Aggiorna l'etichetta di stato mostrata nell'HUD
window.addEventListener('robot-state', (e) => {
  const label = STATE_LABEL[e.detail.state];
  const el = document.getElementById('state-label');
  if (label && el) el.textContent = label[lang] || label.it;
});
// Rimuove l'overlay di avvio quando il modulo ha montato la scena
window.addEventListener('load', () => {
  requestAnimationFrame(() => {
    const boot = document.getElementById('boot');
    if (boot) {
      boot.classList.add('hidden');
      setTimeout(() => boot.remove(), 500);
    }
  });
});

// Espone i token tema per robot.js
window.__siteTheme = THEME;

// The canonical site shell owns the language controls.
window.addEventListener('sitelanguagechange', event => {
  if (event.detail?.language === 'it' || event.detail?.language === 'en') {
    lang = event.detail.language;
    applyI18n();
  }
});
