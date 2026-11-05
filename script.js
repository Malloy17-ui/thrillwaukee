(() => {
  'use strict';

  const $ = (selector, scope = document) => scope.querySelector(selector);

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
