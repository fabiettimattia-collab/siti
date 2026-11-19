/* Dal Barone: il cilindro del Barone in 3D, sulla prima pagina.
 *
 * La pagina è completa anche senza questo file: il cilindro piatto (SVG) è già in testata.
 * Questo modulo, caricato dopo il primo disegno, lo sostituisce con un cilindro vero:
 * lacca lucida, nastro rosso in gros-grain con fiocco, baffi a manubrio. All'apertura entra
 * girando due volte e si posa; a riposo ondeggia e segue il puntatore; toccato fa un giro
 * "croccante"; scorrendo fa un ultimo giro e vola nel posto che lo aspetta nella barra di
 * navigazione, dove lascia il posto al mini-logo piatto. Il colore segue l'inchiostro del
 * giornale: nero nell'edizione del mattino, avorio in quella serale, e al cambio d'edizione
 * il cilindro gira su se stesso mentre si ritinge.
 * Senza WebGL resta il cilindro piatto; con "riduci movimento" il 3D sta fermo, senza volo.
 */

// Un import() dinamico risolve i percorsi rispetto a questo file: si parte dalla pagina.
const THREE_URL = new URL(window.BARONE_THREE || "assets/vendor/three.module.min.js", document.baseURI).href;

const root = document.documentElement;
const stage = document.getElementById("hat-stage");
const mark = document.getElementById("hat-3d");
const slot = document.getElementById("brand-slot");

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(pointer: fine)").matches;

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);

/* ── Geometria della pagina ──────────────────────────────────────────────── */

const geo = { x: 0, y: 0, S: 1, travel: 400, w: -1 };

function measure() {
  const r = stage.getBoundingClientRect();
  geo.x = r.left + window.scrollX;
  geo.y = r.top + window.scrollY;
  geo.S = r.width;
  // Circa due terzi di schermo di scorrimento per tutto il volo: su telefono non è troppo veloce.
  // Si ricalcola solo se cambia la larghezza: la barra degli indirizzi che compare e scompare
  // cambia l'altezza della finestra e farebbe saltare il cilindro a metà volo.
  if (window.innerWidth !== geo.w) {
    geo.w = window.innerWidth;
    geo.travel = clamp(0.64 * window.innerHeight, 300, 600);
  }
}

function slotBox() {
  const s = slot.getBoundingClientRect();
  return { x: s.left + s.width / 2, y: s.top + s.height / 2, size: s.width };
}

function inkColours() {
  const cs = getComputedStyle(root);
  return { ink: cs.getPropertyValue("--ink").trim() || "#1b1814", red: cs.getPropertyValue("--red").trim() || "#a8261d" };
}

/* ── Il cilindro ─────────────────────────────────────────────────────────── */

/* I baffi: lo stesso tracciato del logo piatto, nello spazio 64×64 dell'SVG. */
const MOUSTACHE =
  "M32 50.5c-2.6-2.4-7.4-2.9-11.2-.6-2.4 1.4-4.6 2.1-7 1.4-1.6-.5-2.6-1.8-2.4-3.2-1.6 2.6-.2 6 3.4 7.2 4 1.3 " +
  "8.4-.2 11.6-1.9 2.2-1.2 4.2-1.6 5.6-1.6s3.4.4 5.6 1.6c3.2 1.7 7.6 3.2 11.6 1.9 3.6-1.2 5-4.6 3.4-7.2.2 1.4-.8 " +
  "2.7-2.4 3.2-2.4.7-4.6 0-7-1.4-3.8-2.3-8.6-1.8-11.2.6z";
const UNIT = 1.96 / 58; // la tesa del logo è larga 58 unità, quella in 3D 1,96

/* Converte un tracciato SVG (M, L, C, S, Z, anche relativi) in una THREE.Shape. */
function pathShape(THREE, d, map) {
  const tokens = d.match(/[MmLlCcSsZz]|-?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/g);
  const shape = new THREE.Shape();
  let i = 0;
  let cmd = "M";
  let x = 0;
  let y = 0;
  let cx = 0;
  let cy = 0; // ultimo punto di controllo, per la S
  const num = () => parseFloat(tokens[i++]);
  while (i < tokens.length) {
    if (/[a-z]/i.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    switch (cmd.toUpperCase()) {
      case "M": {
        x = ox + num();
        y = oy + num();
        shape.moveTo(...map(x, y));
        cx = x; cy = y;
        cmd = rel ? "l" : "L";
        break;
      }
      case "L": {
        x = ox + num();
        y = oy + num();
        shape.lineTo(...map(x, y));
        cx = x; cy = y;
        break;
      }
      case "C": {
        const x1 = ox + num(), y1 = oy + num(), x2 = ox + num(), y2 = oy + num();
        x = ox + num();
        y = oy + num();
        shape.bezierCurveTo(...map(x1, y1), ...map(x2, y2), ...map(x, y));
        cx = x2; cy = y2;
        break;
      }
      case "S": {
        const x1 = 2 * x - cx, y1 = 2 * y - cy;
        const x2 = ox + num(), y2 = oy + num();
        x = ox + num();
        y = oy + num();
        shape.bezierCurveTo(...map(x1, y1), ...map(x2, y2), ...map(x, y));
        cx = x2; cy = y2;
        break;
      }
      case "Z":
        shape.closePath();
        break;
      default:
        i++;
    }
  }
  return shape;
}

/* Profilo del cilindro (raggio, altezza): cupola piatta, fianchi appena svasati, tesa arrotolata. */
const PROFILE = [
  [0.001, 1.0], [0.3, 1.0], [0.4, 0.995], [0.435, 0.985], [0.448, 0.965], [0.45, 0.94],
  [0.445, 0.8], [0.43, 0.6], [0.418, 0.42], [0.414, 0.26], [0.418, 0.12], [0.425, 0.06],
  [0.445, 0.035], [0.5, 0.025], [0.65, 0.022], [0.8, 0.03], [0.9, 0.045], [0.95, 0.06],
  [0.975, 0.05], [0.982, 0.03], [0.97, 0.01], [0.94, 0.002], [0.8, -0.005], [0.6, -0.012],
  [0.44, -0.015], [0.001, -0.015],
];
const crownR = (y) => {
  for (let k = 6; k < 12; k++) {
    const [r0, y0] = PROFILE[k];
    const [r1, y1] = PROFILE[k + 1];
    if (y <= y0 && y >= y1) return lerp(r0, r1, (y0 - y) / (y0 - y1));
  }
  return 0.42;
};

/* Uno studio di posa: pannelli luminosi che la lacca e il raso riflettono. */
function studio(THREE) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0907);
  const panel = (w, h, hex, power, x, y, z) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(power), side: THREE.DoubleSide }),
    );
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
  };
  panel(9, 1.4, 0xfff6e8, 4.2, 0, 6.5, 1.5); // stecca dall'alto
  panel(1.2, 7, 0xfff2e0, 3.2, -6.5, 1, 2.5); // striscia a sinistra
  panel(1.2, 7, 0xffe2c4, 2.4, 6.5, 0.5, 1.5); // striscia calda a destra
  panel(8, 6, 0x3a3530, 0.9, 0, 0, -7); // fondale grigio caldo
  panel(8, 1, 0xfff6e8, 1.2, 0, -6, 2);
  // Pannelli dietro l'osservatore: è ciò che il davanti lucido riflette davvero.
  panel(5, 4, 0xfffaf0, 2.4, -3.4, 2.8, 7.5);
  panel(2.6, 5, 0xfff0dc, 1.4, 3.8, -0.6, 7.5);
  panel(1.4, 1.4, 0xffffff, 6, 0.8, 4.4, 6);
  panel(3.6, 10, 0xfff4e6, 1.8, 6.4, -1.5, 6);
  panel(3.6, 10, 0xfff4e6, 1.5, -6.4, -1.5, 6);
  return scene;
}

function buildHat(THREE, renderer) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 40);
  camera.position.set(0, 0.9, 6.8);
  camera.lookAt(0, 0.02, 0);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = studio(THREE);
  scene.environment = pmrem.fromScene(envScene, 0.04).texture;
  pmrem.dispose();
  envScene.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose();
      o.material.dispose();
    }
  });

  const key = new THREE.DirectionalLight(0xfff4e6, 1.5);
  key.position.set(-3, 5, 5);
  const rim = new THREE.DirectionalLight(0xffe0c0, 2.0);
  rim.position.set(3.5, 2, -4);
  scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.15));

  const { ink, red } = inkColours();
  const lacquer = new THREE.MeshPhysicalMaterial({
    color: ink, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.85,
    sheen: 0.35, sheenRoughness: 0.5, sheenColor: 0x45413c,
  });
  const ribbon = new THREE.MeshPhysicalMaterial({
    color: red, roughness: 0.55, sheen: 1, sheenRoughness: 0.35, sheenColor: 0xff9a88,
    clearcoat: 0.25, clearcoatRoughness: 0.3,
  });
  const whisker = new THREE.MeshPhysicalMaterial({ color: ink, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.05 });

  const pivot = new THREE.Group();
  const hat = new THREE.Group();
  pivot.add(hat);
  scene.add(pivot);
  hat.position.y = -0.23; // centro visivo tra la cupola e i baffi

  // Il cilindro: un tornito, con la tesa che si arriccia sui fianchi e scende davanti e dietro.
  const SEG = 128;
  // Il tornito vuole il profilo dal basso verso l'alto, così le facce guardano fuori.
  const body = new THREE.LatheGeometry(PROFILE.slice().reverse().map(([r, y]) => new THREE.Vector2(r, y)), SEG);
  const pos = body.attributes.position;
  for (let v = 0; v < pos.count; v++) {
    const x = pos.getX(v);
    const z = pos.getZ(v);
    const r = Math.hypot(x, z);
    if (r < 0.47) continue;
    const s = clamp((r - 0.47) / 0.51);
    const side = (x * x) / (r * r);
    pos.setY(v, pos.getY(v) + 0.17 * s * s * side - 0.035 * s * s * (1 - side));
  }
  body.computeVertexNormals();
  // La cucitura del tornito: media le normali della prima e dell'ultima colonna.
  const nrm = body.attributes.normal;
  const rows = PROFILE.length;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  for (let j = 0; j < rows; j++) {
    const first = j;
    const last = SEG * rows + j;
    a.fromBufferAttribute(nrm, first);
    b.fromBufferAttribute(nrm, last);
    a.add(b).normalize();
    nrm.setXYZ(first, a.x, a.y, a.z);
    nrm.setXYZ(last, a.x, a.y, a.z);
  }
  hat.add(new THREE.Mesh(body, lacquer));

  // Il nastro di gros-grain rosso, appena più largo della cupola.
  const BAND_TOP = 0.27;
  const BAND_LOW = 0.055;
  const bandPts = [[crownR(BAND_TOP) + 0.002, BAND_TOP + 0.004]];
  for (let k = 0; k <= 8; k++) {
    const y = lerp(BAND_TOP, BAND_LOW + 0.01, k / 8);
    bandPts.push([crownR(y) + 0.017, y]);
  }
  bandPts.push([crownR(BAND_LOW) + 0.002, BAND_LOW]);
  bandPts.reverse();
  hat.add(new THREE.Mesh(new THREE.LatheGeometry(bandPts.map(([r, y]) => new THREE.Vector2(r, y)), SEG), ribbon));

  // Il fiocco sul fianco sinistro.
  const bow = new THREE.Group();
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 14), ribbon);
  knot.scale.set(0.7, 1.2, 0.55);
  bow.add(knot);
  for (const dir of [-1, 1]) {
    const loop = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 16), ribbon);
    loop.scale.set(1.25, 0.72, 0.32);
    loop.position.set(0, 0, dir * 0.075);
    loop.rotation.x = dir * 0.25;
    bow.add(loop);
  }
  const bowY = 0.165;
  bow.position.set(-(crownR(bowY) + 0.03), bowY, 0);
  hat.add(bow);

  // I baffi a manubrio, sospesi davanti al cilindro come nel logo: il Barone è invisibile.
  const shape = pathShape(THREE, MOUSTACHE, (x, y) => [(x - 32) * UNIT, -(y - 51.5) * UNIT]);
  const tash = new THREE.ExtrudeGeometry(shape, {
    depth: 0.06, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.02, bevelSegments: 8, curveSegments: 28,
  });
  tash.translate(0, 0, -0.03);
  const moustache = new THREE.Mesh(tash, whisker);
  moustache.position.set(0, -(51.5 - 40.4) * UNIT, 0.62);
  moustache.rotation.x = -0.08;
  hat.add(moustache);

  return { scene, camera, pivot, mats: { lacquer, ribbon, whisker } };
}

async function startHat(onFrameNeeded) {
  let THREE;
  let renderer;
  const canvas = document.createElement("canvas");
  try {
    THREE = await import(THREE_URL);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    return null; // niente moduli da questo indirizzo o niente WebGL: resta il cilindro piatto
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping ?? THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const { scene, camera, pivot, mats } = buildHat(THREE, renderer);
  let lost = false;
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    lost = true;
  });

  const resize = () => {
    const c = Math.max(64, Math.round(geo.S * 1.6));
    renderer.setSize(c, c, false);
  };
  resize();
  mark.append(canvas);

  // Colori dell'inchiostro: da dove partono e dove arrivano durante il cambio d'edizione.
  const from = { ink: new THREE.Color(), red: new THREE.Color() };
  const to = { ink: new THREE.Color(), red: new THREE.Color() };
  const readInk = (target) => {
    const { ink, red } = inkColours();
    target.ink.set(ink);
    target.red.set(red);
  };
  readInk(to);
  from.ink.copy(to.ink);
  from.red.copy(to.red);

  return {
    resize,
    get lost() {
      return lost;
    },
    pose(rx, ry, sx, sy, s) {
      pivot.rotation.set(rx, ry, 0);
      pivot.scale.set(sx * s, sy * s, s);
    },
    /* Prende i nuovi colori dal CSS e prepara la tinta da sfumare. */
    retint() {
      from.ink.copy(mats.lacquer.color);
      from.red.copy(mats.ribbon.color);
      readInk(to);
      return !from.ink.equals(to.ink) || !from.red.equals(to.red);
    },
    tint(t) {
      mats.lacquer.color.lerpColors(from.ink, to.ink, t);
      mats.whisker.color.copy(mats.lacquer.color);
      mats.ribbon.color.lerpColors(from.red, to.red, t);
      // l'avorio vuole un velluto più chiaro del nero
      const light = mats.lacquer.color.r + mats.lacquer.color.g + mats.lacquer.color.b > 1.5;
      mats.lacquer.sheenColor.set(light ? 0xfff6e6 : 0x45413c);
    },
    render() {
      if (!lost) renderer.render(scene, camera);
    },
    first() {
      renderer.compile(scene, camera);
      onFrameNeeded();
    },
  };
}

/* ── Coreografia ─────────────────────────────────────────────────────────── */

const flying = !reduceMotion;
let gl = null;
let introStart = -1;
let crunchStart = -1;
let tintStart = -1;
let queued = false;
let dirty = true;
let tilt = { x: 0, y: 0 };
let aim = { x: 0, y: 0 };
const REST = { x: 0.05, y: -0.42 };

function request() {
  if (queued) return;
  queued = true;
  window.requestAnimationFrame(frame);
}

function frame(now) {
  queued = false;
  if (!gl) return;
  if (gl.lost) return restoreFlat();

  const t = now / 1000;
  const p = flying ? clamp(window.scrollY / geo.travel) : 0;
  const e = easeInOut(p);

  // Entrata: due giri e una piccola esitazione prima di posarsi.
  const k = introStart < 0 ? 1 : clamp((now - introStart) / 2600);
  const introSpin = -Math.PI * 4 * (1 - easeOut(k));
  const introScale = lerp(1.3, 1, easeOutBack(k));
  if (k >= 1) introStart = -1;

  // Un tocco: un giro veloce con uno schiacciamento, come un tasto ben fatto.
  let crunchSpin = 0;
  let squash = 0;
  if (crunchStart >= 0) {
    const c = clamp((now - crunchStart) / 900);
    crunchSpin = Math.PI * 2 * easeOut(c);
    squash = Math.sin(c * Math.PI * 3) * (1 - c) * 0.14;
    if (c >= 1) crunchStart = -1;
  }

  // Cambio d'edizione: la tinta sfuma mentre il cilindro gira.
  if (tintStart >= 0) {
    const c = clamp((now - tintStart) / 900);
    gl.tint(easeInOut(c));
    if (c >= 1) tintStart = -1;
  }

  const live = flying ? 1 - e : 1;
  tilt.x += (aim.x - tilt.x) * 0.07;
  tilt.y += (aim.y - tilt.y) * 0.07;
  // In barra il cilindro è il mini-logo piatto: disegnare una tela nascosta consumerebbe solo batteria.
  const drawn = flying ? e < 1 || crunchStart >= 0 || tintStart >= 0 : dirty || crunchStart >= 0 || tintStart >= 0;
  if (drawn) {
    const sway = flying ? Math.sin(t * 0.55) * 0.26 : 0;
    const ry = lerp(REST.y, 0, e) + (sway + tilt.y) * live + introSpin + crunchSpin + e * Math.PI * 2;
    const rx = lerp(REST.x, 0, e) + ((flying ? Math.sin(t * 0.8 + 1.2) * 0.04 : 0) + tilt.x) * live;
    gl.pose(rx, ry, 1 + squash, 1 - squash, introScale);
    gl.render();
  }

  if (flying) {
    // Percorso fisso sullo schermo: dal punto in cui era all'apertura al posto nella barra.
    // Posizione e misura arrivano un po' prima della fine dello scorrimento, così il passaggio
    // al mini-logo piatto avviene con il cilindro già fermo sul suo posto.
    const to = slotBox();
    const ep = easeInOut(clamp(p / 0.85));
    // il cilindro 3D occupa la sua scatola un po' più in basso e più largo del mini-logo: si compensa
    const cx = lerp(geo.x - window.scrollX + geo.S / 2, to.x, ep);
    const cy = lerp(geo.y + geo.S / 2, to.y - 0.075 * to.size, ep) + Math.sin(t * 1.1) * 4 * (1 - ep);
    const scale = lerp(1, (0.9 * to.size) / geo.S, ep);
    mark.style.transform = `translate3d(${(cx - geo.S / 2).toFixed(2)}px, ${(cy - geo.S / 2).toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
    const dock = clamp((p - 0.88) / 0.12);
    mark.style.opacity = String(1 - dock);
    root.style.setProperty("--dock", dock.toFixed(3));
    slot.style.setProperty("--pad", String(1 - dock));
    stage.style.setProperty("--hud", String(1 - clamp(p * 2.4)));
  }

  dirty = false;
  const settling = Math.abs(aim.x - tilt.x) + Math.abs(aim.y - tilt.y) > 0.001;
  if (introStart >= 0 || crunchStart >= 0 || tintStart >= 0 || (flying && (e < 1 || settling))) request();
}

function docked() {
  return flying && easeInOut(clamp(window.scrollY / geo.travel)) >= 1;
}

function crunch() {
  if (reduceMotion) return;
  if (gl && !gl.lost && !docked()) {
    if (crunchStart < 0) crunchStart = performance.now(); // un giro già in corso non riparte da capo
    request();
    return;
  }
  const flat = docked() ? slot.querySelector(".nav__mini") : mark.querySelector(".hat-flat");
  if (!flat) return;
  flat.classList.remove("crunch");
  void flat.getBoundingClientRect();
  flat.classList.add("crunch");
}

/* Nuova edizione: il cilindro si ritinge (e, se c'è movimento, fa un giro mentre lo fa). */
function onEdition() {
  if (!gl) return;
  if (!gl.retint()) return; // stesso inchiostro di prima: niente giro a vuoto
  if (reduceMotion || docked()) {
    gl.tint(1);
    dirty = true;
  } else {
    tintStart = performance.now();
    if (crunchStart < 0) crunchStart = performance.now();
  }
  request();
}

/* La GPU si è ripresa il contesto: si torna al cilindro piatto, dov'era nella pagina. */
function restoreFlat() {
  gl = null;
  root.classList.remove("gl", "fly");
  root.style.removeProperty("--dock");
  mark.removeAttribute("style");
  mark.querySelector("canvas")?.remove();
  stage.append(mark);
  stage.style.removeProperty("--hud");
  slot.style.removeProperty("--pad");
}

function relayout() {
  measure();
  dirty = true;
  if (gl) {
    if (flying) {
      mark.style.width = `${geo.S}px`;
      mark.style.height = `${geo.S}px`;
    }
    gl.resize();
  }
  request();
}

if (stage && mark && slot) {
  measure();
  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", relayout);
  window.addEventListener("load", relayout);
  if (document.fonts) document.fonts.ready.then(relayout);
  stage.addEventListener("click", crunch);
  slot.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    // dalla barra, sulla prima pagina: niente ricarica, si torna in cima
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  });
  document.addEventListener("animationend", (event) => event.target.classList?.remove("crunch"));
  if ("MutationObserver" in window) {
    new MutationObserver(() => window.requestAnimationFrame(onEdition)).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  }
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  darkQuery.addEventListener?.("change", () => window.requestAnimationFrame(onEdition));
  if (flying && finePointer) {
    window.addEventListener(
      "pointermove",
      (event) => {
        aim = { x: (event.clientY / window.innerHeight - 0.5) * 0.25, y: (event.clientX / window.innerWidth - 0.5) * 0.6 };
        request();
      },
      { passive: true },
    );
  }

  startHat(request).then((ready) => {
    if (!ready) return;
    gl = ready;
    if (flying) {
      document.body.append(mark);
      mark.style.width = `${geo.S}px`;
      mark.style.height = `${geo.S}px`;
      root.classList.add("fly");
      measure();
      if (window.scrollY / geo.travel < 0.05) introStart = performance.now();
    }
    root.classList.add("gl");
    gl.first();
  });
}
