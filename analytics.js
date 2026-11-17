(function () {
  const script = document.currentScript;
  const measurementId = script?.dataset.ga4Id || '';
  const pageType = script?.dataset.pageType || 'page';
  const analyticsTitle = script?.dataset.analyticsTitle || pageType;
  let sectionObserver;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  if (measurementId) {
    window.gtag('config', measurementId, { page_title: analyticsTitle });
    const tag = document.createElement('script');
    tag.async = true;
    tag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.appendChild(tag);
  }

  function emit(name, params) {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', name, { ...params, page_type: pageType, transport_type: 'beacon' });
  }

  function startSectionTracking() {
    if (sectionObserver || !('IntersectionObserver' in window)) return;
    const sent = new Set();
    sectionObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const sectionId = entry.target.dataset.ga4Section || entry.target.id;
        if (!entry.isIntersecting || !sectionId || sent.has(sectionId)) continue;
        sent.add(sectionId);
        emit('section_view', { page_type: pageType, section_id: sectionId });
      }
    }, { threshold: 0.15 });
    document.querySelectorAll('section[id], [data-ga4-section]').forEach(section => sectionObserver.observe(section));
  }

  function trackClick(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const control = event.target.closest?.('a,[data-ga4-event],[data-contact-method]');
    if (!control) return;
    const isLink = control.tagName === 'A';
    const href = isLink ? (control.getAttribute('href') || '') : '';
    const email = href.startsWith('mailto:');
    const telegram = /^https?:\/\/t\.me\//i.test(href);
    const vcard = /\.vcf(?:$|\?)/i.test(href);
    const contactMethod = control.dataset.contactMethod || (email ? 'email' : telegram ? 'telegram' : vcard ? 'vcard' : '');
    if (contactMethod === 'email' || contactMethod === 'telegram') {
      emit('contact_click', { contact_method: contactMethod });
      return;
    }
    if (contactMethod === 'vcard') {
      emit('vcard_click', { contact_method: contactMethod });
      return;
    }
    if (contactMethod === 'share') {
      emit('contact_share_click', { contact_method: contactMethod });
      return;
    }

    const eventName = control.dataset.ga4Event;
    if (eventName && /^[a-z][a-z0-9_]{0,39}$/.test(eventName)) {
      emit(eventName, {
        ...(control.dataset.ga4Name ? { cta_name: control.dataset.ga4Name } : {}),
        ...(control.dataset.ga4Location ? { cta_location: control.dataset.ga4Location } : {})
      });
      return;
    }

    if (isLink && /^https?:/i.test(href) && control.origin !== location.origin) {
      try { emit('outbound_click', { destination_host: new URL(href, location.href).hostname }); } catch (_) { /* Ignore malformed links. */ }
    }
  }

  function start() {
    document.addEventListener('click', trackClick, true);
    startSectionTracking();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
