(() => {
  'use strict';

  const mobile = matchMedia('(max-width: 768px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const body = document.body;
  const opening = document.querySelector('.opening');
  if (!opening) return;

  const bars = document.createElement('div');
  bars.className = 'mobile-signal-bars';
  bars.setAttribute('aria-hidden', 'true');
  bars.innerHTML = '<i></i><i></i><i></i>';
  opening.appendChild(bars);

  const syncMode = () => {
    body.classList.toggle('mobile-layout', mobile.matches);
    opening.classList.toggle('mobile-live', mobile.matches && !reduced.matches);
  };

  syncMode();
  mobile.addEventListener?.('change', syncMode);
  reduced.addEventListener?.('change', syncMode);

  // Touch feedback makes the beacon feel like a physical tuner before the main gate animation takes over.
  const beacon = opening.querySelector('.scope');
  if (beacon) {
    const hit = () => {
      if (!mobile.matches) return;
      beacon.classList.remove('mobile-hit');
      requestAnimationFrame(() => beacon.classList.add('mobile-hit'));
      setTimeout(() => beacon.classList.remove('mobile-hit'), 240);
    };
    beacon.addEventListener('pointerdown', hit, { passive: true });
  }
})();
