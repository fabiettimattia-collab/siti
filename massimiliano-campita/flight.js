import { FlightMotion } from './flight-motion.js';

(() => {
  'use strict';
  const journey = document.querySelector('.flight-journey');
  const opening = journey?.querySelector('.opening');
  const aircraft = document.querySelector('#flight-aircraft');
  const plane = document.querySelector('#flight-plane');
  const sky = document.querySelector('#flight-sky');
  if (!journey || !opening || !aircraft || !plane || !sky) return;
  const landscape = journey.querySelector('.flight-landscape');
  const atmosphere = journey.querySelector('.flight-atmosphere');
  const haze = journey.querySelector('.flight-haze');
  const copy = journey.querySelector('.hero-content');
  const bar = journey.querySelector('.flight-progress span');
  const hint = document.querySelector('#flight-hint');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(any-pointer: fine)');
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  let motion = new FlightMotion();
  let dimensions = { width: 1440, height: 900, start: 0, distance: 1, mobile: false };
  let ready = false;
  let inView = true;
  let paused = document.body.classList.contains('motion-paused') || reduce.matches;
  let frame = 0;
  let lastTime = null;

  function canAnimate() { return ready && !paused && inView && !document.hidden; }
  function updateHint() {
    hint.textContent = reduce.matches ? 'Scena di volo con movimento ridotto.'
      : paused ? 'Volo in pausa. La pagina resta libera di scorrere.'
      : finePointer.matches ? 'Scorri per seguire il volo. Muovi il cursore per virare.'
      : 'Scorri: l’aereo accompagna il tuo viaggio.';
  }
  function readScroll() {
    motion.setProgress((scrollY - dimensions.start) / dimensions.distance);
    requestFrame();
  }
  function measure() {
    const rect = opening.getBoundingClientRect();
    const pinned = getComputedStyle(opening).position === 'sticky';
    dimensions = {
      width: rect.width,
      height: rect.height,
      start: journey.getBoundingClientRect().top + scrollY,
      distance: Math.max(1, pinned ? journey.offsetHeight - opening.offsetHeight : opening.offsetHeight),
      mobile: rect.width <= 800
    };
    if (!finePointer.matches) motion.releasePointer();
    updateHint();
    readScroll();
    if (paused) render();
  }
  function render() {
    const state = motion.state;
    const p = reduce.matches ? 0 : clamp(state.progress, 0, 1);
    const px = reduce.matches ? 0 : state.x;
    const py = reduce.matches ? 0 : state.y;
    const t = reduce.matches ? 0 : state.time;
    const { width, height, mobile } = dimensions;
    const float = Math.sin(t * .87) * (mobile ? 2 : 4.3) + Math.sin(t * .37) * 1.4;
    const drift = Math.sin(t * .29) * (mobile ? 1.5 : 5);
    const horizontal = -p * width * (mobile ? .065 : .18) + px * width * (mobile ? .027 : .068) + drift;
    const descent = p * (mobile ? Math.min(height, 900) * .061 : height * .22)
      + py * height * (mobile ? .014 : .045) + float;
    const bank = -p * (mobile ? 11 : 14) + px * 5.2 - py * 2.4
      + Math.sin(t * .56) * .65 + (reduce.matches ? 0 : clamp(state.vx * .27, -1.2, 1.2));
    const scale = 1 - p * (mobile ? .12 : .14);
    aircraft.style.transform = `translate(-50%, -50%) translate3d(${horizontal.toFixed(3)}px, ${descent.toFixed(3)}px, 0) perspective(1400px) rotateX(${(py * 2).toFixed(3)}deg) rotateY(${(px * 5).toFixed(3)}deg) rotate(${bank.toFixed(3)}deg) scale(${scale.toFixed(5)})`;
    const cameraX = -px * width * (mobile ? .021 : .027) + Math.sin(t * .14) * 7;
    const cameraY = -p * height * .075 - py * height * .023 + Math.sin(t * .19) * 4;
    landscape.style.transform = `translate3d(${cameraX.toFixed(3)}px,${cameraY.toFixed(3)}px,0) rotate(${(-px * .5).toFixed(3)}deg) scale(${(1.045 + p * .06).toFixed(5)})`;
    if (atmosphere) atmosphere.style.transform = `translate3d(${(-px * width * .045).toFixed(3)}px,${(-p * height * .11 - py * 21).toFixed(3)}px,0)`;
    haze.style.transform = `translate3d(${(-px * 30).toFixed(3)}px,${(-p * height * .13).toFixed(3)}px,0) scale(${(1 + p * .15).toFixed(5)})`;
    haze.style.opacity = String(.16 + p * .45);
    copy.style.transform = `translate3d(0,${(-p * (mobile ? 0 : 65)).toFixed(3)}px,0)`;
    copy.style.opacity = String(1 - p * .23);
    bar.style.transform = `scaleX(${(.03 + .97 * p).toFixed(5)})`;
  }
  function tick(time) {
    frame = 0;
    if (!canAnimate()) { lastTime = null; return; }
    const elapsed = lastTime === null ? 0 : (time - lastTime) / 1000;
    lastTime = time;
    motion.step(elapsed);
    render();
    requestFrame();
  }
  function requestFrame() {
    if (canAnimate() && !frame) frame = requestAnimationFrame(tick);
  }
  function stopFrame() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastTime = null;
  }
  function updateActivity() {
    opening.classList.toggle('flight-inactive', !inView || document.hidden);
    if (canAnimate()) requestFrame(); else stopFrame();
  }
  function releasePointer() {
    motion.releasePointer();
    requestFrame();
  }
  function syncMotion() {
    const nextPaused = reduce.matches || document.body.classList.contains('motion-paused');
    if (paused !== nextPaused) {
      paused = nextPaused;
      motion.releasePointer();
      if (paused) stopFrame();
      else { lastTime = null; readScroll(); }
    }
    updateHint();
    updateActivity();
  }
  function loadImage(image) {
    return new Promise((resolve, reject) => {
      if (image.complete) image.naturalWidth > 0 ? resolve() : reject(new Error('Flight asset unavailable'));
      else {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', reject, { once: true });
      }
    });
  }
  opening.addEventListener('pointermove', event => {
    if (!ready || paused || !finePointer.matches || event.pointerType !== 'mouse') return;
    const rect = opening.getBoundingClientRect();
    motion.setPointer((event.clientX - rect.left) / rect.width * 2 - 1,
      (event.clientY - rect.top) / rect.height * 2 - 1);
    requestFrame();
  }, { passive: true });
  opening.addEventListener('pointerleave', releasePointer, { passive: true });
  // Some embedded browsers only send pointerout when crossing into the app chrome.
  document.addEventListener('pointerout', event => { if (!event.relatedTarget) releasePointer(); }, { passive: true });
  window.addEventListener('blur', releasePointer);
  window.addEventListener('scroll', readScroll, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  finePointer.addEventListener?.('change', measure);
  new MutationObserver(syncMotion).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  reduce.addEventListener?.('change', () => {
    if (reduce.matches) motion = new FlightMotion();
    syncMotion();
    measure();
    render();
  });
  document.addEventListener('visibilitychange', () => {
    releasePointer();
    lastTime = null;
    updateActivity();
    if (!document.hidden) readScroll();
  });
  if ('IntersectionObserver' in window) new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (!inView) releasePointer();
    lastTime = null;
    updateActivity();
    readScroll();
  }, { threshold: 0 }).observe(opening);
  measure();
  Promise.all([loadImage(plane), loadImage(sky)]).then(() => {
    ready = true;
    motion = new FlightMotion(reduce.matches ? 0 : motion.target.progress);
    render();
    opening.classList.add('flight-ready');
    updateActivity();
  }).catch(() => {
    journey.classList.add('flight-unavailable');
    measure();
  });
})();
