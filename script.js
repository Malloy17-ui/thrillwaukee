(() => {
  'use strict';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  // Load the responsive/entry refinement layer without changing the existing design system.
  if (!$('link[href="entry-responsive.css"]')) {
    const sheet = document.createElement('link');
    sheet.rel = 'stylesheet';
    sheet.href = 'entry-responsive.css';
    document.head.appendChild(sheet);
  }

  const body = document.body;
  const opening = $('#opening');
  const moveSection = $('#move');
  const cursorMode = $('.cursor-mode');

  // Remove Archive from the current experience without touching unrelated functionality.
  const archive = $('#archive');
  const archiveLink = $('nav a[href="#archive"]');
  if (archive) archive.remove();
  if (archiveLink) archiveLink.remove();

  // Navigation behaves like a channel selector on small screens.
  const menu = $('.menu-toggle');
  const nav = $('#nav');
  const closeMenu = () => {
    if (!nav || !menu) return;
    nav.classList.remove('open');
    menu.setAttribute('aria-expanded', 'false');
  };
  if (menu && nav) {
    menu.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      menu.setAttribute('aria-expanded', String(open));
    });
    $$('a', nav).forEach(link => link.addEventListener('click', closeMenu));
    addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
  }

  // Opening gate: the existing radar/scope becomes the beacon that tunes into the site.
  const beacon = $('.scope');
  const tuneLink = $('.tune-link');
  let enteredThisSession = false;
  try { enteredThisSession = sessionStorage.getItem('thrillwaukee-entered') === '1'; } catch (error) {}

  const rememberEntry = () => {
    try { sessionStorage.setItem('thrillwaukee-entered', '1'); } catch (error) {}
  };

  const completeEntry = ({ scrollToMove = false } = {}) => {
    rememberEntry();
    body.classList.add('gate-complete');
    body.classList.remove('gate-pending', 'gate-exiting');
    if (cursorMode) cursorMode.textContent = 'LIVE';
    if (moveSection && scrollToMove) {
      moveSection.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    }
  };

  const enterSite = ({ scrollToMove = false } = {}) => {
    if (!opening || body.classList.contains('gate-complete')) {
      if (scrollToMove && moveSection) moveSection.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    if (body.classList.contains('gate-exiting')) return;
    body.classList.remove('gate-pending');
    body.classList.add('gate-exiting');
    if (cursorMode) cursorMode.textContent = 'LOCK';
    setTimeout(() => completeEntry({ scrollToMove }), reduced ? 120 : 820);
  };

  if (opening) {
    if (enteredThisSession) body.classList.add('gate-complete');
    else body.classList.add('gate-pending');
  }

  if (beacon && opening) {
    beacon.removeAttribute('aria-hidden');
    beacon.setAttribute('role', 'button');
    beacon.setAttribute('tabindex', '0');
    beacon.setAttribute('aria-label', 'Tune in to Thrillwaukee and open the site');
    beacon.classList.add('beacon-trigger');

    const existingLabel = $('span', beacon);
    if (existingLabel) existingLabel.textContent = 'TAP / CLICK BEACON TO TUNE IN';

    if (!$('.beacon-core', beacon)) {
      const core = document.createElement('span');
      core.className = 'beacon-core';
      core.setAttribute('aria-hidden', 'true');
      beacon.appendChild(core);
    }
    if (!$('.gate-static', opening)) {
      const staticLayer = document.createElement('div');
      staticLayer.className = 'gate-static';
      staticLayer.setAttribute('aria-hidden', 'true');
      opening.appendChild(staticLayer);
    }

    beacon.addEventListener('click', () => enterSite());
    beacon.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        enterSite();
      }
    });
  }

  if (tuneLink) {
    tuneLink.addEventListener('click', event => {
      if (!body.classList.contains('gate-complete')) {
        event.preventDefault();
        enterSite({ scrollToMove: true });
      }
    });
  }

  // Timecode intentionally starts at the brand's recurring 02:14 motif.
  const clock = $('[data-clock]');
  let seconds = 2 * 3600 + 14 * 60;
  if (clock) setInterval(() => {
    seconds = (seconds + 1) % 86400;
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const m = String(Math.floor(seconds % 3600 / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    clock.textContent = `${h}:${m}:${s}`;
  }, 1000);

  // Bounded canvas signal field: one RAF loop, fixed pool, no generated particle DOM.
  if (finePointer && !reduced) {
    const canvas = $('#signal-canvas');
    const cursor = $('.cursor');
    if (canvas && cursor) {
      document.body.classList.add('fx-ready');
      const ctx = canvas.getContext('2d', { alpha: true });
      const pointer = { x: innerWidth / 2, y: innerHeight / 2, px: innerWidth / 2, py: innerHeight / 2, vx: 0, vy: 0 };
      const particles = Array.from({ length: 36 }, () => ({ active: false }));
      let width, height, ratio, cursorX = pointer.x, cursorY = pointer.y, lastSpawn = 0;

      const resize = () => {
        ratio = Math.min(devicePixelRatio || 1, 2);
        width = innerWidth;
        height = innerHeight;
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      };
      resize();
      addEventListener('resize', resize, { passive: true });

      const spawn = (x, y, speed, count = 1) => {
        for (let n = 0; n < count; n++) {
          const p = particles.find(item => !item.active);
          if (!p) return;
          const angle = Math.random() * Math.PI * 2;
          Object.assign(p, { active: true, x, y, vx: Math.cos(angle) * (1 + speed * .035), vy: Math.sin(angle) * (1 + speed * .035), life: 1, size: 1 + Math.random() * 3, yellow: Math.random() > .73 });
        }
      };

      addEventListener('pointermove', event => {
        pointer.vx = event.clientX - pointer.px;
        pointer.vy = event.clientY - pointer.py;
        pointer.px = pointer.x = event.clientX;
        pointer.py = pointer.y = event.clientY;
        cursor.style.opacity = '1';
        const speed = Math.hypot(pointer.vx, pointer.vy);
        if (speed > 8 && performance.now() - lastSpawn > 26) {
          spawn(pointer.x, pointer.y, speed, Math.min(3, Math.ceil(speed / 22)));
          lastSpawn = performance.now();
        }
      }, { passive: true });
      addEventListener('pointerleave', () => { cursor.style.opacity = '0'; });
      addEventListener('pointerdown', () => {
        spawn(pointer.x, pointer.y, 24, 12);
        const flash = $('.flash');
        if (flash) {
          flash.classList.remove('fire');
          requestAnimationFrame(() => flash.classList.add('fire'));
        }
      });

      $$('[data-cursor]').forEach(section => {
        section.addEventListener('pointerenter', () => { if (cursorMode) cursorMode.textContent = section.dataset.cursor; });
      });

      const draw = () => {
        ctx.clearRect(0, 0, width, height);
        cursorX += (pointer.x - cursorX) * .18;
        cursorY += (pointer.y - cursorY) * .18;
        cursor.style.transform = `translate3d(${cursorX - 28}px,${cursorY - 28}px,0) rotate(${Math.max(-25, Math.min(25, pointer.vx * 1.5))}deg)`;
        particles.forEach(p => {
          if (!p.active) return;
          p.x += p.vx; p.y += p.vy; p.vx *= .95; p.vy *= .95; p.life -= .025;
          if (p.life <= 0) { p.active = false; return; }
          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.yellow ? '#ffd400' : '#8f9dff';
          ctx.fillRect(p.x, p.y, p.size * (1 + Math.abs(p.vx)), p.size);
        });
        ctx.globalAlpha = 1;
        requestAnimationFrame(draw);
      };
      requestAnimationFrame(draw);

      $$('.magnetic').forEach(item => {
        item.addEventListener('pointermove', event => {
          const rect = item.getBoundingClientRect();
          item.style.transform = `translate(${(event.clientX - rect.left - rect.width / 2) * .12}px,${(event.clientY - rect.top - rect.height / 2) * .12}px)`;
        });
        item.addEventListener('pointerleave', () => { item.style.transform = ''; });
      });

      const card = $('.credential');
      if (card) {
        card.addEventListener('pointermove', event => {
          const rect = card.getBoundingClientRect();
          const x = (event.clientX - rect.left) / rect.width;
          const y = (event.clientY - rect.top) / rect.height;
          card.style.setProperty('--ry', `${(x - .5) * 18}deg`);
          card.style.setProperty('--rx', `${(.5 - y) * 14}deg`);
          card.style.setProperty('--gx', `${x * 130 - 30}%`);
        });
        card.addEventListener('pointerleave', () => {
          card.style.setProperty('--ry', '0deg');
          card.style.setProperty('--rx', '0deg');
          card.style.setProperty('--gx', '-100%');
        });
      }
    }
  }

  // Scrambled navigation remains a restrained interaction detail.
  const glyphs = '414MKE/.:#';
  $$('[data-scramble]').forEach(link => {
    const source = link.textContent;
    link.addEventListener('pointerenter', () => {
      let frame = 0;
      clearInterval(link._scramble);
      link._scramble = setInterval(() => {
        link.textContent = [...source].map((char, i) => i < frame / 2 || char === ' ' ? char : glyphs[Math.floor(Math.random() * glyphs.length)]).join('');
        frame++;
        if (frame > source.length * 2) { clearInterval(link._scramble); link.textContent = source; }
      }, 28);
    });
  });

  // Mobile gets a tactile Black Card interaction without emulating a desktop pointer.
  const credential = $('.credential');
  if (credential) credential.addEventListener('click', event => {
    if (finePointer) return;
    event.currentTarget.style.setProperty('--ry', event.currentTarget.style.getPropertyValue('--ry') === '8deg' ? '0deg' : '8deg');
  });

  const toast = message => {
    const box = $('.transmission');
    if (!box) return;
    box.textContent = message;
    box.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => box.classList.remove('show'), 2600);
  };
  let secretCount = 0;
  const secretTrigger = $('.secret-trigger');
  if (secretTrigger) secretTrigger.addEventListener('click', () => {
    secretCount++;
    toast(secretCount < 3 ? `CHANNEL ${String(secretCount).padStart(2, '0')} UNLOCKED` : 'YOU FOUND THE AFTER-HOURS FREQUENCY');
  });
  const easter414 = $('[data-easter="414"]');
  if (easter414) easter414.addEventListener('click', () => toast('43.0389° N / 87.9065° W / SIGNAL FOUND'));
  let keys = '';
  addEventListener('keydown', event => {
    keys = (keys + event.key).slice(-3);
    if (keys === '414') toast('HOME FREQUENCY ACCEPTED');
  });

  // Netlify still discovers the static form; JS only progressively enhances it.
  const form = $('form[name="thrillwaukee-list"]');
  if (form) form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const submit = $('.submit', form);
    const status = $('.form-status', form);
    const labelNode = submit ? $('span', submit) : null;
    const label = labelNode ? labelNode.textContent : '';
    if (submit) submit.disabled = true;
    if (labelNode) labelNode.textContent = 'TRANSMITTING…';
    if (status) status.textContent = '';
    try {
      const response = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(new FormData(form)).toString() });
      if (!response.ok) throw new Error(`Netlify form response ${response.status}`);
      form.reset();
      if (status) status.textContent = 'SIGNAL RECEIVED. WATCH YOUR TEXTS.';
    } catch (error) {
      console.error(error);
      if (status) status.textContent = 'SIGNAL INTERRUPTED. TRY AGAIN.';
    } finally {
      if (submit) submit.disabled = false;
      if (labelNode) labelNode.textContent = label;
    }
  });
})();
