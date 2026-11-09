(() => {
  'use strict';

  const $ = (selector, scope = document) => scope.querySelector(selector);

  const dissolve = $('#load-dissolve');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (dissolve && !reducedMotion) {
    const mobile = window.innerWidth <= 760;
    const cols = mobile ? 7 : 12;
    const rows = mobile ? 12 : 8;
    const frag = document.createDocumentFragment();

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const tile = document.createElement('span');
        const index = row * cols + col;
        const offset = ((row * 17) + (col * 29)) % 330;
        const driftX = ((col % 3) - 1) * (mobile ? 7 : 11);
        const driftY = ((row % 3) - 1) * (mobile ? 6 : 9);

        tile.className = 'dissolve-tile';
        if (index % 11 === 0) tile.classList.add('is-ink');
        else if (index % 4 === 0) tile.classList.add('is-peri');

        tile.style.setProperty('--tile-w', (100 / cols) + 'vw');
        tile.style.setProperty('--tile-h', (100 / rows) + 'vh');
        tile.style.setProperty('--tile-x', (col * 100 / cols) + 'vw');
        tile.style.setProperty('--tile-y', (row * 100 / rows) + 'vh');
        tile.style.setProperty('--delay', offset + 'ms');
        tile.style.setProperty('--drift-x', driftX + 'px');
        tile.style.setProperty('--drift-y', driftY + 'px');

        frag.appendChild(tile);
      }
    }

    dissolve.appendChild(frag);
    window.setTimeout(() => dissolve.remove(), 1250);
  } else if (dissolve) {
    dissolve.remove();
  }

  const clock = $('#local-clock');
  const updateClock = () => {
    if (!clock) return;
    const now = new Date();
    const time = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(now);
    clock.textContent = time + ' cst';
  };
  updateClock();
  setInterval(updateClock, 1000);

  const form = $('form[name="thrillwaukee-list"]');
  if (form) {
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;

      const button = $('.submit-button', form);
      const status = $('.form-status', form);
      const original = button ? button.textContent : '';

      if (button) {
        button.disabled = true;
        button.textContent = '[ SENDING... ]';
      }
      if (status) status.textContent = '';

      try {
        const body = new URLSearchParams(new FormData(form)).toString();
        const response = await fetch('/', {
          method: 'POST',
          headers: {'Content-Type': 'application/x-www-form-urlencoded'},
          body
        });

        if (!response.ok) throw new Error('Form response ' + response.status);

        form.reset();
        if (status) status.textContent = 'ok // you are on the list.';
      } catch (error) {
        console.error(error);
        if (status) status.textContent = 'error // submission failed. try again.';
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = original;
        }
      }
    });
  }
})();
