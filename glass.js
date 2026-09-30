/**
 * Portal 1INFO-2 — Liquid Glass (interações)
 * Fundo vivo, luz que segue o cursor, inclinação 3D, lente deslizante no dock,
 * ripple, revelação ao rolar e transições de tema/página.
 * Carregar por último: depende do topo/dock criados por core.js.
 */
(function () {
  'use strict';

  const D = document;
  const root = D.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Elementos que recebem o reflexo que segue o ponteiro
  const LIGHT_SEL = [
    '.schedule-card', '.feature-card', '.smart-card', '.bus-panel', '.legend-card', '.corujao-card',
    '.calendar-card', '.editor-panel', '.events-panel', '.table-card', '.filtered-results-area',
    '.next-event-card', '.today-banner', '.category-selector-card', '.modal-card', '.day-sheet',
    '.clock-block', '.topnav', '.lg-dock'
  ].join(',');
  const TILT_SEL = '.feature-card, .clock-block';
  const RIPPLE_SEL = [
    '.btn', '.icon-btn', '.mini-btn', '.btn-manage', '.panel-close', '.copy-btn', '.line-btn',
    '.daytype-btn', '.category-opt-btn', '.tab-btn', '.day-cell', '.feature-card', '.time-pill',
    '.theme-btn', '.filtered-item', '.today-chip', '.lg-dock-item'
  ].join(',');

  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ }
    }
  };

  /* ── 1. Fundo ambiente ─────────────────────────────────────────── */
  let par = null, cursor = null;
  function buildAmbient() {
    if (D.querySelector('.lg-ambient')) return;
    const a = D.createElement('div');
    a.className = 'lg-ambient';
    a.setAttribute('aria-hidden', 'true');
    a.innerHTML =
      '<div class="lg-par">' +
      '<i class="lg-blob b1"></i><i class="lg-blob b2"></i><i class="lg-blob b3"></i>' +
      '<i class="lg-blob b4"></i><i class="lg-blob b5"></i></div>' +
      (fine && !reduced ? '<div class="lg-cursor"></div>' : '');
    D.body.prepend(a);
    par = a.querySelector('.lg-par');
    cursor = a.querySelector('.lg-cursor');
  }

  /* ── 2. Ponteiro: luz, paralaxe, inclinação ──────────────────────
     Cursor e paralaxe são conduzidos por UM laço de rAF com suavização
     corrigida pelo tempo entre quadros (fica igual a 60, 90 ou 120 Hz).
     Antes, a paralaxe era um `transition` no CSS cujo alvo mudava a cada
     pointermove: a interpolação reiniciava sem parar e a animação engasgava. */
  let evt = null, raf = 0;
  let cx = innerWidth / 2, cy = innerHeight / 3;   // cursor suavizado
  let tx = cx, ty = cy;                            // alvo do cursor
  let parX = 0, parY = 0;                          // paralaxe suavizada (-1..1)
  let parTX = 0, parTY = 0;                        // alvo da paralaxe
  let lastT = 0, looping = false;
  let tiltEl = null;

  function resetTilt(el) {
    if (!el) return;
    el.style.removeProperty('--rx');
    el.style.removeProperty('--ry');
    el.classList.remove('lg-tilting');
  }

  function step(now) {
    const dt = lastT ? Math.min(50, now - lastT) : 16.7;
    lastT = now;
    // 1 - (1-k)^(dt/16.7): mesma sensação de suavidade em qualquer taxa de atualização
    const kC = 1 - Math.pow(1 - 0.14, dt / 16.7);
    const kP = 1 - Math.pow(1 - 0.09, dt / 16.7);

    cx += (tx - cx) * kC;
    cy += (ty - cy) * kC;
    parX += (parTX - parX) * kP;
    parY += (parTY - parY) * kP;

    if (cursor) cursor.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
    if (par) par.style.transform = 'translate3d(' + (parX * -26).toFixed(2) + 'px,' + (parY * -26).toFixed(2) + 'px,0)';

    const settled =
      Math.abs(tx - cx) < 0.3 && Math.abs(ty - cy) < 0.3 &&
      Math.abs(parTX - parX) < 0.002 && Math.abs(parTY - parY) < 0.002;
    if (settled) { looping = false; lastT = 0; }
    else requestAnimationFrame(step);
  }

  function kick() {
    if (looping) return;
    looping = true; lastT = 0;
    requestAnimationFrame(step);
  }

  function flush() {
    raf = 0;
    const e = evt;
    if (!e) return;

    if (fine && !reduced) {
      tx = e.clientX; ty = e.clientY;
      if (cursor) cursor.classList.add('on');
      parTX = (e.clientX / innerWidth) * 2 - 1;
      parTY = (e.clientY / innerHeight) * 2 - 1;
      kick();
    }

    // reflexo especular nos elementos de vidro sob o ponteiro
    let el = e.target, depth = 0;
    while (el && el !== D.body && depth < 12) {
      if (el.matches && el.matches(LIGHT_SEL)) {
        const r = el.getBoundingClientRect();
        const mx = (e.clientX - r.left).toFixed(0) + 'px';
        const my = (e.clientY - r.top).toFixed(0) + 'px';
        // só escreve quando muda de fato: escrever o mesmo valor ainda invalida o gradiente
        if (el.style.getPropertyValue('--mx') !== mx) el.style.setProperty('--mx', mx);
        if (el.style.getPropertyValue('--my') !== my) el.style.setProperty('--my', my);
      }
      el = el.parentElement; depth++;
    }

    // inclinação 3D
    if (fine && !reduced && e.pointerType !== 'touch') {
      const t = e.target.closest ? e.target.closest(TILT_SEL) : null;
      if (tiltEl && tiltEl !== t) { resetTilt(tiltEl); tiltEl = null; }
      if (t) {
        if (tiltEl !== t) { t.classList.add('lg-tilting'); tiltEl = t; }
        const r = t.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        const k = t.classList.contains('clock-block') ? 0.6 : 1;
        t.style.setProperty('--rx', ((0.5 - py) * 8 * k).toFixed(2) + 'deg');
        t.style.setProperty('--ry', ((px - 0.5) * 10 * k).toFixed(2) + 'deg');
      }
    }
  }

  function onPointer(e) {
    if (e.pointerType === 'touch' && e.type === 'pointermove') return;
    evt = e;
    if (!raf) raf = requestAnimationFrame(flush);
  }

  /* ── 3. Ripple líquido ─────────────────────────────────────────── */
  function onDown(e) {
    onPointer(e);
    if (reduced || e.button > 0) return;
    const el = e.target.closest ? e.target.closest(RIPPLE_SEL) : null;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2.3;
    const s = D.createElement('span');
    s.className = 'lg-ripple';
    s.style.width = s.style.height = size + 'px';
    s.style.left = (e.clientX - r.left - size / 2) + 'px';
    s.style.top = (e.clientY - r.top - size / 2) + 'px';
    el.classList.add('lg-rippling');
    el.appendChild(s);
    s.addEventListener('animationend', function () {
      s.remove();
      if (!el.querySelector('.lg-ripple')) el.classList.remove('lg-rippling');
    });
  }

  /* ── 4. Lente deslizante do dock ───────────────────────────────── */
  function makeLens(items, lensEl) {
    let current = null;
    function place(item, animate) {
      if (!item) return;
      if (!animate) lensEl.style.transition = 'none';
      lensEl.style.width = item.offsetWidth + 'px';
      lensEl.style.transform = 'translate3d(' + item.offsetLeft + 'px,0,0)';
      items.forEach(function (i) { i.classList.toggle('lg-on', i === item); });
      if (!animate) { void lensEl.offsetWidth; lensEl.style.transition = ''; }
      else if (item !== current && !reduced) {
        lensEl.classList.remove('lg-squish'); void lensEl.offsetWidth; lensEl.classList.add('lg-squish');
      }
      current = item;
    }
    return { place: place, get current() { return current; } };
  }

  let dockEl = null;

  function buildDock() {
    dockEl = D.querySelector('.lg-dock');
    if (!dockEl) return;
    const items = Array.prototype.slice.call(dockEl.querySelectorAll('.lg-dock-item'));
    const lensEl = dockEl.querySelector('.lg-lens');
    if (!items.length || !lensEl) return;

    let ai = items.findIndex(function (a) { return a.getAttribute('aria-current') === 'page'; });
    if (ai < 0) ai = 0;
    const prev = parseInt(store.get('lgNavIdx'), 10);
    const startIdx = isNaN(prev) || prev >= items.length ? ai : prev;
    store.set('lgNavIdx', String(ai));

    const lens = makeLens(items, lensEl);
    lens.place(items[startIdx], false);
    if (startIdx !== ai) requestAnimationFrame(function () { requestAnimationFrame(function () { lens.place(items[ai], true); }); });

    dockEl.addEventListener('click', function (e) {
      const a = e.target.closest('a');
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      e.preventDefault();
      if (a === items[ai]) return;
      lens.place(a, true);
      store.set('lgNavIdx', String(items.indexOf(a)));
      setTimeout(function () { location.href = a.href; }, reduced ? 0 : 240);
    });

    function remeasure() { lens.place(lens.current, false); }
    addEventListener('resize', remeasure);
    if (D.fonts && D.fonts.ready) D.fonts.ready.then(remeasure);
    addEventListener('load', remeasure);
  }

  /* ── 5. Rolagem: topo, dock compacto e pausa do fundo ─────────── */
  function buildScroll() {
    const topnav = D.querySelector('.topnav');
    let lastY = scrollY, ticking = false, idle = 0, paused = false;
    function step() {
      const y = scrollY;
      if (topnav) topnav.classList.toggle('lg-scrolled', y > 8);
      if (dockEl) {
        if (y > lastY + 6 && y > 120) dockEl.classList.add('lg-compact');
        else if (y < lastY - 6 || y < 60) dockEl.classList.remove('lg-compact');
      }
      lastY = y; ticking = false;
    }
    addEventListener('scroll', function () {
      // o fundo animado para enquanto rola: o blur dos cartões não precisa
      // ser refeito a cada quadro de rolagem. A pausa só é escrita uma vez
      // por rajada de scroll (antes custava 2 timers por evento).
      if (!paused) { paused = true; root.classList.add('lg-scroll'); }
      clearTimeout(idle);
      idle = setTimeout(function () { paused = false; root.classList.remove('lg-scroll'); }, 220);
      if (!ticking) { ticking = true; requestAnimationFrame(step); }
    }, { passive: true });
    step();
  }

  /* ── 6. Revelação ao rolar (só o que está abaixo da dobra) ────── */
  function buildReveal() {
    if (reduced || !('IntersectionObserver' in window)) return;
    const blocks = Array.prototype.slice.call(D.querySelectorAll('.page-shell > *, main > *, .container > *'))
      .filter(function (el) { return !el.matches('script,style,[hidden]'); });
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        const el = en.target;
        io.unobserve(el);
        el.classList.add('lg-in');
        // solta o estado de revelação só quando o movimento acabou, para o
        // elemento não voltar a ser promovido a camada durante a transição
        el.addEventListener('transitionend', function onEnd(ev) {
          if (ev.propertyName !== 'transform') return;
          el.removeEventListener('transitionend', onEnd);
          el.classList.remove('lg-pre', 'lg-in');
        });
        setTimeout(function () { el.classList.remove('lg-pre', 'lg-in'); }, 1100);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
    blocks.forEach(function (el) {
      const r = el.getBoundingClientRect();
      if (r.height === 0 || r.top < innerHeight * 0.92) return;
      el.classList.add('lg-pre');
      io.observe(el);
    });
  }

  /* ── 7. Pequenos detalhes vivos ────────────────────────────────── */
  function buildDetails() {
    // relógio: os segundos "rolam" a cada tick
    const ss = D.getElementById('clock-ss');
    const hm = D.getElementById('clock-hm');
    if (ss && !reduced) {
      new MutationObserver(function () {
        ss.classList.remove('lg-tick'); void ss.offsetWidth; ss.classList.add('lg-tick');
      }).observe(ss, { childList: true, characterData: true, subtree: true });
    }
    if (hm && !reduced) {
      let last = hm.textContent;
      new MutationObserver(function () {
        if (hm.textContent === last) return;
        last = hm.textContent;
        hm.classList.remove('lg-tick'); void hm.offsetWidth; hm.classList.add('lg-tick');
      }).observe(hm, { childList: true, characterData: true, subtree: true });
    }

    // calendário: o mês desliza ao trocar
    [['prev-month', -1], ['next-month', 1]].forEach(function (p) {
      const b = D.getElementById(p[0]);
      if (!b) return;
      b.addEventListener('click', function () {
        ['month-grid', 'month-title'].forEach(function (id) {
          const g = D.getElementById(id);
          if (!g) return;
          g.style.setProperty('--dir', String(p[1]));
          g.classList.remove('lg-flip'); void g.offsetWidth; g.classList.add('lg-flip');
          g.addEventListener('animationend', function () { g.classList.remove('lg-flip'); }, { once: true });
        });
      });
    });
  }

  /* ── 8. Tema com revelação circular (usado pelo botão do topo) ── */
  window.lgThemeTransition = function (e, apply) {
    if (!D.startViewTransition || reduced) { apply(); return; }
    const x = e.clientX || innerWidth / 2, y = e.clientY || innerHeight / 2;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.classList.add('lg-vt-theme');
    const t = D.startViewTransition(apply);
    t.ready.then(function () {
      root.animate(
        { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + r + 'px at ' + x + 'px ' + y + 'px)'] },
        { duration: 850, easing: 'cubic-bezier(.22,1,.36,1)', pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(function () {});
    const done = function () { root.classList.remove('lg-vt-theme'); };
    t.finished.then(done, done);
  };

  /* ── 9. Saída suave entre páginas (navegadores sem View Transitions) */
  function buildLeave() {
    if ('CSSViewTransitionRule' in window || reduced) return;
    D.addEventListener('click', function (e) {
      const a = e.target.closest ? e.target.closest('a[href]') : null;
      if (!a || e.defaultPrevented || a.target || a.hasAttribute('download') || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      let u;
      try { u = new URL(a.href, location.href); } catch (err) { return; }
      if (!/^(https?|file):$/.test(u.protocol)) return;
      if (u.origin !== location.origin && u.protocol !== 'file:') return;
      if (u.pathname === location.pathname) return;
      if (!/\.html?$|\/$/.test(u.pathname)) return;
      e.preventDefault();
      root.classList.add('lg-leaving');
      setTimeout(function () { location.href = a.href; }, 230);
    });
    addEventListener('pageshow', function (ev) { if (ev.persisted) root.classList.remove('lg-leaving'); });
  }

  /* ── init ──────────────────────────────────────────────────────── */
  buildAmbient();
  buildDock();
  buildScroll();
  buildReveal();
  buildDetails();
  buildLeave();
  addEventListener('pointermove', onPointer, { passive: true });
  addEventListener('pointerdown', onDown, { passive: true });
  D.addEventListener('pointerleave', function () {
    if (cursor) cursor.classList.remove('on');
    if (tiltEl) { resetTilt(tiltEl); tiltEl = null; }
  });
  addEventListener('blur', function () { if (tiltEl) { resetTilt(tiltEl); tiltEl = null; } });
  root.classList.add('lg-ready');
})();
