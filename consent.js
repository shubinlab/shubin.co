(function () {
  const script = document.currentScript;
  const measurementId = script?.dataset.ga4Id || '';
  const clarityId = script?.dataset.clarityId || '';
  const cookieDomain = script?.dataset.cookieDomain || '';
  const pageType = script?.dataset.pageType || 'page';
  const analyticsTitle = script?.dataset.analyticsTitle || pageType;
  const privacyUrl = script?.dataset.privacyUrl || '/privacy/';
  const signalsEnabled = script?.dataset.googleSignals === 'true';
  const consentTheme = script?.dataset.consentTheme || 'atom';
  const consentVersion = /^\d+$/.test(script?.dataset.consentVersion || '') ? script.dataset.consentVersion : '1';
  // Bump data-consent-version before adding a new vendor or purpose, so existing choices cannot silently enable it.
  const storageKey = `site_consent_v${consentVersion}`;
  const cookieName = storageKey;
  const denied = {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied'
  };
  function clearOldConsentRecords() {
    const version = Number(consentVersion);
    if (version < 2) return;
    const domains = [...new Set(['', cookieDomain])];
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    for (let oldVersion = 1; oldVersion < version; oldVersion++) {
      const oldName = `site_consent_v${oldVersion}`;
      for (const domain of domains) {
        document.cookie = `${oldName}=; Path=/; Max-Age=0; SameSite=Lax${domain ? `; Domain=${domain}` : ''}${secure}`;
      }
      try { localStorage.removeItem(oldName); } catch (_) { /* Storage may be blocked. */ }
    }
  }
  clearOldConsentRecords();
  let current = readConsent();
  let analyticsStarted = false;
  let sectionObserver;

  function readConsent() {
    const entry = document.cookie.split('; ').find(part => part.startsWith(`${cookieName}=`));
    let value = entry ? entry.slice(cookieName.length + 1) : null;
    if (!entry) {
      try {
        const stored = localStorage.getItem(storageKey);
        const separator = stored?.lastIndexOf('|') ?? -1;
        const expiry = separator >= 0 ? Number(stored.slice(separator + 1)) : 0;
        if (separator < 0 || !Number.isFinite(expiry) || expiry <= Date.now()) {
          localStorage.removeItem(storageKey);
          value = null;
        } else {
          value = stored.slice(0, separator);
        }
      } catch (_) { value = null; }
    }
    const match = value && new RegExp(`^v${consentVersion}\\.a([01])\\.d([01])$`).exec(decodeURIComponent(value));
    return match ? { analytics: match[1] === '1', demographics: match[2] === '1' && signalsEnabled } : null;
  }

  function writeConsent(choice) {
    const value = `v${consentVersion}.a${choice.analytics ? 1 : 0}.d${choice.analytics && choice.demographics && signalsEnabled ? 1 : 0}`;
    const expiry = Date.now() + 15552000 * 1000;
    const domain = cookieDomain ? `; Domain=${cookieDomain}` : '';
    document.cookie = `${cookieName}=${value}; Path=/; Max-Age=15552000; SameSite=Lax${domain}${location.protocol === 'https:' ? '; Secure' : ''}`;
    try { localStorage.setItem(storageKey, `${value}|${expiry}`); } catch (_) { /* Cookie remains the shared store. */ }
    return { analytics: choice.analytics, demographics: choice.analytics && choice.demographics && signalsEnabled };
  }

  function addTag(src) {
    if (document.querySelector(`script[src="${src}"]`)) return;
    const tag = document.createElement('script');
    tag.async = true;
    tag.src = src;
    document.head.appendChild(tag);
  }

  function setGoogleConsent(choice, initialize) {
    const state = {
      ...denied,
      analytics_storage: choice.analytics ? 'granted' : 'denied',
      ad_user_data: choice.demographics ? 'granted' : 'denied',
      ad_personalization: choice.demographics ? 'granted' : 'denied'
    };
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    if (initialize) window.gtag('consent', 'default', denied);
    window.gtag('consent', 'update', state);
  }

  function setClarityConsent(choice) {
    if (!clarityId) return;
    window.clarity = window.clarity || function () {
      (window.clarity.q = window.clarity.q || []).push(arguments);
    };
    window.clarity('consentv2', {
      analytics_Storage: choice.analytics ? 'granted' : 'denied',
      ad_Storage: 'denied'
    });
  }

  function startAnalytics(choice) {
    if (!choice.analytics || analyticsStarted) return;
    setGoogleConsent(choice, true);
    setClarityConsent(choice);
    if (measurementId) {
      window.gtag('js', new Date());
      window.gtag('config', measurementId, {
        page_title: analyticsTitle,
        allow_google_signals: false,
        allow_ad_personalization_signals: false
      });
      addTag(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`);
    }
    if (clarityId) addTag(`https://www.clarity.ms/tag/${encodeURIComponent(clarityId)}`);
    analyticsStarted = true;
    startSectionTracking();
  }

  function clearVendorCookies() {
    const names = document.cookie.split(';').map(part => part.trim().split('=')[0]);
    const candidates = new Set(names.filter(name => /^(_ga|_gid|_gat|_gac_|_gcl_|_clck|_clsk)/.test(name)));
    ['_ga', '_gid', '_gat', '_gcl_au', '_clck', '_clsk'].forEach(name => candidates.add(name));
    const domains = [...new Set(['', cookieDomain])];
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    for (const name of candidates) {
      for (const domain of domains) {
        const deletion = `${name}=; Path=/; Max-Age=0; SameSite=Lax${domain ? `; Domain=${domain}` : ''}${secure}`;
        document.cookie = deletion;
      }
    }
  }

  function emit(name, params) {
    if (!current?.analytics || typeof window.gtag !== 'function') return;
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

  }

  function strings() {
    const ru = /^ru(?:-|$)/i.test(document.documentElement.lang);
    const toolName = clarityId ? 'Google Analytics и Microsoft Clarity' : 'Google Analytics';
    return ru ? {
      title: 'Ваш выбор',
      intro: `${toolName} включится только с вашего разрешения.`,
      details: `GA4 автоматически получает URL страницы, заголовок и источник перехода. Контактные события передают фиксированные метки. Внешние переходы и скачивания автоматически не измеряются. Не помещайте персональные данные в URL или заголовки страниц.${clarityId ? ' Clarity записывает взаимодействия со страницей после согласия.' : ' Microsoft Clarity на этой странице сейчас не включён.'} Выбор можно изменить в любое время.`,
      required: 'Только необходимые', analytics: 'Разрешить аналитику', preferences: 'Настроить',
      analyticsLabel: 'Аналитика посещений, устройств, стран и взаимодействия со страницей',
      demographicsLabel: 'Google Signals: разрешить агрегированные возрастные, гендерные и тематические отчёты для части посетителей Google. Данные могут быть неполными.',
      save: 'Сохранить выбор', settings: 'Настройки приватности',
      sitePrivacy: 'Уведомление об аналитике', google: 'Политика конфиденциальности Google', microsoft: 'Политика конфиденциальности Microsoft',
      necessaryLabel: 'Необходимые настройки согласия (всегда включены)',
      close: 'Разрешить аналитику и закрыть'
    } : {
      title: 'Your choice',
      intro: `${clarityId ? 'Google Analytics and Microsoft Clarity' : 'Google Analytics'} runs only if you allow it.`,
      details: `GA4 automatically receives the page URL, title, and referrer. Contact events use fixed method labels. External link clicks and file downloads are not automatically measured. Keep personal data out of URLs and page titles.${clarityId ? ' Clarity records page interactions after consent.' : ' Microsoft Clarity is not currently enabled on this page.'} You can change your choice at any time.`,
      required: 'Necessary only', analytics: 'Allow analytics', preferences: 'Preferences',
      analyticsLabel: 'Visits, devices, countries, and page interactions',
      demographicsLabel: 'Google Signals: allow aggregated age, gender, and interest reports for some Google users. Coverage may be limited.',
      save: 'Save choices', settings: 'Privacy settings',
      sitePrivacy: 'Privacy and measurement notice', google: 'Google Privacy Policy', microsoft: 'Microsoft Privacy Statement',
      necessaryLabel: 'Necessary consent preference (always on)',
      close: 'Allow analytics and close'
    };
  }

  function renderPanel() {
    const text = strings();
    const root = document.createElement('aside');
    root.className = 'consent-panel';
    root.dataset.consentRoot = '';
    root.dataset.consentTheme = consentTheme;
    root.setAttribute('role', 'region');
    root.setAttribute('aria-labelledby', 'consent-title');
    root.innerHTML = `
      <div class="consent-card">
        <button type="button" class="consent-close" data-consent-action="analytics" aria-label="${text.close}" title="${text.close}">×</button>
        <div class="consent-copy">
          <h2 id="consent-title">${text.title}</h2>
          <p>${text.intro}</p>
          <details><summary>${text.preferences}</summary><p>${text.details}</p><p><a href="${privacyUrl}">${text.sitePrivacy}</a> · <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">${text.google}</a>${clarityId ? ` · <a href="https://privacy.microsoft.com/privacystatement" target="_blank" rel="noopener noreferrer">${text.microsoft}</a>` : ''}</p></details>
        </div>
        <div class="consent-actions">
          <button type="button" data-consent-action="necessary">${text.required}</button>
          <button type="button" class="consent-primary" data-consent-action="analytics">${text.analytics}</button>
          <button type="button" data-consent-action="preferences" aria-expanded="false">${text.preferences}</button>
        </div>
        <div class="consent-preferences" data-consent-preferences hidden>
          <label><input type="checkbox" checked disabled>${text.necessaryLabel}</label>
          <label><input type="checkbox" data-consent-setting="analytics" ${current?.analytics ? 'checked' : ''}>${text.analyticsLabel}</label>
          ${signalsEnabled ? `<label><input type="checkbox" data-consent-setting="demographics" ${current?.demographics ? 'checked' : ''}>${text.demographicsLabel}</label>` : ''}
          <button type="button" class="consent-primary" data-consent-action="save">${text.save}</button>
        </div>
      </div>`;
    document.body.appendChild(root);
    const manage = document.createElement('button');
    manage.className = 'consent-manage';
    manage.dataset.consentTheme = consentTheme;
    manage.type = 'button';
    manage.dataset.consentAction = 'manage';
    manage.textContent = text.settings;
    manage.setAttribute('aria-label', text.settings);
    document.body.appendChild(manage);
    root.hidden = Boolean(current);
    manage.hidden = !current;

    root.addEventListener('click', event => {
      const action = event.target.closest('[data-consent-action]')?.dataset.consentAction;
      if (action === 'necessary') save({ analytics: false, demographics: false });
      if (action === 'analytics') save({ analytics: true, demographics: false });
      if (action === 'preferences') {
        const preferences = root.querySelector('[data-consent-preferences]');
        syncPreferences(root);
        preferences.hidden = !preferences.hidden;
        event.target.setAttribute('aria-expanded', String(!preferences.hidden));
      }
      if (action === 'save') {
        save({
          analytics: root.querySelector('[data-consent-setting="analytics"]').checked,
          demographics: Boolean(root.querySelector('[data-consent-setting="demographics"]')?.checked)
        });
      }
    });
    manage.addEventListener('click', () => { syncPreferences(root); root.hidden = false; manage.hidden = true; });
    return { root, manage };
  }

  function syncPreferences(root) {
    const analytics = root.querySelector('[data-consent-setting="analytics"]');
    const demographics = root.querySelector('[data-consent-setting="demographics"]');
    if (analytics) analytics.checked = Boolean(current?.analytics);
    if (demographics) demographics.checked = Boolean(current?.demographics);
  }

  function save(choice) {
    const previous = current;
    current = writeConsent(choice);
    if (current.analytics) {
      if (analyticsStarted && previous?.analytics) {
        setGoogleConsent(current, false);
        setClarityConsent(current);
      } else {
        startAnalytics(current);
      }
    } else {
      if (previous?.analytics) {
        if (typeof window.gtag === 'function') window.gtag('consent', 'update', denied);
        if (clarityId && typeof window.clarity === 'function') {
          window.clarity('consentv2', { analytics_Storage: 'denied', ad_Storage: 'denied' });
        }
        clearVendorCookies();
        location.reload();
        return;
      }
      clearVendorCookies();
    }
    const root = document.querySelector('[data-consent-root]');
    const manage = document.querySelector('.consent-manage');
    if (root) root.hidden = true;
    if (manage) manage.hidden = false;
  }

  function synchronizeConsent() {
    const next = readConsent();
    const unchanged = Boolean(current) === Boolean(next)
      && current?.analytics === next?.analytics
      && current?.demographics === next?.demographics;
    if (unchanged) return;

    const previous = current;
    current = next;
    const root = document.querySelector('[data-consent-root]');
    const manage = document.querySelector('.consent-manage');

    if (current?.analytics) {
      if (analyticsStarted && previous?.analytics) {
        setGoogleConsent(current, false);
        setClarityConsent(current);
      } else {
        startAnalytics(current);
      }
      if (root) { syncPreferences(root); root.hidden = true; }
      if (manage) manage.hidden = false;
      return;
    }

    if (previous?.analytics) {
      if (typeof window.gtag === 'function') window.gtag('consent', 'update', denied);
      if (clarityId && typeof window.clarity === 'function') {
        window.clarity('consentv2', { analytics_Storage: 'denied', ad_Storage: 'denied' });
      }
      clearVendorCookies();
      location.reload();
      return;
    }

    clearVendorCookies();
    if (root) { syncPreferences(root); root.hidden = Boolean(current); }
    if (manage) manage.hidden = !current;
  }

  function start() {
    if (!current?.analytics) clearVendorCookies();
    document.addEventListener('click', trackClick, true);
    renderPanel();
    if (current?.analytics) startAnalytics(current);
    window.addEventListener('storage', event => {
      if (event.key === storageKey) synchronizeConsent();
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) synchronizeConsent();
    });
    const consentPoll = window.setInterval(() => {
      if (!document.hidden) synchronizeConsent();
    }, 2000);
    window.addEventListener('pagehide', () => window.clearInterval(consentPoll), { once: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
