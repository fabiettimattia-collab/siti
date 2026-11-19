// Studio Legale Madeo: piccoli comportamenti della pagina. Nessun dato raccolto, nessun invio.
(function () {
  'use strict';

  var testata = document.querySelector('[data-testata]');
  var bottoneMenu = document.querySelector('[data-menu-btn]');
  var menu = document.querySelector('[data-menu]');

  // Testata: diventa piena quando la pagina scorre.
  function aggiornaTestata() {
    if (!testata) return;
    testata.setAttribute('data-solida', window.scrollY > 24 ? 'si' : 'no');
  }
  aggiornaTestata();
  window.addEventListener('scroll', aggiornaTestata, { passive: true });

  // Menu su telefono.
  function chiudiMenu() {
    if (!menu || !bottoneMenu) return;
    menu.removeAttribute('data-aperto');
    testata.removeAttribute('data-aperta');
    bottoneMenu.setAttribute('aria-expanded', 'false');
  }
  if (bottoneMenu && menu) {
    bottoneMenu.addEventListener('click', function () {
      var aperto = bottoneMenu.getAttribute('aria-expanded') === 'true';
      if (aperto) { chiudiMenu(); return; }
      menu.setAttribute('data-aperto', 'si');
      testata.setAttribute('data-aperta', 'si');
      bottoneMenu.setAttribute('aria-expanded', 'true');
    });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) chiudiMenu(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && bottoneMenu.getAttribute('aria-expanded') === 'true') { chiudiMenu(); bottoneMenu.focus(); }
    });
    window.matchMedia('(min-width: 900px)').addEventListener('change', chiudiMenu);
  }

  // Comparsa delle sezioni al passaggio.
  var daRivelare = document.querySelectorAll('.rivela');
  if ('IntersectionObserver' in window) {
    var osservatore = new IntersectionObserver(function (voci) {
      voci.forEach(function (v) {
        if (v.isIntersecting) { v.target.classList.add('visto'); osservatore.unobserve(v.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    daRivelare.forEach(function (el) { osservatore.observe(el); });
  } else {
    daRivelare.forEach(function (el) { el.classList.add('visto'); });
  }

  // Voce di menu della sezione in vista.
  var vociMenu = menu ? menu.querySelectorAll('a[href^="#"]') : [];
  if ('IntersectionObserver' in window && vociMenu.length) {
    var mappa = {};
    vociMenu.forEach(function (a) { mappa[a.getAttribute('href').slice(1)] = a; });
    var spia = new IntersectionObserver(function (voci) {
      voci.forEach(function (v) {
        if (!v.isIntersecting) return;
        vociMenu.forEach(function (a) { a.removeAttribute('aria-current'); });
        var a = mappa[v.target.id];
        if (a) a.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['studio', 'aree', 'avvocato', 'sedi'].forEach(function (id) {
      var s = document.getElementById(id); if (s) spia.observe(s);
    });
  }

  // Finestra «Cosa significa» della proposta.
  document.querySelectorAll('[data-apri]').forEach(function (b) {
    b.addEventListener('click', function () {
      var d = document.getElementById(b.getAttribute('data-apri'));
      if (d && typeof d.showModal === 'function') d.showModal();
      else if (d) d.setAttribute('open', '');
    });
  });
  document.querySelectorAll('dialog').forEach(function (d) {
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
  });
})();
