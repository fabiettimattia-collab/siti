(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const books = {
    polvere: {
      title: 'Il colore della polvere', publisher: 'L’Erudita', year: '2018 · edizione in catalogo', pages: '150', isbn: '9788867702831', cover: 'assets/colore-polvere.jpg',
      summary: 'Somalia, 1993. Un militare italiano attraversa un conflitto che mette alla prova le sue certezze. L’incontro con una donna e una bambina apre uno spazio inatteso per i legami e la responsabilità, dentro una realtà segnata dalla guerra.',
      note: 'La biografia Emersioni colloca l’esordio nel 2017; il catalogo Feltrinelli riporta un’edizione 2018. Le date si riferiscono a indicazioni editoriali diverse.',
      url: 'https://www.lafeltrinelli.it/colore-della-polvere-libro-massimiliano-campita/e/9788867702831', link: 'Apri la scheda in libreria'
    },
    anima: {
      title: 'L’anima rigata', publisher: 'Emersioni', year: '2019', pages: '151', isbn: '9788831924276', cover: 'assets/anima-rigata.jpg',
      summary: 'Nei primi anni Ottanta, la scomparsa di una ragazza spinge un giovane soldato a cercare la verità. Tra Venezia e il clima della Guerra Fredda, la sua indagine incrocia paure, segreti e le ombre di un’intera epoca.',
      note: 'Presentazione e dati bibliografici dalle schede editoriali. Per acquisto, prezzo e disponibilità fa riferimento il catalogo esterno.',
      url: 'https://www.emersioni.it/prodotto/lanima-rigata/', link: 'Apri la scheda dell’editore'
    }
  };
  const nav = $('#main-nav');
  const navToggle = $('#nav-toggle');
  function setNav(open, restoreFocus = false) {
    nav.classList.toggle('is-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Chiudi navigazione' : 'Apri navigazione');
    if (restoreFocus) navToggle.focus();
  }
  navToggle.addEventListener('click', () => setNav(navToggle.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (event) => { if (event.target.closest('a')) setNav(false); });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && navToggle.getAttribute('aria-expanded') === 'true') setNav(false, true);
  });

  document.querySelectorAll('.security-topics details').forEach((detail) => {
    const update = () => { detail.querySelector('summary b').textContent = detail.open ? '−' : '+'; };
    detail.addEventListener('toggle', update); update();
  });

  $('#reading-filters').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-filter]');
    if (!button) return;
    const filter = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach((node) => {
      const active = node === button;
      node.classList.toggle('active', active);
      node.setAttribute('aria-pressed', String(active));
    });
    let count = 0;
    document.querySelectorAll('.reading-row').forEach((row) => {
      const visible = filter === 'tutto' || row.dataset.category === filter;
      row.hidden = !visible;
      if (visible) count++;
    });
    $('#reading-count').textContent = count + (count === 1 ? ' riferimento visibile' : ' riferimenti visibili');
  });

  const dialog = $('#book-dialog');
  let selectedBook = null;
  let opener = null;
  function openBook(id, button) {
    const book = books[id];
    if (!book) return;
    selectedBook = book;
    opener = button;
    $('#dialog-cover').src = book.cover;
    $('#dialog-cover').alt = 'Copertina di ' + book.title;
    $('#dialog-publisher').textContent = book.publisher + ' · ROMANZO';
    $('#book-dialog-title').textContent = book.title;
    $('#dialog-summary').textContent = book.summary;
    $('#dialog-note').textContent = book.note;
    const link = $('#dialog-link');
    link.href = book.url;
    link.firstChild.textContent = book.link + ' ';
    const list = $('#dialog-details');
    list.replaceChildren();
    [['Editore', book.publisher], ['Edizione', book.year], ['Pagine', book.pages], ['ISBN', book.isbn]].forEach(([name, value]) => {
      const row = document.createElement('div');
      const term = document.createElement('dt'); term.textContent = name;
      const detail = document.createElement('dd'); detail.textContent = value;
      row.append(term, detail); list.append(row);
    });
    $('#isbn-status').textContent = '';
    $('#isbn-fallback')?.remove();
    dialog.showModal();
    document.body.classList.add('dialog-open');
    $('#close-book').focus();
  }
  document.querySelectorAll('[data-book]').forEach((button) => button.addEventListener('click', () => openBook(button.dataset.book, button)));
  $('#close-book').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    document.body.classList.remove('dialog-open');
    if (opener?.isConnected) opener.focus();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });
  $('#copy-isbn').addEventListener('click', async () => {
    if (!selectedBook) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(selectedBook.isbn);
      $('#isbn-status').textContent = 'ISBN copiato: ' + selectedBook.isbn;
    } catch (_) {
      let field = $('#isbn-fallback');
      if (!field) {
        field = document.createElement('input'); field.id = 'isbn-fallback'; field.readOnly = true;
        field.setAttribute('aria-label', 'ISBN da copiare');
        $('#isbn-status').after(field);
      }
      field.value = selectedBook.isbn; field.focus(); field.select();
      $('#isbn-status').textContent = 'Seleziona e copia questo ISBN.';
    }
  });

  const drafts = {
    sicurezza: 'Buongiorno Massimiliano, vorrei confrontarmi con te su un tema di sicurezza delle informazioni. Il contesto è…',
    libri: 'Buongiorno Massimiliano, ho scoperto i tuoi romanzi e vorrei chiederti un approfondimento su…',
    incontro: 'Buongiorno Massimiliano, vorrei proporti un incontro o una presentazione dedicata a…'
  };
  let topic = 'sicurezza';
  const message = $('#message-text');
  message.value = drafts[topic];
  document.querySelector('.topic-buttons').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-topic]');
    if (!button || !Object.hasOwn(drafts, button.dataset.topic)) return;
    drafts[topic] = message.value;
    topic = button.dataset.topic;
    message.value = drafts[topic];
    document.querySelectorAll('[data-topic]').forEach((node) => {
      const active = node === button;
      node.classList.toggle('active', active);
      node.setAttribute('aria-pressed', String(active));
    });
    $('#copy-status').textContent = '';
  });
  message.addEventListener('input', () => { $('#copy-status').textContent = ''; });
  $('#copy-message').addEventListener('click', async () => {
    if (!message.value.trim()) {
      $('#copy-status').textContent = 'Scrivi prima il messaggio da copiare.'; message.focus(); return;
    }
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(message.value);
      $('#copy-status').textContent = 'Testo copiato. Nessun messaggio è stato inviato.';
    } catch (_) {
      message.focus(); message.select();
      $('#copy-status').textContent = 'Testo selezionato: copialo con il comando del tuo dispositivo.';
    }
  });

  const motionControls = [...document.querySelectorAll('[data-motion-toggle]')];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduce.matches;
  function updateMotion() {
    document.body.classList.toggle('motion-paused', paused || reduce.matches);
    motionControls.forEach((motion) => {
      motion.disabled = reduce.matches;
      motion.setAttribute('aria-pressed', String(paused || reduce.matches));
      motion.textContent = reduce.matches ? 'Movimento ridotto' : paused ? 'Riattiva animazioni' : 'Pausa animazioni';
    });
  }
  motionControls.forEach((motion) => motion.addEventListener('click', () => { paused = !paused; updateMotion(); }));
  reduce.addEventListener?.('change', () => { paused = reduce.matches; updateMotion(); });
  updateMotion();
})();
