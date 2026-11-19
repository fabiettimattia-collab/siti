(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const money = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
  const formatPrice = (cents) => money.format(cents / 100);
  const normalize = (value) => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it-IT').trim();
  const categories = [
    ['tutti', 'Tutto il menu'], ['rosse', 'Le rosse'], ['bianche', 'Le bianche'],
    ['gourmet', 'Le speciali'], ['fritte', 'Pizze fritte'], ['calzoni', 'Calzoni'],
    ['fritti', 'Fritti'], ['dolci', 'Dolci'], ['bevande', 'Bevande'],
    ['birre', 'Birre'], ['cucina', 'Cucina']
  ];
  const categoryIds = new Set(categories.map(([id]) => id));
  const items = (Array.isArray(window.MENU) ? window.MENU : []).filter((item) =>
    item && typeof item.id === 'string' && typeof item.name === 'string' &&
    categoryIds.has(item.category) && Number.isFinite(item.price) && item.price >= 0
  ).map((item) => ({ ...item, description: String(item.description || ''), cents: Math.round(item.price * 100) }));
  const itemById = new Map(items.map((item) => [item.id, item]));
  const storageKey = 'lievitamo-selection-v1';
  const basket = new Map();
  let activeCategory = 'tutti';
  let visibleCount = 8;
  let toastTimer;
  let previousFocus = null;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function toast(message) {
    const node = $('#toast');
    window.clearTimeout(toastTimer);
    const basketStatus = $('#basket-status');
    if ($('#basket-dialog')?.open && basketStatus) {
      node?.classList.remove('is-visible');
      basketStatus.textContent = message;
      return;
    }
    if (!node) return;
    node.textContent = message;
    node.classList.add('is-visible');
    toastTimer = window.setTimeout(() => node.classList.remove('is-visible'), 3500);
  }

  function loadBasket() {
    try {
      const stored = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
      if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return;
      Object.entries(stored).forEach(([id, quantity]) => {
        if (itemById.has(id) && Number.isInteger(quantity) && quantity >= 1 && quantity <= 99) {
          basket.set(id, quantity);
        }
      });
    } catch (_) {
      // La selezione funziona anche se il browser non permette l'archiviazione locale.
    }
  }

  function saveBasket() {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(basket)));
    } catch (_) {
      // In questa sessione la selezione resta disponibile in memoria.
    }
  }

  function basketTotals() {
    let quantity = 0;
    let cents = 0;
    basket.forEach((count, id) => {
      quantity += count;
      cents += itemById.get(id).cents * count;
    });
    return { quantity, cents };
  }

  function selectionText() {
    const lines = ['La mia selezione — Lievit’amo'];
    basket.forEach((quantity, id) => {
      const item = itemById.get(id);
      lines.push(quantity + ' × ' + item.name + ' — ' + formatPrice(item.cents * quantity));
    });
    lines.push('', 'Totale indicativo: ' + formatPrice(basketTotals().cents));
    lines.push('Prezzi e disponibilità da confermare al locale. Eventuali costi di consegna esclusi.');
    lines.push('Questa è una lista personale: nessun ordine è stato inviato.');
    return lines.join('\n');
  }

  function renderFilters() {
    const container = $('#category-filters');
    if (!container) return;
    const fragment = document.createDocumentFragment();
    categories.forEach(([id, label]) => {
      const button = element('button', 'filter-button' + (id === activeCategory ? ' is-active' : ''), label);
      button.type = 'button';
      button.dataset.category = id;
      button.setAttribute('aria-pressed', String(id === activeCategory));
      button.setAttribute('aria-controls', 'menu-grid');
      fragment.append(button);
    });
    container.replaceChildren(fragment);
  }

  function createMenuCard(item) {
    const card = element('article', 'menu-item');
    const copy = element('div', 'menu-item-copy');
    copy.append(element('h3', '', item.name));
    if (item.description) copy.append(element('p', '', item.description));
    const bottom = element('div', 'menu-item-bottom');
    bottom.append(element('span', 'menu-item-price', formatPrice(item.cents)));
    const button = element('button', 'add-item', '+');
    button.type = 'button';
    button.dataset.add = item.id;
    button.setAttribute('aria-label', 'Aggiungi ' + item.name);
    bottom.append(button);
    card.append(copy, bottom);
    return card;
  }

  function renderMenu(focusNewItem = false) {
    const grid = $('#menu-grid');
    if (!grid) return;
    const query = normalize($('#menu-search')?.value || '');
    const words = query.split(/\s+/).filter(Boolean);
    const filtered = items.filter((item) => {
      if (activeCategory !== 'tutti' && item.category !== activeCategory) return false;
      const haystack = normalize(item.name + ' ' + item.description);
      return words.every((word) => haystack.includes(word));
    });
    const shown = filtered.slice(0, visibleCount);
    const fragment = document.createDocumentFragment();
    shown.forEach((item) => fragment.append(createMenuCard(item)));
    if (!shown.length) {
      fragment.append(element('p', 'menu-no-results', 'Nessun piatto trovato. Prova un altro ingrediente o cambia categoria.'));
    }
    grid.replaceChildren(fragment);
    if ($('#menu-count')) {
      $('#menu-count').textContent = filtered.length
        ? shown.length + ' di ' + filtered.length + ' proposte'
        : 'Nessun risultato';
    }
    if ($('#load-more')) {
      $('#load-more').hidden = shown.length >= filtered.length;
      $('#load-more').textContent = 'Mostra altre proposte (' + Math.max(0, filtered.length - shown.length) + ')';
    }
    if (focusNewItem) {
      const firstNew = grid.children[Math.max(0, visibleCount - 8)];
      firstNew?.querySelector('button')?.focus({ preventScroll: true });
    }
  }

  function renderBasket() {
    const totals = basketTotals();
    if ($('#basket-count')) $('#basket-count').textContent = String(totals.quantity);
    if ($('#basket-total')) $('#basket-total').textContent = formatPrice(totals.cents);
    if ($('#basket-subtotal')) $('#basket-subtotal').textContent = formatPrice(totals.cents);
    $('#basket-toggle')?.setAttribute('aria-label', 'Apri la selezione: ' + totals.quantity + ' prodotti, ' + formatPrice(totals.cents));
    // Il pulsante della scelta compare solo quando c'è qualcosa dentro.
    if ($('#basket-toggle') && !dialog?.open) $('#basket-toggle').hidden = totals.quantity === 0;
    document.body.classList.toggle('has-selection', totals.quantity > 0);
    if ($('#basket-empty')) $('#basket-empty').hidden = basket.size > 0;
    if ($('#basket-copy')) $('#basket-copy').disabled = basket.size === 0;
    if ($('#basket-clear')) $('#basket-clear').disabled = basket.size === 0;
    const text = $('#order-text');
    if (text) {
      text.value = basket.size ? selectionText() : '';
      if (!basket.size) text.hidden = true;
    }
    const list = $('#basket-items');
    if (!list) return;
    const fragment = document.createDocumentFragment();
    basket.forEach((quantity, id) => {
      const item = itemById.get(id);
      const row = element('div', 'basket-item');
      const copy = element('div', 'basket-item-copy');
      copy.append(element('h3', '', item.name), element('span', 'basket-unit-price', formatPrice(item.cents) + ' cad.'));
      const controls = element('div', 'basket-item-controls');
      const minus = element('button', 'quantity-button', '−');
      minus.type = 'button';
      minus.dataset.quantity = id;
      minus.dataset.delta = '-1';
      minus.setAttribute('aria-label', quantity === 1 ? 'Rimuovi ' + item.name : 'Riduci quantità di ' + item.name);
      const count = element('span', 'basket-item-quantity', String(quantity));
      count.setAttribute('aria-label', 'Quantità: ' + quantity);
      const plus = element('button', 'quantity-button', '+');
      plus.type = 'button';
      plus.dataset.quantity = id;
      plus.dataset.delta = '1';
      plus.disabled = quantity >= 99;
      plus.setAttribute('aria-label', 'Aumenta quantità di ' + item.name);
      controls.append(minus, count, plus);
      row.append(copy, controls, element('strong', 'basket-item-price', formatPrice(item.cents * quantity)));
      fragment.append(row);
    });
    list.replaceChildren(fragment);
  }

  function changeQuantity(id, delta) {
    if (!itemById.has(id)) return;
    const current = basket.get(id) || 0;
    const next = current + delta;
    if (next > 99) {
      toast('Puoi selezionare fino a 99 pezzi per proposta.');
      return;
    }
    if (next <= 0) basket.delete(id);
    else basket.set(id, next);
    saveBasket();
    renderBasket();
    const item = itemById.get(id);
    toast(next <= 0 ? item.name + ' rimosso dalla selezione.' : item.name + ': ' + next + ' nella selezione.');
  }

  const dialog = $('#basket-dialog');
  function openBasket() {
    if (!dialog || dialog.open) return;
    previousFocus = document.activeElement;
    window.clearTimeout(toastTimer);
    $('#toast')?.classList.remove('is-visible');
    if ($('#basket-status')) $('#basket-status').textContent = '';
    if ($('#order-text')) $('#order-text').hidden = true;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else {
      dialog.setAttribute('open', '');
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
    }
    document.body.classList.add('basket-open');
    $('#basket-toggle')?.setAttribute('aria-expanded', 'true');
    $('#basket-close')?.focus();
  }

  function afterClose() {
    document.body.classList.remove('basket-open');
    $('#basket-toggle')?.setAttribute('aria-expanded', 'false');
    const toggle = $('#basket-toggle');
    if (toggle) toggle.hidden = basket.size === 0;
    if (previousFocus === toggle && toggle?.hidden) {
      // La scelta è stata svuotata: il pulsante sparisce, il fuoco torna al contenuto senza spostare la pagina.
      const main = $('main');
      main?.setAttribute('tabindex', '-1');
      main?.focus({ preventScroll: true });
    } else if (previousFocus?.isConnected && typeof previousFocus.focus === 'function') previousFocus.focus();
    previousFocus = null;
  }

  function closeBasket() {
    if (!dialog?.open) return;
    if (typeof dialog.close === 'function') dialog.close();
    else {
      dialog.removeAttribute('open');
      afterClose();
    }
  }

  $('#category-filters')?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-category]');
    if (!button || !categoryIds.has(button.dataset.category)) return;
    activeCategory = button.dataset.category;
    visibleCount = 8;
    document.querySelectorAll('#category-filters button').forEach((filter) => {
      const active = filter.dataset.category === activeCategory;
      filter.classList.toggle('is-active', active);
      filter.setAttribute('aria-pressed', String(active));
    });
    renderMenu();
  });
  $('#menu-search')?.addEventListener('input', () => {
    visibleCount = 8;
    renderMenu();
  });
  $('#load-more')?.addEventListener('click', () => {
    visibleCount += 8;
    renderMenu(true);
  });
  $('#menu-grid')?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-add]');
    if (button) changeQuantity(button.dataset.add, 1);
  });
  document.querySelectorAll('[data-feature-add]').forEach((button) => {
    button.addEventListener('click', () => {
      const item = items.find((entry) => normalize(entry.name) === normalize(button.dataset.featureAdd));
      if (item) changeQuantity(item.id, 1);
      else toast('Trovi tutte le proposte disponibili nel menu.');
    });
  });
  $('#basket-items')?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-quantity]');
    if (!button) return;
    const id = button.dataset.quantity;
    const delta = Number(button.dataset.delta);
    if (delta !== 1 && delta !== -1) return;
    const rowIndex = Array.from($('#basket-items').children).indexOf(button.closest('.basket-item'));
    changeQuantity(id, delta);
    const replacement = Array.from(document.querySelectorAll('#basket-items button[data-quantity]')).find((node) =>
      node.dataset.quantity === id && node.dataset.delta === String(delta) && !node.disabled
    );
    const fallbackRow = $('#basket-items').children[Math.max(0, rowIndex)] || $('#basket-items').lastElementChild;
    (replacement || fallbackRow?.querySelector('button') || $('#basket-close'))?.focus();
  });
  $('#basket-toggle')?.addEventListener('click', openBasket);
  $('#basket-close')?.addEventListener('click', closeBasket);
  dialog?.addEventListener('close', afterClose);
  dialog?.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeBasket();
  });
  dialog?.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeBasket();
  });
  dialog?.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || typeof dialog.showModal === 'function') return;
    const focusable = Array.from(dialog.querySelectorAll('button:not(:disabled), a[href], textarea:not([hidden]), [tabindex="0"]'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  $('#basket-clear')?.addEventListener('click', () => {
    basket.clear();
    saveBasket();
    renderBasket();
    $('#basket-close')?.focus();
    toast('Selezione svuotata.');
  });
  $('#basket-copy')?.addEventListener('click', async () => {
    if (!basket.size) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(selectionText());
      if ($('#order-text')) $('#order-text').hidden = true;
      toast('Lista copiata. Nessun ordine è stato inviato.');
    } catch (_) {
      const text = $('#order-text');
      if (text) {
        text.value = selectionText();
        text.hidden = false;
        text.focus();
        text.select();
      }
      toast('Seleziona e copia il testo della lista. Nessun ordine è stato inviato.');
    }
  });

  const navToggle = $('#nav-toggle');
  const nav = $('#main-nav');
  navToggle?.setAttribute('aria-label', 'Apri navigazione');
  function closeNav(restoreFocus = false) {
    nav?.classList.remove('is-open');
    navToggle?.setAttribute('aria-expanded', 'false');
    navToggle?.setAttribute('aria-label', 'Apri navigazione');
    if (restoreFocus) navToggle?.focus();
  }
  navToggle?.addEventListener('click', () => {
    const open = navToggle.getAttribute('aria-expanded') !== 'true';
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Chiudi navigazione' : 'Apri navigazione');
    nav?.classList.toggle('is-open', open);
  });
  nav?.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeNav();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (dialog?.open) closeBasket();
    if (navToggle?.getAttribute('aria-expanded') === 'true') closeNav(true);
  });

  const motionQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const motionToggle = $('#motion-toggle');
  let motionChosen = false;
  function setMotion(paused) {
    document.body.classList.toggle('motion-paused', paused);
    if (!motionToggle) return;
    motionToggle.setAttribute('aria-pressed', String(paused));
    motionToggle.setAttribute('aria-label', paused ? 'Attiva le animazioni' : 'Metti in pausa le animazioni');
    const label = motionToggle.querySelector('[data-motion-label]') || motionToggle;
    label.textContent = paused ? 'Attiva animazioni' : 'Pausa animazioni';
  }
  setMotion(Boolean(motionQuery?.matches));
  motionToggle?.addEventListener('click', () => {
    motionChosen = true;
    setMotion(!document.body.classList.contains('motion-paused'));
  });
  motionQuery?.addEventListener?.('change', (event) => {
    if (!motionChosen) setMotion(event.matches);
  });

  const revealNodes = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    revealNodes.forEach((node) => observer.observe(node));
  } else {
    revealNodes.forEach((node) => node.classList.add('is-visible'));
  }

  loadBasket();
  renderFilters();
  renderMenu();
  renderBasket();
})();