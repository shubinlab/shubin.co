(function () {
  const links = document.querySelectorAll('[data-award-view]');
  if (!links.length || !('HTMLDialogElement' in window)) return;

  const dialog = document.createElement('dialog');
  dialog.className = 'simula-award-viewer';
  const isRussian = document.documentElement.lang.startsWith('ru');
  const closeLabel = isRussian ? 'Закрыть' : 'Close';
  dialog.setAttribute('aria-label', isRussian ? 'Диплом в полном размере' : 'Full-size award diploma');
  dialog.innerHTML = `<button type="button" data-award-view-close aria-label="${closeLabel}">×</button><img><p></p>`;
  document.body.appendChild(dialog);

  const image = dialog.querySelector('img');
  const caption = dialog.querySelector('p');
  const close = dialog.querySelector('[data-award-view-close]');
  let activeLink;
  let previousScroll = { x: 0, y: 0 };

  document.addEventListener('click', event => {
    const link = event.target.closest?.('[data-award-view]');
    if (!link || dialog.open || typeof dialog.showModal !== 'function') return;
    event.preventDefault();
    activeLink = link;
    previousScroll = { x: window.scrollX, y: window.scrollY };
    const preview = link.querySelector('img');
    image.src = link.href;
    image.alt = preview?.alt || '';
    caption.textContent = link.dataset.awardCaption || image.alt;
    dialog.showModal();
    try { close.focus({ preventScroll: true }); } catch (_) { close.focus(); }
    window.requestAnimationFrame(() => window.scrollTo(previousScroll.x, previousScroll.y));
  });

  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    image.removeAttribute('src');
    try { activeLink?.focus({ preventScroll: true }); } catch (_) { activeLink?.focus(); }
    window.requestAnimationFrame(() => window.scrollTo(previousScroll.x, previousScroll.y));
    activeLink = null;
  });
})();
