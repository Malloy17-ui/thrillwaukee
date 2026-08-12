(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  // Navigation behaves like a channel selector on small screens.
  const menu = $('.menu-toggle');
  const nav = $('#nav');
  const closeMenu = () => { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); };
  menu.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menu.setAttribute('aria-expanded', String(open));
  });
  $$('a', nav).forEach(link => link.addEventListener('click', closeMenu));
  addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });

  // Timecode intentionally starts at the brand's recurring 02:14 motif.
  const clock = $('[data-clock]');
  let seconds = 2 * 3600 + 14 * 60;
  setInterval(() => {
    seconds = (seconds + 1) % 86400;
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const m = String(Math.floor(seconds % 3600 / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    clock.textContent = `${h}:${m}:${s}`;
  }, 1000);

  // Bounded canvas signal field: one RAF loop, fixed pool, no generated DOM.
  if (finePointer && !reduced) {
    document.body.classList.add('fx-ready');
    const canvas = $('#signal-canvas');
    const ctx = canvas.getContext('2d', { alpha: true });
    const cursor = $('.cursor');
    const cursorMode = $('.cursor-mode');
    const pointer = { x: innerWidth / 2, y: innerHeight / 2, px: innerWidth / 2, py: innerHeight / 2, vx: 0, vy: 0, visible: false };
    const particles = Array.from({ length: 36 }, () => ({ active: false }));
    let width, height, ratio, cursorX = pointer.x, cursorY = pointer.y, lastSpawn = 0;
    const resize = () => {
      ratio = Math.min(devicePixelRatio || 1, 2); width = innerWidth; height = innerHeight;
      canvas.width = width * ratio; canvas.height = height * ratio; canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize(); addEventListener('resize', resize, { passive: true });
    const spawn = (x, y, speed, count = 1) => {
      for (let n = 0; n < count; n++) {
        const p = particles.find(item => !item.active); if (!p) return;
        const angle = Math.random() * Math.PI * 2;
        Object.assign(p, { active: true, x, y, vx: Math.cos(angle) * (1 + speed * .035), vy: Math.sin(angle) * (1 + speed * .035), life: 1, size: 1 + Math.random() * 3, yellow: Math.random() > .73 });
      }
    };
    addEventListener('pointermove', event => {
      pointer.vx = event.clientX - pointer.px; pointer.vy = event.clientY - pointer.py;
      pointer.px = pointer.x = event.clientX; pointer.py = pointer.y = event.clientY;
      pointer.visible = true; cursor.style.opacity = '1';
      const speed = Math.hypot(pointer.vx, pointer.vy);
      if (speed > 8 && performance.now() - lastSpawn > 26) { spawn(pointer.x, pointer.y, speed, Math.min(3, Math.ceil(speed / 22))); lastSpawn = performance.now(); }
    }, { passive: true });
    addEventListener('pointerleave', () => { pointer.visible = false; cursor.style.opacity = '0'; });
    addEventListener('pointerdown', () => { spawn(pointer.x, pointer.y, 24, 12); $('.flash').classList.remove('fire'); requestAnimationFrame(() => $('.flash').classList.add('fire')); });
    $$('[data-cursor]').forEach(section => {
      section.addEventListener('pointerenter', () => { cursorMode.textContent = section.dataset.cursor; });
    });
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      cursorX += (pointer.x - cursorX) * .18; cursorY += (pointer.y - cursorY) * .18;
      cursor.style.transform = `translate3d(${cursorX - 28}px,${cursorY - 28}px,0) rotate(${Math.max(-25, Math.min(25, pointer.vx * 1.5))}deg)`;
      particles.forEach(p => {
        if (!p.active) return; p.x += p.vx; p.y += p.vy; p.vx *= .95; p.vy *= .95; p.life -= .025;
        if (p.life <= 0) { p.active = false; return; }
        ctx.globalAlpha = p.life; ctx.fillStyle = p.yellow ? '#ffd400' : '#8f9dff';
        ctx.fillRect(p.x, p.y, p.size * (1 + Math.abs(p.vx)), p.size);
      });
      ctx.globalAlpha = 1; requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);

    // Magnetic controls move only their contents and always reset.
    $$('.magnetic').forEach(item => {
      item.addEventListener('pointermove', event => {
        const rect = item.getBoundingClientRect();
        item.style.transform = `translate(${(event.clientX - rect.left - rect.width / 2) * .12}px,${(event.clientY - rect.top - rect.height / 2) * .12}px)`;
      });
      item.addEventListener('pointerleave', () => { item.style.transform = ''; });
    });

    const card = $('.credential');
    card.addEventListener('pointermove', event => {
      const rect = card.getBoundingClientRect(); const x = (event.clientX - rect.left) / rect.width; const y = (event.clientY - rect.top) / rect.height;
      card.style.setProperty('--ry', `${(x - .5) * 18}deg`); card.style.setProperty('--rx', `${(.5 - y) * 14}deg`); card.style.setProperty('--gx', `${x * 130 - 30}%`);
    });
    card.addEventListener('pointerleave', () => { card.style.setProperty('--ry', '0deg'); card.style.setProperty('--rx', '0deg'); card.style.setProperty('--gx', '-100%'); });
  }

  // Scramble is restrained to navigation and resolves to the accessible source text.
  const glyphs = '414MKE/.:#';
  $$('[data-scramble]').forEach(link => {
    const source = link.textContent;
    link.addEventListener('pointerenter', () => {
      let frame = 0; clearInterval(link._scramble);
      link._scramble = setInterval(() => {
        link.textContent = [...source].map((char, i) => i < frame / 2 || char === ' ' ? char : glyphs[Math.floor(Math.random() * glyphs.length)]).join('');
        frame++; if (frame > source.length * 2) { clearInterval(link._scramble); link.textContent = source; }
      }, 28);
    });
  });

  // Scroll turns the future-photo contact sheet into a lateral film strip.
  const sheet = $('.contact-sheet');
  if (!reduced) addEventListener('scroll', () => {
    const rect = $('#archive').getBoundingClientRect();
    if (rect.top < innerHeight && rect.bottom > 0) sheet.style.setProperty('--sheet-x', `${Math.max(-sheet.scrollWidth + innerWidth, Math.min(0, -rect.top * .28))}px`);
  }, { passive: true });

  // Mobile gets a tactile Black Card tilt without keeping a pointer-only effect.
  $('.credential').addEventListener('click', event => {
    if (finePointer) return;
    event.currentTarget.style.setProperty('--ry', event.currentTarget.style.getPropertyValue('--ry') === '8deg' ? '0deg' : '8deg');
  });

  const toast = (message) => {
    const box = $('.transmission'); box.textContent = message; box.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => box.classList.remove('show'), 2600);
  };
  let secretCount = 0;
  $('.secret-trigger').addEventListener('click', () => { secretCount++; toast(secretCount < 3 ? `CHANNEL ${String(secretCount).padStart(2, '0')} UNLOCKED` : 'YOU FOUND THE AFTER-HOURS FREQUENCY'); });
  $('[data-easter="414"]').addEventListener('click', () => toast('43.0389° N / 87.9065° W / SIGNAL FOUND'));
  let keys = '';
  addEventListener('keydown', event => { keys = (keys + event.key).slice(-3); if (keys === '414') toast('HOME FREQUENCY ACCEPTED'); });

  // Netlify discovers the static form; JS enhances it without changing the fallback action.
  const form = $('form[name="thrillwaukee-list"]');
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (!form.reportValidity()) return;
    const submit = $('.submit', form); const status = $('.form-status', form); const label = $('span', submit).textContent;
    submit.disabled = true; $('span', submit).textContent = 'TRANSMITTING…'; status.textContent = '';
    try {
      const response = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(new FormData(form)).toString() });
      if (!response.ok) throw new Error(`Netlify form response ${response.status}`);
      form.reset(); status.textContent = 'SIGNAL RECEIVED. WATCH YOUR TEXTS.';
    } catch (error) {
      console.error(error); status.textContent = 'SIGNAL INTERRUPTED. TRY AGAIN.';
    } finally { submit.disabled = false; $('span', submit).textContent = label; }
  });
})();
