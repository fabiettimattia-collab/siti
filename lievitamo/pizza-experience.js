(() => {
  'use strict';
  const journey = document.querySelector('.pizza-journey');
  const stage = document.querySelector('.pizza-stage');
  const scene = document.querySelector('#pizza-scene');
  const wheel = document.querySelector('#pizza-wheel');
  if (!journey || !stage || !scene || !wheel) return;
  const $ = (selector) => stage.querySelector(selector);
  const make = (tag, className) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  };
  const selectors = [...stage.querySelectorAll('[data-pizza-select]')];
  const menu = Array.isArray(window.MENU) ? window.MENU : [];
  const money = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
  // Le pizze della scena, nello stesso ordine dei .pz in index.html. Il nome è quello del menu: prezzo e ingredienti arrivano da lì.
  // I colori di ogni pizza stanno in pizza-experience.css (data-flavour e .stage-bg i).
  const pizzas = [
    { name: 'Margherita', kicker: 'L’INTRAMONTABILE', line: 'Il primo amore non si scorda.', tags: [['fiordilatte', 'di Agerola'], ['basilico', 'e felicità']] },
    { name: 'Pistacchiosa', kicker: 'LA GOLOSA', line: 'A certe tentazioni si dice sì.', tags: [['pistacchio', 'di Bronte'], ['mortadella', 'Bologna IGP']] },
    { name: 'Lazzarella', kicker: 'LA DOPPIA COTTURA', line: 'Fritta. Infornata. Innamorata.', tags: [['guanciale', 'croccante'], ['pecorino', 'bagnolese']] },
    { name: 'Carbonara 2.0', kicker: 'ROMA INCONTRA NAPOLI', line: 'Il tuorlo al centro, come il cuore.', tags: [['crema', 'di pecorino'], ['tuorlo', 'd’uovo']] },
    { name: 'Diavola', kicker: 'L’INFUOCATA', line: 'Un amore che pizzica.', tags: [['ventricina', 'piccante'], ['fiordilatte', 'di Agerola']] },
    { name: 'La Partenopea', kicker: 'LA VERACE', line: 'Friarielli e salsiccia, per sempre.', tags: [['crema', 'di friarielli'], ['tarallo', 'sbriciolato']] }
  ].map((pizza) => ({ ...pizza, item: menu.find((item) => item.name === pizza.name) }));
  const nodes = [...wheel.querySelectorAll('.pz')];
  if (pizzas.some((pizza) => !pizza.item) || nodes.length !== pizzas.length || selectors.length !== pizzas.length) return;

  const last = pizzas.length - 1;
  const clamp = (number, min = 0, max = last) => Math.max(min, Math.min(max, number));
  const unit = (number) => clamp(number, 0, 1);
  const smooth = (t) => t * t * (3 - 2 * t);
  const rad = Math.PI / 180;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const narrowQuery = window.matchMedia('(max-width: 760px)');
  const BLOB = 320; // raggio a riposo delle macchie di colore (vedi .stage-bg i)
  const TOSS = 680; // durata del lancio quando si tocca la pizza (ms)
  const TOSS_TURN = 150; // gradi che la pizza gira in aria durante il lancio

  /* ---------- Costruzione della scena ---------- */
  const items = nodes.map((el) => {
    const base = el.querySelector('img');
    base.classList.add('pz-base');
    const shadow = make('div', 'pz-shadow');
    const tilt = make('div', 'pz-tilt');
    const disc = make('div', 'pz-disc');
    const spin = make('div', 'pz-spin'); // giro lento quando la pizza è ferma (CSS)
    spin.append(base);
    disc.append(spin);
    const light = make('div', 'pz-light');
    const shade = make('div', 'pz-shade');
    tilt.append(disc, light, shade);
    const ground = make('div', 'pz-ground');
    ground.append(shadow);
    el.replaceChildren(ground, tilt);
    return { el, base, shadow, tilt, disc, spin, light, shade, turn: 0, on: false };
  });
  journey.style.setProperty('--pizza-steps', String(last));
  const steam = make('div', 'pizza-steam');
  steam.setAttribute('aria-hidden', 'true');
  [[30, 6, 7.5, 0, 14, 12], [52, 14, 9, -3.2, -10, -9], [16, 30, 8.2, -5.5, 8, 7], [58, 34, 10, -1.6, 16, -6], [38, 24, 8.8, -7, -6, 10]].forEach(([x, y, t, d, dx, r]) => {
    const wisp = make('i');
    wisp.style.cssText = `--x:${x}%;--y:${y}%;--t:${t}s;--d:${d}s;--dx:${dx}%;--r:${r}deg`;
    steam.append(wisp);
  });
  const dust = make('div', 'pizza-dust');
  dust.setAttribute('aria-hidden', 'true');
  const random = (min, max) => min + Math.random() * (max - min);
  for (let i = 0; i < 14; i += 1) {
    const mote = make('i', 'mote' + (i % 3 === 0 ? ' soft' : ''));
    const angle = random(0, Math.PI * 2);
    const radius = random(46, 74);
    const x0 = Math.cos(angle) * radius;
    const y0 = Math.sin(angle) * radius;
    const size = i % 3 === 0 ? random(7, 12) : random(2.5, 5.5);
    mote.style.cssText = `--s:${size.toFixed(1)}px;--t:${random(9, 17).toFixed(1)}s;--d:${random(-16, 0).toFixed(1)}s;--o:${(i % 3 === 0 ? .55 : .95)};--x0:calc(var(--pz-size)*${(x0 / 100).toFixed(3)});--y0:calc(var(--pz-size)*${(y0 / 100).toFixed(3)});--x1:calc(var(--pz-size)*${((x0 + random(-9, 9)) / 100).toFixed(3)});--y1:calc(var(--pz-size)*${((y0 - random(6, 16)) / 100).toFixed(3)})${i % 5 === 4 ? ';--c:#c9965a' : ''}`;
    dust.append(mote);
  }
  wheel.before(dust);
  wheel.after(steam);
  stage.classList.add('is-live');
  const backword = $('.journey-backword');
  const bgBlobs = [...stage.querySelectorAll('.stage-bg i')];
  const copyParts = [$('#pizza-kicker'), $('#pizza-name'), $('#pizza-line'), $('#pizza-ingredients'), $('.journey-actions'), $('.journey-note')];
  const fills = selectors.map((button) => button.querySelector('.pizza-picker-track i'));
  let letters = [];

  /* ---------- Stato ---------- */
  let paused = reducedMotion.matches || document.body.classList.contains('motion-paused');
  let active = -1;
  let target = 0;
  let frame = 0;
  let lastTime = 0;
  let scrollFrame = 0;
  let idleTimer = 0;
  let settleTimer = 0;
  let drag = null;
  let pinned = true;
  let narrow = narrowQuery.matches;
  let range = 1;
  let scrollStart = 0;
  let size = 500;
  let pathRadius = 900;
  let arc = 56 * rad;
  let blobMax = 6;
  let visible = true;
  let started = false;
  let settled = false;
  let settledAt = 0;
  let arrived = -1;
  let hot = false;
  let tossAt = 0;
  let tossIndex = -1;
  let entrance = true;
  let announcementTimer;
  // Molle: x = valore, v = velocità. La posizione parte da -1 così la prima pizza entra rotolando.
  const pos = { x: -1, v: 0 };
  const wobble = { x: 0, v: 0 };
  const hover = { x: 0, v: 0 };
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  function spring(state, goal, stiffness, damping, dt) {
    state.v += (stiffness * (goal - state.x) - damping * state.v) * dt;
    state.x += state.v * dt;
  }

  /* ---------- Testi e stato accessibile ---------- */
  function describe(index, announce = true) {
    if (active === index) return;
    active = index;
    const pizza = pizzas[index];
    const number = String(index + 1).padStart(2, '0');
    stage.dataset.flavour = String(index);
    // Il nome grande si rimpicciolisce da solo se è lungo (vedi --name-chars nel CSS).
    stage.style.setProperty('--name-chars', String(pizza.name.length + 1));
    $('#pizza-name').replaceChildren(document.createTextNode(pizza.name), Object.assign(document.createElement('span'), { textContent: '.' }));
    $('#pizza-kicker').textContent = number + ' / ' + pizza.kicker;
    $('#pizza-line').textContent = pizza.line;
    $('#pizza-ingredients').textContent = pizza.item.description;
    $('#pizza-price').textContent = money.format(pizza.item.price);
    $('#pizza-add').dataset.featureAdd = pizza.name;
    $('#pizza-add').setAttribute('aria-label', 'Aggiungi ' + pizza.name + ', ' + money.format(pizza.item.price));
    $('#pizza-position').textContent = number;
    letters = [...pizza.name].map((character) => Object.assign(make('span'), { textContent: character }));
    backword.replaceChildren(...letters);
    [$('#pizza-tag-one'), $('#pizza-tag-two')].forEach((tag, i) => {
      tag.replaceChildren(document.createTextNode(pizza.tags[i][0]), document.createElement('br'), Object.assign(document.createElement('b'), { textContent: pizza.tags[i][1] }));
    });
    selectors.forEach((button, i) => {
      button.classList.toggle('is-active', i === index);
      button.setAttribute('aria-pressed', String(i === index));
    });
    items.forEach((item, i) => item.el.setAttribute('aria-hidden', String(i !== index)));
    clearTimeout(announcementTimer);
    if (announce) announcementTimer = setTimeout(() => {
      $('#pizza-announcement').textContent = pizza.name + ', ' + (index + 1) + ' di ' + pizzas.length + '. ' + money.format(pizza.item.price) + '.';
    }, 220);
  }

  /* ---------- Farina che si alza quando una pizza si posa ---------- */
  function puff(strength = 1) {
    if (paused || !visible || typeof dust.animate !== 'function') return;
    const side = narrow ? [1, 0] : [0, 1];
    for (let i = 0; i < 16; i += 1) {
      const speck = make('i', i % 4 === 0 ? 'soft' : '');
      const angle = Math.atan2(side[1], side[0]) + random(-1.5, 1.5);
      const start = size * random(.4, .5);
      const travel = size * random(.06, .2) * strength;
      const speckSize = i % 4 === 0 ? random(8, 14) : random(2.5, 6);
      speck.style.setProperty('--s', speckSize.toFixed(1) + 'px');
      if (i % 6 === 5) speck.style.setProperty('--c', '#c9965a');
      dust.append(speck);
      const x = Math.cos(angle);
      const y = Math.sin(angle);
      speck.animate([
        { opacity: 0, transform: `translate3d(${(x * start).toFixed(1)}px,${(y * start).toFixed(1)}px,0) scale(.5)` },
        { opacity: i % 4 === 0 ? .6 : 1, offset: .18 },
        { opacity: 0, transform: `translate3d(${(x * (start + travel)).toFixed(1)}px,${(y * (start + travel) - size * random(.02, .07)).toFixed(1)}px,0) scale(1.1)` }
      ], { duration: random(700, 1500), easing: 'cubic-bezier(.1,.7,.3,1)', fill: 'forwards' }).onfinish = () => speck.remove();
    }
  }

  /* ---------- Disegno di un fotogramma ---------- */
  function render(now) {
    const p = pos.x;
    const shown = clamp(Math.round(p));
    describe(shown);
    const d = p - shown;
    const direction = d < 0 ? -1 : 1;
    const away = unit(Math.abs(d) / .44);
    const still = paused;
    // Lancio: la pizza toccata sale, gira e ricade (air va da 0 a 1 e torna a 0).
    const tossT = tossAt ? unit((now - tossAt) / TOSS) : 0;
    const air = tossAt ? Math.sin(Math.PI * tossT) : 0;

    items.forEach((item, index) => {
      const delta = index - p;
      const distance = Math.abs(delta);
      if (distance > 1.15 || (still && index !== shown)) {
        if (item.on) { item.el.style.visibility = 'hidden'; item.on = false; }
        return;
      }
      if (!item.on) { item.el.style.visibility = 'visible'; item.on = true; }
      const isActive = index === shown ? 1 : 0;
      const flight = index === tossIndex ? air : 0;
      const travel = Math.min(1, distance);
      // A metà del cambio le due pizze restano vicine: una esce mentre l'altra è già in arrivo.
      const eased = Math.sign(delta) * Math.pow(travel, 1.3);
      const phi = eased * arc;
      const entering = p < 0 ? travel : 0; // solo la prima entrata: la pizza arriva più grande, come dall'alto
      let x;
      let y;
      let rx = 0;
      let ry = 0;
      if (narrow) {
        x = pathRadius * Math.sin(phi);
        y = pathRadius * (1 - Math.cos(phi)) * .7;
        ry = eased * -34 + isActive * wobble.x;
      } else {
        x = pathRadius * (1 - Math.cos(phi)) * .62;
        y = pathRadius * Math.sin(phi);
        rx = eased * 32 + isActive * wobble.x;
      }
      rx += isActive * -pointer.y * 8;
      ry += isActive * pointer.x * 9;
      const height = clamp(travel * 1.5 + isActive * hover.x * .55 + flight * 1.25, 0, 1.9);
      const scale = 1 - travel * .13 + entering * .42 + isActive * (hover.x * .02 - Math.abs(wobble.x) * .0025) + flight * .1;
      const turning = index === tossIndex && tossAt ? smooth(tossT) * TOSS_TURN : 0;
      const rotation = eased * (narrow ? 150 : 128) + entering * 70 + item.turn + turning;
      item.el.style.transform = `translate3d(${x.toFixed(2)}px,${(y - flight * size * .05).toFixed(2)}px,0) scale(${scale.toFixed(4)})`;
      item.el.style.zIndex = String(isActive ? 3 : 1);
      item.tilt.style.transform = `perspective(${(size * 1.9).toFixed(0)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
      item.disc.style.transform = `rotate(${rotation.toFixed(2)}deg)`;
      item.shadow.style.transform = `translate3d(${(size * (.02 + .05 * height)).toFixed(2)}px,${(size * (.045 + .085 * height) + flight * size * .05).toFixed(2)}px,0) scale(${(1 + .08 * height).toFixed(4)})`;
      item.shadow.style.opacity = (1 - .45 * Math.min(1, height)).toFixed(3);
      const shift = `translate3d(${(pointer.x * size * .1 + ry * size * .002).toFixed(2)}px,${(pointer.y * size * .1 - rx * size * .002).toFixed(2)}px,0)`;
      item.light.style.transform = shift;
      item.shade.style.transform = shift;
    });
    if (tossAt && tossT >= 1) {
      // Atterraggio: la pizza tiene il giro fatto in aria, si assesta e alza un filo di farina.
      items[tossIndex].turn = (items[tossIndex].turn + TOSS_TURN) % 360;
      tossAt = 0;
      tossIndex = -1;
      wobble.v += (narrow ? -1 : 1) * 30;
      puff(.7);
    }

    // Fondo che si scioglie nel colore successivo, allargandosi da sotto la pizza.
    bgBlobs.forEach((blob, index) => {
      const amount = still ? Number(shown > index) : smooth(unit((p - index - .12) / .76));
      blob.style.transform = `scale(${(amount * blobMax).toFixed(3)})`;
    });
    // Testi: escono verso l'alto e rientrano dal basso, uno dopo l'altro, seguendo lo scroll.
    const count = copyParts.length;
    copyParts.forEach((part, index) => {
      if (!part) return;
      const order = direction < 0 ? count - 1 - index : index;
      const e = still ? 0 : smooth(unit((away - order * .07) / (1 - (count - 1) * .07)));
      part.style.opacity = (1 - e).toFixed(3);
      part.style.transform = e ? `translate3d(0,${(-direction * e * 42).toFixed(1)}px,0)` : '';
    });
    $('#pizza-add').style.pointerEvents = away > .5 ? 'none' : '';
    // Il nome grande sullo sfondo cambia lettera per lettera.
    const total = letters.length;
    letters.forEach((letter, index) => {
      const order = direction < 0 ? total - 1 - index : index;
      const e = still ? 0 : smooth(unit((away * 1.25 - order / total * .45) / .8));
      letter.style.opacity = (1 - e).toFixed(3);
      letter.style.transform = e ? `translate3d(0,${(-direction * e * 46).toFixed(1)}%,0) rotate(${(direction * e * 7).toFixed(1)}deg)` : '';
    });
    backword.style.transform = still ? '' : `translate3d(${(-pointer.x * 16 - d * 60).toFixed(1)}px,${(-pointer.y * 9).toFixed(1)}px,0)`;
    dust.style.transform = still ? '' : `translate3d(${(-pointer.x * 20).toFixed(1)}px,${(-pointer.y * 14).toFixed(1)}px,0)`;
    fills.forEach((fill, index) => {
      if (fill) fill.style.transform = still ? '' : `scaleX(${unit(1 - Math.abs(index - p)).toFixed(3)})`;
    });

    // «Posata»: da qui partono vapore, giro lento, ingredienti scritti e la frase.
    const resting = still || (Math.abs(d) < .02 && Math.abs(pos.v) < .12 && !(drag && drag.horizontal));
    if (resting !== settled) {
      settled = resting;
      settledAt = now;
      clearTimeout(settleTimer);
      if (settled && !still) settleTimer = setTimeout(requestDraw, 280);
    }
    const showDetails = settled && (still || now - settledAt >= 260);
    if (stage.classList.contains('is-settled') !== showDetails) stage.classList.toggle('is-settled', showDetails);
    if (settled && arrived !== shown) {
      if (arrived !== -2 && !still) {
        wobble.v += (narrow ? -1 : 1) * 46 * (pos.v < 0 ? -1 : 1);
        puff(entrance ? 1.3 : 1);
      }
      arrived = shown;
    }
    if (settled) entrance = false;
    if (!settled && Math.abs(d) > .2) arrived = -3;
    return showDetails;
  }

  function draw(now) {
    frame = 0;
    const dt = Math.min(.034, lastTime ? (now - lastTime) / 1000 : .016);
    lastTime = now;
    if (paused || !visible || !started) {
      pos.x = started ? clamp(Math.round(target)) : pos.x;
      pos.v = wobble.v = hover.v = 0;
      wobble.x = hover.x = pointer.x = pointer.y = 0;
      tossAt = 0;
      tossIndex = -1;
      if (started) render(now);
      lastTime = 0;
      return;
    }
    const lifted = stage.classList.contains('is-settled');
    for (let step = 0; step < 2; step += 1) {
      const h = dt / 2;
      if (entrance) spring(pos, target, 26, 8.4, h);
      else spring(pos, target, drag ? 190 : 95, drag ? 26 : 15.6, h);
      spring(wobble, 0, 150, 7.5, h);
      spring(hover, hot && lifted ? 1 : 0, 90, 14, h);
    }
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 7);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 7);
    if (Math.abs(target - pos.x) < .0004 && Math.abs(pos.v) < .002) { pos.x = target; pos.v = 0; }
    const liftedNow = render(now);
    const moving = pos.x !== target || Math.abs(wobble.x) > .02 || Math.abs(wobble.v) > .1 ||
      Math.abs(hover.v) > .01 || Math.abs(hover.x - (hot && liftedNow ? 1 : 0)) > .005 ||
      Math.abs(pointer.tx - pointer.x) > .002 || Math.abs(pointer.ty - pointer.y) > .002 || tossAt !== 0;
    if (moving) requestDraw();
    else lastTime = 0;
  }
  function requestDraw() { if (!frame) frame = requestAnimationFrame(draw); }

  /* ---------- Scroll, misure, scelta ---------- */
  function scrollTarget() {
    const progress = unit((window.scrollY - scrollStart) / range) * last;
    const index = Math.min(last - 1, Math.floor(progress));
    // Vicino a ogni pizza lo scroll «riposa»: il cambio avviene nella parte centrale del tratto.
    return index + smooth(unit((progress - index - .26) / .48));
  }
  function readScroll() {
    scrollFrame = 0;
    if (!pinned || drag) return;
    const next = scrollTarget();
    if (next > .02) entrance = false; // chi scorre subito non aspetta la fine dell'entrata
    target = next;
    requestDraw();
    clearTimeout(idleTimer);
    // Se ci si ferma a metà di un cambio, la scena si assesta sulla pizza più vicina senza toccare lo scroll.
    idleTimer = setTimeout(() => {
      if (!pinned || drag || paused) return;
      target = clamp(Math.round(target));
      requestDraw();
    }, 260);
  }
  function measure() {
    const style = getComputedStyle(stage);
    pinned = style.position === 'sticky';
    narrow = narrowQuery.matches;
    const stickyTop = parseFloat(style.top) || 0;
    scrollStart = journey.getBoundingClientRect().top + window.scrollY - stickyTop;
    range = Math.max(1, journey.offsetHeight - stage.offsetHeight);
    size = items[0].el.offsetWidth || 500;
    const box = stage.getBoundingClientRect();
    const centre = wheel.getBoundingClientRect();
    const cx = centre.left - box.left;
    const cy = centre.top - box.top;
    stage.style.setProperty('--cx', cx.toFixed(1) + 'px');
    stage.style.setProperty('--cy', cy.toFixed(1) + 'px');
    const far = Math.hypot(Math.max(cx, box.width - cx), Math.max(cy, box.height - cy));
    blobMax = far / (BLOB * .78) * 1.06;
    arc = (narrow ? 32 : 56) * rad;
    pathRadius = ((narrow ? Math.max(cx, box.width - cx) : Math.max(cy, box.height - cy)) + size / 2 + 40) / Math.sin(arc);
    $('#pizza-help').replaceChildren();
    const arrow = Object.assign(document.createElement('span'), { textContent: pinned ? '↓' : '↔' });
    arrow.setAttribute('aria-hidden', 'true');
    $('#pizza-help').append(arrow, document.createTextNode(pinned ? ' Scorri o trascina' : ' Trascina o usa le frecce'));
    if (pinned && !drag) target = scrollTarget();
    requestDraw();
  }
  function choose(index, fromDrag = false) {
    const next = clamp(index);
    target = next;
    requestDraw();
    if (pinned) window.scrollTo({ top: scrollStart + range * next / last, behavior: paused || fromDrag ? 'instant' : 'smooth' });
  }

  selectors.forEach((button) => button.addEventListener('click', () => choose(Number(button.dataset.pizzaSelect))));
  scene.addEventListener('keydown', (event) => {
    const changes = { ArrowRight: active + 1, ArrowDown: active + 1, ArrowLeft: active - 1, ArrowUp: active - 1, Home: 0, End: last };
    if (!(event.key in changes)) return;
    const next = clamp(changes[event.key]);
    // Alla prima e all'ultima pizza le frecce su e giù tornano a scorrere la pagina.
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && next === active) return;
    event.preventDefault();
    choose(next);
  });
  function overPizza(event) {
    const centre = wheel.getBoundingClientRect();
    return Math.hypot(event.clientX - centre.left, event.clientY - centre.top) < size * .5;
  }
  scene.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, start: clamp(Math.round(target)), horizontal: false, onPizza: overPizza(event) };
    if (event.pointerType === 'mouse') scene.setPointerCapture(event.pointerId);
  });
  scene.addEventListener('pointermove', (event) => {
    if (drag && drag.id === event.pointerId) {
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.horizontal && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        drag.horizontal = true;
        scene.classList.add('is-dragging');
        if (!scene.hasPointerCapture(event.pointerId)) scene.setPointerCapture(event.pointerId);
      }
      if (drag.horizontal) {
        target = clamp(drag.start - dx / Math.max(260, size) * 1.25, drag.start - 1, drag.start + 1);
        target = clamp(target, -.12, last + .12);
        requestDraw();
      }
    } else if (event.pointerType === 'mouse' && !paused) {
      const centre = wheel.getBoundingClientRect();
      pointer.tx = clamp((event.clientX - centre.left) / (size * .55), -1, 1);
      pointer.ty = clamp((event.clientY - centre.top) / (size * .55), -1, 1);
      hot = overPizza(event);
      requestDraw();
    }
  });
  function finishDrag(event, cancel = false) {
    if (!drag || drag.id !== event.pointerId) return;
    const wasHorizontal = drag.horizontal;
    const tapped = !wasHorizontal && !cancel && drag.onPizza && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 10;
    const desired = clamp(Math.round(target + (target - drag.start) * .6));
    drag = null;
    scene.classList.remove('is-dragging');
    if (scene.hasPointerCapture(event.pointerId)) scene.releasePointerCapture(event.pointerId);
    if (wasHorizontal && !cancel) choose(desired, true);
    else if (pinned) readScroll();
    else { target = clamp(Math.round(target)); requestDraw(); }
    if (tapped && !paused && !tossAt && stage.classList.contains('is-settled')) {
      // Toccare la pizza: un piccolo lancio, come al banco del pizzaiolo.
      tossAt = performance.now();
      tossIndex = active;
      requestDraw();
    }
  }
  scene.addEventListener('pointerup', (event) => finishDrag(event));
  scene.addEventListener('pointercancel', (event) => finishDrag(event, true));
  scene.addEventListener('lostpointercapture', (event) => finishDrag(event, true));
  stage.addEventListener('pointerleave', () => { pointer.tx = 0; pointer.ty = 0; hot = false; requestDraw(); });
  stage.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || paused || drag || scene.contains(event.target)) return;
    const centre = wheel.getBoundingClientRect();
    pointer.tx = clamp((event.clientX - centre.left) / (size * .9), -1, 1) * .7;
    pointer.ty = clamp((event.clientY - centre.top) / (size * .9), -1, 1) * .7;
    hot = false;
    requestDraw();
  });
  window.addEventListener('scroll', () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(readScroll); }, { passive: true });
  window.addEventListener('resize', measure, { passive: true });

  /* ---------- «La scelgo»: una pizza vola nella scelta ---------- */
  function spinAngle(item) {
    // Angolo attuale del giro lento (animazione CSS), per far partire la copia esattamente come si vede.
    const matrix = getComputedStyle(item.spin).transform;
    if (!matrix || matrix === 'none') return 0;
    const values = matrix.slice(matrix.indexOf('(') + 1, -1).split(',').map(Number);
    return Math.atan2(values[1], values[0]) / rad;
  }
  $('#pizza-add').addEventListener('click', () => {
    const pill = document.querySelector('#basket-toggle');
    const item = items[active];
    if (paused || !pill || pill.hidden || !item || typeof document.body.animate !== 'function') return;
    const from = item.el.getBoundingClientRect();
    const to = pill.getBoundingClientRect();
    if (!from.width || !to.width) return;
    const fly = make('div', 'pizza-fly');
    const image = new Image();
    image.alt = '';
    image.src = item.base.currentSrc || item.base.src;
    fly.append(image);
    fly.style.cssText = `left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px`;
    const angle = item.turn + spinAngle(item);
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const end = Math.max(.03, to.height * 1.15 / from.width);
    document.body.append(fly);
    fly.animate([
      { transform: `translate3d(0,0,0) scale(1) rotate(${angle.toFixed(1)}deg)`, opacity: 0 },
      { transform: `translate3d(0,${(-from.height * .03).toFixed(1)}px,0) scale(1.02) rotate(${(angle - 6).toFixed(1)}deg)`, opacity: 1, offset: .08 },
      { transform: `translate3d(${(dx * .42).toFixed(1)}px,${(dy * .28 - 60).toFixed(1)}px,0) scale(.46) rotate(${(angle - 80).toFixed(1)}deg)`, opacity: 1, offset: .46 },
      { transform: `translate3d(${dx.toFixed(1)}px,${dy.toFixed(1)}px,0) scale(${end.toFixed(3)}) rotate(${(angle - 220).toFixed(1)}deg)`, opacity: .3 }
    ], { duration: 860, easing: 'cubic-bezier(.4,0,.5,1)' }).onfinish = () => {
      fly.remove();
      pill.animate?.([{ transform: 'translateX(-50%) scale(1)' }, { transform: 'translateX(-50%) scale(1.09)' }, { transform: 'translateX(-50%) scale(1)' }], { duration: 320, easing: 'ease-out' });
    };
  });

  /* ---------- Pausa, movimento ridotto, fuori schermo ---------- */
  const syncMotion = () => {
    paused = reducedMotion.matches || document.body.classList.contains('motion-paused');
    if (paused && !started) begin();
    requestDraw();
  };
  new MutationObserver(syncMotion).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  reducedMotion.addEventListener?.('change', syncMotion);
  if ('IntersectionObserver' in window) new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    stage.classList.toggle('journey-offscreen', !visible);
    document.body.classList.toggle('on-hero', visible);
    requestDraw();
  }, { threshold: 0 }).observe(journey);
  else document.body.classList.remove('on-hero');

  /* ---------- Avvio: la prima pizza entra appena l'immagine è pronta ---------- */
  function begin() {
    if (started) return;
    started = true;
    if (paused || window.scrollY > scrollStart + range * .2) { pos.x = clamp(Math.round(target)); arrived = -2; }
    requestDraw();
  }
  describe(0, false);
  document.body.classList.add('on-hero');
  measure();
  const first = items[0].base;
  const ready = first.complete && first.naturalWidth ? Promise.resolve() : new Promise((resolve) => {
    first.addEventListener('load', resolve, { once: true });
    first.addEventListener('error', resolve, { once: true });
  });
  Promise.race([ready.then(() => first.decode?.().catch(() => {})), new Promise((resolve) => setTimeout(resolve, 2500))]).then(begin).then(() => {
    // Le altre pizze si preparano in anticipo, una dopo l'altra, così la prima volta che entrano non scattano.
    setTimeout(() => items.slice(1).reduce((chain, item) => chain.then(() => item.base.decode?.().catch(() => {})), Promise.resolve()), 900);
  });
  document.fonts?.ready?.then(measure);
})();
