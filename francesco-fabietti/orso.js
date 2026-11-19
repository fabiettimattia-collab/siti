'use strict';

// L'orso dell'apertura: il ritratto inciso (orso.webp) steso su una griglia che si piega come un
// bassorilievo. Guarda chi visita: occhi, testa e busto seguono il cursore, ognuno con il suo tempo;
// si sporge quando ci si avvicina, drizza le orecchie, annusa, respira e sbatte gli occhi.
// Nessuna libreria: WebGL scritto a mano. Senza WebGL o JavaScript resta il ritratto fermo.
(() => {
  const scena = document.querySelector('.bear-scene');
  const canvas = scena && scena.querySelector('.bear-canvas');
  if (!canvas) return;

  // Il ritratto occupa il 90% del canvas, appoggiato in basso: il margine serve alla testa che si muove.
  const SCALA = .9;
  // Ampiezza dei movimenti. Tenuta bassa di proposito: è un disegno solo che si piega, e oltre questi
  // valori il collo esce dal busto e l'immagine si torce (Mattia, 16/11/2026).
  const MOTO = {
    giro: .1,          // quanto gira la testa a destra e a sinistra (radianti)
    china: .055,       // quanto alza e abbassa la testa (radianti)
    scivola: .01,      // quanto la testa scivola di lato rispetto al busto
    prospettiva: .2,   // quanto si ingrandisce ciò che viene avanti
    sporge: .025,      // quanto si sporge verso chi si avvicina al muso
    inclina: .18,      // quanto inclina la testa mentre gira
    busto: .5,         // quanta parte del giro della testa segue il busto
    smorza: .97        // 1 = arriva senza oscillare oltre il punto
  };
  const f = n => n.toFixed(4);
  const VERTICI = `
attribute vec2 aUv;
uniform vec3 uTesta;   // gira, china, inclina
uniform vec3 uCorpo;   // gira, inclina, respiro
uniform vec3 uVita;    // si sporge, annusa, drizza le orecchie
uniform vec2 uSposta, uOrecchie, uForma;
varying vec2 vUv;
const float PROF = .36;
const vec3 PERNO = vec3(0., -.24, .09), PERNO_CORPO = vec3(0., -.5, .09);
mat3 rotY(float a){ float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }
mat3 rotX(float a){ float c = cos(a), s = sin(a); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }
mat3 rotZ(float a){ float c = cos(a), s = sin(a); return mat3(c, s, 0., -s, c, 0., 0., 0., 1.); }
void main(){
  vUv = aUv;
  vec3 p = vec3(aUv.x - .5, .5 - aUv.y, 0.);
  // Quanto un punto appartiene alla testa: tutto il capo, poi il collo cede piano fino a metà petto.
  vec2 c = aUv - vec2(.5, .42);
  float testa = 1. - smoothstep(.75, 1.2, length(vec2(c.x / .75, max(c.y, 0.) / .33)));
  // Rilievo: una cupola per il capo, il muso che sporge, le orecchie più indietro, un busto tondo.
  float lato = aUv.x < .5 ? -1. : 1.;
  float orecchio = 1. - smoothstep(.05, .14, distance(p.xy, vec2(lato * .265, .33)));
  vec2 d = c / vec2(.44, .42);
  vec2 m = (aUv - vec2(.5, .535)) / vec2(.125, .15);
  float muso = exp(-dot(m, m));
  float capo = sqrt(max(0., 1. - dot(d, d))) * .72 + muso * (.52 + uVita.y * .07) - orecchio * .12;
  float bx = p.x / .62;
  p.z = mix(sqrt(max(0., 1. - bx * bx)) * .5, capo, testa) * PROF;
  float z0 = p.z;
  // Orecchie: restano un attimo indietro quando la testa gira, e si drizzano quando qualcosa le incuriosisce.
  vec2 radice = vec2(lato * .2, .23);
  float a = ((lato < 0. ? uOrecchie.x : uOrecchie.y) + lato * uVita.z * .1) * orecchio;
  vec2 r = p.xy - radice;
  p.xy = radice + vec2(cos(a) * r.x - sin(a) * r.y, sin(a) * r.x + cos(a) * r.y) * (1. + uVita.z * .035 * orecchio);
  // Annusa: il naso sale appena.
  p.y += muso * uVita.y * .006;
  // Respiro: il petto si allarga e sale un poco, la testa lo segue.
  p.x *= 1. + uCorpo.z * .008 * (1. - testa);
  p.y += uCorpo.z * (.004 * (1. - testa) * clamp((p.y + .5) * 2.5, 0., 1.) + .0035 * testa);
  // Il busto gira poco, imperniato sul bordo in basso; la testa gira intorno alla base del collo.
  float v = clamp((p.y - PERNO_CORPO.y) / (PERNO.y - PERNO_CORPO.y), 0., 1.);
  vec3 b = rotZ(uCorpo.y) * rotY(uCorpo.x) * (p - PERNO_CORPO) + PERNO_CORPO;
  p = mix(p, b, v * v * (3. - 2. * v));
  vec3 q = rotZ(uTesta.z) * rotX(uTesta.y) * rotY(uTesta.x) * (p - PERNO) + PERNO;
  q.xy += uSposta;
  q.z += uVita.x * ${f(MOTO.sporge)};
  p = mix(p, q, testa);
  // Prospettiva: ciò che viene avanti si ingrandisce, ciò che va indietro rimpicciolisce.
  p.xy += (p.xy - vec2(0., -.06)) * (p.z - z0) * ${f(MOTO.prospettiva)};
  gl_Position = vec4(p.x * 2. * ${SCALA} * uForma.x, -1. + (p.y + .5) * 2. * ${SCALA} * uForma.y, 0., 1.);
}`;
  const FRAMMENTI = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uRitratto, uOcchi;
uniform vec4 uFascia;
uniform vec2 uSguardo;
uniform float uBlink;
varying vec2 vUv;
const vec2 OCCHIO_SX = vec2(.391, .374), OCCHIO_DX = vec2(.609, .374);
float ellisse(vec2 p, vec2 c){ return 1. - smoothstep(.6, 1., length((p - c) / vec2(.075, .05))); }
float iride(vec2 p, vec2 c){ return 1. - smoothstep(.007, .021, length((p - c) * vec2(1., 1.2))); }
void main(){
  // Sguardo: dentro l'occhio il disegno scorre di poco verso dove guarda.
  vec2 uv = vUv - uSguardo * max(iride(vUv, OCCHIO_SX), iride(vUv, OCCHIO_DX)) * (1. - uBlink);
  vec4 col = texture2D(uRitratto, uv);
  // Battito di ciglia: sugli occhi sfuma la fascia con le palpebre chiuse.
  float b = max(ellisse(vUv, OCCHIO_SX), ellisse(vUv, OCCHIO_DX)) * uBlink;
  if (b > 0.) col.rgb = mix(col.rgb, texture2D(uOcchi, (vUv - uFascia.xy) / uFascia.zw).rgb * col.a, b);
  gl_FragColor = col;
}`;

  const ridotto = matchMedia('(prefers-reduced-motion: reduce)');
  const opzioni = { alpha: true, premultipliedAlpha: true, antialias: true, depth: false, stencil: false };
  // WebGL 2 quando c'è: permette un ritratto di qualsiasi misura senza sgranare quando viene rimpicciolito.
  const gl = canvas.getContext('webgl2', opzioni) || canvas.getContext('webgl', opzioni) || canvas.getContext('experimental-webgl', opzioni);
  if (!gl) return;
  const nuovo = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;

  const immagine = indirizzo => new Promise((bene, male) => {
    const im = new Image();
    im.onload = () => bene(im);
    im.onerror = male;
    im.src = indirizzo;
  });
  // Nella copia in un solo file il ritratto sta nello stile dell'immagine ferma: si prende da lì.
  const daSfondo = () => {
    const trovato = /url\(["']?(.+?)["']?\)/.exec(getComputedStyle(scena.querySelector('.bear-poster')).backgroundImage);
    return trovato && trovato[1];
  };
  const GRIGLIA = 72;
  let U = null, pronto = false, larghezza = 0, altezza = 0;

  async function prepara() {
    const [ritratto, occhi] = await Promise.all([immagine(canvas.dataset.ritratto || daSfondo()), immagine(canvas.dataset.occhi)]);
    if (gl.isContextLost()) return;
    const crea = (tipo, sorgente) => { const s = gl.createShader(tipo); gl.shaderSource(s, sorgente); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, crea(gl.VERTEX_SHADER, VERTICI));
    gl.attachShader(prog, crea(gl.FRAGMENT_SHADER, FRAMMENTI));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return; // resta il ritratto fermo
    gl.useProgram(prog);

    const punti = new Float32Array((GRIGLIA + 1) * (GRIGLIA + 1) * 2);
    const indici = new Uint16Array(GRIGLIA * GRIGLIA * 6);
    for (let y = 0, i = 0; y <= GRIGLIA; y++) for (let x = 0; x <= GRIGLIA; x++) { punti[i++] = x / GRIGLIA; punti[i++] = y / GRIGLIA; }
    for (let y = 0, i = 0; y < GRIGLIA; y++) for (let x = 0; x < GRIGLIA; x++) {
      const a = y * (GRIGLIA + 1) + x, b = a + GRIGLIA + 1;
      indici[i++] = a; indici[i++] = b; indici[i++] = a + 1; indici[i++] = a + 1; indici[i++] = b; indici[i++] = b + 1;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, punti, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indici, gl.STATIC_DRAW);
    const posto = gl.getAttribLocation(prog, 'aUv');
    gl.enableVertexAttribArray(posto);
    gl.vertexAttribPointer(posto, 2, gl.FLOAT, false, 0, 0);

    const trama = (unita, im, trasparente) => {
      gl.activeTexture(gl.TEXTURE0 + unita);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, trasparente);
      // Qui può fallire se la pagina è aperta da file e l'immagine è esterna: resta il ritratto fermo.
      gl.texImage2D(gl.TEXTURE_2D, 0, trasparente ? gl.RGBA : gl.RGB, trasparente ? gl.RGBA : gl.RGB, gl.UNSIGNED_BYTE, im);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      const potenza = n => (n & (n - 1)) === 0;
      if (nuovo || (potenza(im.width) && potenza(im.height))) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    };
    trama(0, ritratto, true);
    trama(1, occhi, false);
    U = {};
    for (const nome of ['uTesta', 'uCorpo', 'uVita', 'uSposta', 'uOrecchie', 'uForma', 'uRitratto', 'uOcchi', 'uFascia', 'uSguardo', 'uBlink']) U[nome] = gl.getUniformLocation(prog, nome);
    gl.uniform1i(U.uRitratto, 0);
    gl.uniform1i(U.uOcchi, 1);
    // Dove sta la fascia degli occhi nel ritratto: x, y, larghezza, altezza (come in prepara-orso.py).
    gl.uniform4f(U.uFascia, .25, .3125, .5, .125);
    gl.clearColor(0, 0, 0, 0);
    pronto = true;
    misura();
    disegna();
    scena.classList.add('bear-live');
    riparti();
  }

  // Stato del movimento. Angoli in radianti: yaw verso la destra di chi guarda, pitch verso il basso.
  const S = {
    ora: 0, yaw: 0, pitch: 0, roll: 0, vYaw: 0, vPitch: 0, vRoll: 0, corpoYaw: 0, corpoRoll: 0,
    sguardo: [0, 0], vicino: 0, drizza: 0, fiuto: 0, fiutoDa: -9, prossimoFiuto: 4.5,
    orecchie: [{ a: 0, v: 0 }, { a: 0, v: 0 }], guizzo: 6,
    blink: 0, blinkDa: -9, prossimoBlink: 2,
    puntatore: null, ultimoMovimento: -99, velocita: 0, tocco: false, scorrimento: -99,
    pagina: 0, colpo: 0, vaga: null, curioso: 0, altrove: null, prossimaOcchiata: 0
  };

  function misura() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const scala = Math.min(2, Math.max(1, devicePixelRatio || 1));
    const w = Math.max(2, Math.round(r.width * scala)), h = Math.max(2, Math.round(r.height * scala));
    if (w !== larghezza || h !== altezza) {
      larghezza = canvas.width = w; altezza = canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  function disegna() {
    if (!pronto) return;
    gl.uniform3f(U.uTesta, S.yaw, S.pitch, S.roll);
    gl.uniform3f(U.uCorpo, S.corpoYaw, S.corpoRoll, Math.sin(S.ora * Math.PI * 2 / 4.4));
    gl.uniform3f(U.uVita, S.vicino, S.fiuto, S.drizza);
    gl.uniform2f(U.uSposta, S.yaw * MOTO.scivola, -S.pitch * MOTO.scivola);
    gl.uniform2f(U.uOrecchie, S.orecchie[0].a, S.orecchie[1].a);
    gl.uniform2f(U.uSguardo, S.sguardo[0] * .0055, S.sguardo[1] * .004);
    gl.uniform1f(U.uBlink, S.blink);
    // Il ritratto resta quadrato anche se il canvas non lo è.
    gl.uniform2f(U.uForma, Math.min(1, altezza / larghezza), Math.min(1, larghezza / altezza));
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, GRIGLIA * GRIGLIA * 6, gl.UNSIGNED_SHORT, 0);
  }

  const limita = (v, a, b) => Math.max(a, Math.min(b, v));
  const molla = (da, a, k, dt) => da + (a - da) * (1 - Math.exp(-k * dt));
  const sbatti = () => { if (S.blinkDa < 0 || S.ora - S.blinkDa > 1.1) S.blinkDa = S.ora; };

  function aggiorna(dt) {
    S.ora += dt;
    const r = canvas.getBoundingClientRect();
    const lato = Math.min(r.width, r.height) * SCALA;
    // Il punto tra gli occhi, sullo schermo.
    const cx = r.left + r.width * .5, cy = r.bottom - lato * .628;
    // Quando l'apertura scorre via, l'orso guarda in giù verso la pagina e il cursore conta meno.
    S.pagina = molla(S.pagina, limita((innerHeight * .3 - cy) / (innerHeight * .5), 0, 1), 3.5, dt);
    S.colpo = molla(S.colpo, 0, 3, dt);
    S.velocita = molla(S.velocita, 0, 4, dt);
    const peso = 1 - S.pagina * .7;
    const fermoDa = S.ora - S.ultimoMovimento;

    let bersaglio = null, forza = 1, yawT, pitchT, gx, gy, vicinoT = 0;
    if (S.puntatore) bersaglio = S.puntatore;
    else if (S.ora - S.scorrimento < 2.2) bersaglio = { x: innerWidth * .5, y: innerHeight * .55 };
    if (bersaglio) {
      const dx = bersaglio.x - cx, dy = bersaglio.y - cy;
      const portata = Math.max(420, Math.min(innerWidth, 1500) * .42);
      yawT = MOTO.giro * Math.tanh(dx / portata) * peso;
      pitchT = MOTO.china * Math.tanh(dy / (portata * .8)) * peso;
      gx = limita(dx / (lato * .8), -1, 1);
      gy = limita(dy / (lato * .8), -1, 1);
      if (S.puntatore) vicinoT = 1 - limita((Math.hypot(dx, dy) - lato * .22) / (lato * .5), 0, 1);
      // Se il cursore resta fermo a lungo, ogni tanto l'orso guarda altrove per un momento.
      if (S.puntatore && !S.tocco && fermoDa > 5 && S.ora > S.prossimaOcchiata) {
        S.altrove = { x: (Math.random() < .5 ? -1 : 1) * (.6 + Math.random() * .4), y: (Math.random() - .5) * .8, fino: S.ora + 1.1 + Math.random() * .8 };
        S.prossimaOcchiata = S.ora + 5 + Math.random() * 6;
      }
      if (fermoDa < .3) S.altrove = null;
      if (S.altrove && S.ora < S.altrove.fino) {
        yawT += S.altrove.x * MOTO.giro * .35; pitchT += S.altrove.y * MOTO.china * .3;
        gx = limita(gx + S.altrove.x * 1.3, -1, 1); gy = limita(gy + S.altrove.y, -1, 1);
      }
      S.vaga = null;
    } else {
      // Senza nessuno da guardare: torna a riposo e ogni tanto si guarda intorno.
      forza = .42;
      if (!S.vaga || S.ora > S.vaga.fino) {
        const fermo = Math.random() < .4;
        S.vaga = { yaw: fermo ? 0 : (Math.random() - .5) * MOTO.giro, pitch: fermo ? 0 : (Math.random() - .4) * MOTO.china * .5, fino: S.ora + 2.6 + Math.random() * 3.4 };
      }
      yawT = S.vaga.yaw; pitchT = S.vaga.pitch;
      // Gli occhi arrivano prima della testa.
      gx = limita((yawT - S.yaw) * 9, -1, 1); gy = limita((pitchT - S.pitch) * 12, -1, 1);
    }
    pitchT += S.pagina * MOTO.china + S.colpo * MOTO.china * .35;
    // Mai del tutto fermo: un'oscillazione minima, come chi sta in piedi.
    yawT += Math.sin(S.ora * .71) * .005 + Math.sin(S.ora * .29 + 1.3) * .004;
    pitchT += Math.sin(S.ora * .53 + .7) * .0035;

    // Inclinazione curiosa quando il cursore resta fermo a lungo.
    if (S.puntatore && !S.tocco && fermoDa > 2.8 && !S.curioso) S.curioso = Math.random() < .5 ? -1 : 1;
    if (!S.puntatore || fermoDa < .3) S.curioso = 0;
    const rollT = -yawT * MOTO.inclina + S.curioso * .03;

    // Gli occhi partono per primi; un cambio di sguardo brusco porta con sé un battito di ciglia.
    const sx = molla(S.sguardo[0], gx, 13, dt), sy = molla(S.sguardo[1], gy, 13, dt);
    if (Math.hypot(sx - S.sguardo[0], sy - S.sguardo[1]) > 6.5 * dt) sbatti();
    S.sguardo = [sx, sy];
    // La testa segue con il suo peso, il busto arriva dopo con un terzo del movimento.
    const w = 6.2 * forza + 1.4, z = MOTO.smorza;
    const yawPrima = S.yaw;
    S.vYaw += (w * w * (yawT - S.yaw) - 2 * z * w * S.vYaw) * dt; S.yaw += S.vYaw * dt;
    S.vPitch += (w * w * (pitchT - S.pitch) - 2 * z * w * S.vPitch) * dt; S.pitch += S.vPitch * dt;
    S.vRoll += (20 * (rollT - S.roll) - 7.4 * S.vRoll) * dt; S.roll += S.vRoll * dt;
    S.corpoYaw = molla(S.corpoYaw, S.yaw * MOTO.busto, 2.4, dt);
    S.corpoRoll = molla(S.corpoRoll, S.roll * MOTO.busto, 2.4, dt);
    // Si sporge verso chi si avvicina al muso.
    S.vicino = molla(S.vicino, vicinoT, 3, dt);

    // Orecchie: si drizzano per un movimento rapido o per chi si avvicina, restano indietro quando la
    // testa gira, e ogni tanto guizzano da sole.
    const attento = Math.max(vicinoT, limita(S.velocita / 2200, 0, 1), S.curioso ? .6 : 0);
    S.drizza = molla(S.drizza, attento, attento > S.drizza ? 9 : 2.2, dt);
    const giro = (S.yaw - yawPrima) / Math.max(dt, 1e-3);
    if (S.ora > S.guizzo) { S.orecchie[Math.random() < .5 ? 0 : 1].v += 1.6; S.guizzo = S.ora + 4 + Math.random() * 7; }
    S.orecchie.forEach(o => {
      o.v += (-90 * o.a - 9 * o.v - giro * 22) * dt;
      o.a = limita(o.a + o.v * dt, -.1, .1);
    });

    // Annusa: due piccoli colpi di naso, ogni tanto.
    if (S.ora > S.prossimoFiuto) { S.fiutoDa = S.ora; S.prossimoFiuto = S.ora + 6 + Math.random() * 8; }
    const f = (S.ora - S.fiutoDa) / .6;
    S.fiuto = f < 1 ? Math.pow(Math.sin(f * Math.PI * 2), 2) * (1 - f * .4) : 0;

    if (S.ora > S.prossimoBlink) { sbatti(); S.prossimoBlink = S.ora + 2.8 + Math.random() * 4.4; }
    const k = (S.ora - S.blinkDa) / .24;
    S.blink = k < 0 || k >= 1 ? 0 : k < .35 ? k / .35 : k < .5 ? 1 : 1 - (k - .5) / .5;
  }

  let raf = 0, ultimo = 0, visibile = true;
  function ciclo(ora) {
    raf = 0;
    if (!visibile || document.hidden || ridotto.matches || !pronto) return;
    let resto = Math.min((ora - (ultimo || ora)) / 1000, .25);
    ultimo = ora;
    do { const passo = Math.min(resto, 1 / 60); aggiorna(passo); resto -= passo; } while (resto > 1e-4);
    disegna();
    raf = requestAnimationFrame(ciclo);
  }
  function riparti() {
    if (!raf && visibile && !document.hidden && !ridotto.matches && pronto) { ultimo = 0; raf = requestAnimationFrame(ciclo); }
  }
  function fermo() {
    // Movimento ridotto: un solo disegno, in posa di riposo.
    Object.assign(S, { ora: 0, yaw: 0, pitch: 0, roll: 0, vYaw: 0, vPitch: 0, vRoll: 0, corpoYaw: 0, corpoRoll: 0, sguardo: [0, 0], vicino: 0, drizza: 0, fiuto: 0, blink: 0, blinkDa: -9 });
    S.orecchie.forEach(o => { o.a = 0; o.v = 0; });
    disegna();
  }

  // Mouse e penna: l'orso segue il cursore su tutta la pagina. Dito: segue il tocco, poi torna da solo.
  let rilascio = 0, ultimoPunto = null;
  const punta = e => {
    clearTimeout(rilascio);
    const adesso = performance.now();
    if (ultimoPunto && adesso > ultimoPunto.t) {
      const v = Math.hypot(e.clientX - ultimoPunto.x, e.clientY - ultimoPunto.y) / (adesso - ultimoPunto.t) * 1000;
      S.velocita = Math.max(S.velocita, Math.min(v, 6000));
    }
    ultimoPunto = { x: e.clientX, y: e.clientY, t: adesso };
    S.puntatore = { x: e.clientX, y: e.clientY };
    S.tocco = e.pointerType === 'touch';
    S.ultimoMovimento = S.ora;
  };
  addEventListener('pointermove', punta, { passive: true });
  addEventListener('pointerdown', e => { ultimoPunto = null; punta(e); }, { passive: true });
  const lascia = e => {
    if (e.pointerType !== 'touch') return;
    clearTimeout(rilascio);
    rilascio = setTimeout(() => { S.puntatore = null; }, 1400);
  };
  addEventListener('pointerup', lascia, { passive: true });
  addEventListener('pointercancel', lascia, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { S.puntatore = null; ultimoPunto = null; });
  addEventListener('blur', () => { S.puntatore = null; ultimoPunto = null; });
  let ultimoScorrimento = scrollY;
  addEventListener('scroll', () => {
    S.colpo = limita(S.colpo + (scrollY - ultimoScorrimento) * .0025, -1, 1);
    ultimoScorrimento = scrollY;
    S.scorrimento = S.ora;
    if (S.tocco) S.puntatore = null;
  }, { passive: true });

  const rimisura = () => { misura(); if (ridotto.matches) fermo(); else if (!raf) disegna(); };
  new ResizeObserver(rimisura).observe(canvas);
  new IntersectionObserver(([voce]) => { visibile = voce.isIntersecting; riparti(); }, { threshold: 0 }).observe(canvas);
  document.addEventListener('visibilitychange', riparti);
  ridotto.addEventListener('change', () => { if (ridotto.matches) { cancelAnimationFrame(raf); raf = 0; fermo(); } else riparti(); });
  const ripiego = () => { cancelAnimationFrame(raf); raf = 0; pronto = false; scena.classList.remove('bear-live'); };
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); ripiego(); });
  canvas.addEventListener('webglcontextrestored', () => { larghezza = altezza = 0; prepara().catch(ripiego); });

  prepara().catch(ripiego);
})();
