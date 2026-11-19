/* Dal Barone — script del sito (nessuna dipendenza) */
(function () {
  "use strict";

  var TZ = "Europe/Rome";
  // Orari: indice 0 = domenica. Chiusura alle 02:00 del giorno successivo.
  var HOURS = [
    { open: 9 * 60, close: 2 * 60 },  // domenica
    { open: 8 * 60, close: 2 * 60 },  // lunedì
    { open: 8 * 60, close: 2 * 60 },  // martedì
    { open: 8 * 60, close: 2 * 60 },  // mercoledì
    { open: 8 * 60, close: 2 * 60 },  // giovedì
    { open: 8 * 60, close: 2 * 60 },  // venerdì
    { open: 9 * 60, close: 2 * 60 }   // sabato
  ];

  function romeNow() {
    var parts = {};
    try {
      new Intl.DateTimeFormat("en-GB", {
        timeZone: TZ, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
      }).formatToParts(new Date()).forEach(function (p) { parts[p.type] = p.value; });
      var days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      return { day: days[parts.weekday], min: parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10) };
    } catch (e) {
      var d = new Date();
      return { day: d.getDay(), min: d.getHours() * 60 + d.getMinutes() };
    }
  }

  function fmt(min) {
    var h = Math.floor(min / 60) % 24, m = min % 60;
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }

  function status() {
    var now = romeNow();
    var today = HOURS[now.day];
    var yesterday = HOURS[(now.day + 6) % 7];
    // Dopo mezzanotte vale ancora l'apertura del giorno prima (fino alle 02:00)
    if (now.min < yesterday.close) {
      return { open: true, day: (now.day + 6) % 7, text: "Aperto ora", detail: "fino alle " + fmt(yesterday.close) };
    }
    if (now.min >= today.open) {
      return { open: true, day: now.day, text: "Aperto ora", detail: "fino alle " + fmt(today.close), more: " di notte" };
    }
    return { open: false, day: now.day, text: "Chiuso ora", detail: "riapre alle " + fmt(today.open) };
  }

  // --- Data in testata ("Ostia Lido, venerdì 16 ottobre 2026")
  try {
    var dateStr = new Intl.DateTimeFormat("it-IT", {
      timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric"
    }).format(new Date());
    document.querySelectorAll("[data-today]").forEach(function (el) {
      el.textContent = "Ostia Lido, " + dateStr;
    });
  } catch (e) { /* lascia il testo di default */ }

  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  // --- Stato apertura
  var st = status();
  document.querySelectorAll("[data-status]").forEach(function (el) {
    el.classList.add(st.open ? "is-open" : "is-closed");
    var t = el.querySelector(".status__txt");
    if (t) {
      t.textContent = st.text + " · " + st.detail;
      if (st.more) {
        var more = document.createElement("span");
        more.className = "status__more";
        more.textContent = st.more;
        t.appendChild(more);
      }
    }
  });
  document.querySelectorAll("[data-status-big]").forEach(function (el) {
    el.innerHTML = "";
    el.appendChild(document.createTextNode(st.text));
    var small = document.createElement("small");
    var detail = st.detail + (st.more || "");
    small.textContent = detail.charAt(0).toUpperCase() + detail.slice(1);
    el.appendChild(small);
  });
  document.querySelectorAll(".hours tr[data-day]").forEach(function (tr) {
    if (parseInt(tr.getAttribute("data-day"), 10) === st.day) tr.classList.add("is-today");
  });

  // --- Edizione del mattino (chiaro) / serale (scuro), in testata
  var root = document.documentElement;
  var darkQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  function currentTheme() {
    var t = root.getAttribute("data-theme");
    if (t === "dark" || t === "light") return t;
    return darkQuery && darkQuery.matches ? "dark" : "light";
  }
  var editionBtns = document.querySelectorAll("[data-edition]");
  function syncEdition() {
    var cur = currentTheme();
    editionBtns.forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-edition") === cur));
    });
  }
  editionBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var next = btn.getAttribute("data-edition");
      if (next === currentTheme()) return;
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("barone-theme", next); } catch (e) {}
      syncEdition();
    });
  });
  // il tema può cambiare anche dal sistema o da chi ospita la pagina
  if (darkQuery) {
    if (darkQuery.addEventListener) darkQuery.addEventListener("change", syncEdition);
    else if (darkQuery.addListener) darkQuery.addListener(syncEdition);
  }
  if ("MutationObserver" in window) {
    new MutationObserver(syncEdition).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  }
  syncEdition();

  // --- Barra di navigazione ferma in alto: compare il mini-cilindro
  var nav = document.querySelector(".nav");
  if (nav) {
    var stuckQueued = false;
    var syncStuck = function () {
      stuckQueued = false;
      var top = parseFloat(getComputedStyle(nav).top) || 0;
      root.classList.toggle("nav-stuck", nav.getBoundingClientRect().top <= top + 0.5 && window.scrollY > 0);
    };
    window.addEventListener("scroll", function () {
      if (!stuckQueued) { stuckQueued = true; window.requestAnimationFrame(syncStuck); }
    }, { passive: true });
    window.addEventListener("resize", syncStuck);
    syncStuck();
  }

  // --- Menu: ricerca e indice delle sezioni
  var search = document.getElementById("menu-search");
  if (search) {
    var wrap = search.closest(".search");
    var clear = wrap.querySelector(".search__clear");
    var sections = Array.prototype.slice.call(document.querySelectorAll(".menu-section"));
    var empty = document.querySelector(".empty");
    var chips = document.querySelectorAll(".chip");
    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Le sezioni raggiunte dall'indice si fermano sotto la barra e la ricerca, non dietro
    var tools = document.querySelector(".menu-tools");
    var navBar = document.querySelector(".nav");
    var padTop = function () {
      if (!tools || !navBar) return;
      root.style.scrollPaddingTop = (navBar.offsetHeight + tools.offsetHeight + 12) + "px";
    };
    padTop();
    window.addEventListener("resize", padTop);

    var norm = function (s) {
      return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    };
    // Trova la parola cercata solo a inizio parola ("gin" trova "Gin" e "Ginseng", non "originale")
    var find = function (text, q) {
      var re = /[a-z0-9]/;
      for (var i = text.indexOf(q); i >= 0; i = text.indexOf(q, i + 1)) {
        if (i === 0 || !re.test(text.charAt(i - 1))) return i;
      }
      return -1;
    };
    // Memorizza il testo originale per evidenziare i risultati
    document.querySelectorAll("[data-hl]").forEach(function (el) { el.setAttribute("data-raw", el.textContent); });

    function highlight(el, q) {
      var raw = el.getAttribute("data-raw");
      if (!q) { el.textContent = raw; return; }
      var n = norm(raw), i = find(n, q);
      if (i < 0) { el.textContent = raw; return; }
      el.textContent = "";
      el.appendChild(document.createTextNode(raw.slice(0, i)));
      var m = document.createElement("mark");
      m.textContent = raw.slice(i, i + q.length);
      el.appendChild(m);
      el.appendChild(document.createTextNode(raw.slice(i + q.length)));
    }

    function apply() {
      var q = norm(search.value.trim());
      wrap.classList.toggle("has-value", q.length > 0);
      var any = false;
      sections.forEach(function (sec) {
        var secHit = false;
        var secText = norm(sec.getAttribute("data-title"));
        var sectionMatches = q && find(secText, q) >= 0;
        sec.querySelectorAll(".menu-group, .spirits__group").forEach(function (g) {
          var groupMatches = sectionMatches || (q && find(norm(g.getAttribute("data-title")), q) >= 0);
          var gHit = false;
          g.querySelectorAll("[data-search]").forEach(function (it) {
            var hit = !q || groupMatches || find(norm(it.getAttribute("data-search")), q) >= 0;
            it.classList.toggle("is-hidden", !hit);
            it.querySelectorAll("[data-hl]").forEach(function (el) { highlight(el, groupMatches ? "" : q); });
            if (hit) gHit = true;
          });
          g.classList.toggle("is-hidden", !gHit);
          if (gHit) secHit = true;
        });
        sec.classList.toggle("is-hidden", !secHit);
        var chip = document.querySelector('.chip[href="#' + sec.id + '"]');
        if (chip) chip.classList.toggle("is-hidden", !secHit);
        if (secHit) any = true;
      });
      if (empty) empty.classList.toggle("is-visible", !any);
    }
    search.addEventListener("input", apply);
    clear.addEventListener("click", function () { search.value = ""; apply(); search.focus(); });

    // Evidenzia la sezione visibile nell'indice
    if ("IntersectionObserver" in window) {
      var chipFor = {};
      chips.forEach(function (c) { chipFor[c.getAttribute("href").slice(1)] = c; });
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          chips.forEach(function (c) { c.classList.remove("is-active"); });
          var c = chipFor[e.target.id];
          if (c) {
            c.classList.add("is-active");
            var bar = c.parentNode;
            var left = c.offsetLeft - bar.clientWidth / 2 + c.clientWidth / 2;
            bar.scrollTo({ left: left, behavior: reduceMotion ? "auto" : "smooth" });
          }
        });
      }, { rootMargin: "-30% 0px -60% 0px" });
      sections.forEach(function (s) { io.observe(s); });
    }
  }

  // --- Copia il numero di telefono (i link tel: non funzionano ovunque)
  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    var label = btn.textContent;
    btn.addEventListener("click", function () {
      var value = btn.getAttribute("data-copy");
      var done = function (msg) {
        btn.textContent = msg;
        setTimeout(function () { btn.textContent = label; }, 2000);
      };
      var selectText = function () {
        var src = btn.closest(".card") && btn.closest(".card").querySelector("[data-copy-source]");
        if (src && window.getSelection) {
          var r = document.createRange();
          r.selectNodeContents(src);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(r);
        }
        done("Selezionato: copia con Ctrl+C");
      };
      try {
        navigator.clipboard.writeText(value).then(function () { done("Copiato"); }, selectText);
      } catch (e) { selectText(); }
    });
  });

  // --- Galleria con lightbox
  var dlg = document.getElementById("lightbox");
  if (dlg && typeof dlg.showModal === "function") {
    var shots = Array.prototype.slice.call(document.querySelectorAll("[data-lightbox]"));
    var img = dlg.querySelector("img"), cap = dlg.querySelector("p"), idx = 0;
    function show(i) {
      idx = (i + shots.length) % shots.length;
      var b = shots[idx];
      img.src = b.getAttribute("data-lightbox");
      img.alt = b.getAttribute("data-alt") || "";
      cap.textContent = b.getAttribute("data-alt") || "";
    }
    shots.forEach(function (b, i) {
      b.addEventListener("click", function () { show(i); dlg.showModal(); });
    });
    dlg.querySelector(".lightbox__close").addEventListener("click", function () { dlg.close(); });
    dlg.querySelector(".lightbox__nav--prev").addEventListener("click", function () { show(idx - 1); });
    dlg.querySelector(".lightbox__nav--next").addEventListener("click", function () { show(idx + 1); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") show(idx - 1);
      if (e.key === "ArrowRight") show(idx + 1);
    });
  }
})();
