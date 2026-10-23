/* Optional first-party privacy/advertising integration. Klaro is BSD-3-Clause. */
(() => {
  'use strict';
  if (window.SitePrivacy || location.protocol === 'file:') return;
  const entry = document.currentScript;
  const base = new URL('./', entry.src);
  const profile = entry.dataset.siteProfile || 'game';
  document.documentElement.dataset.siteProfile = profile;
  if (profile === 'privacy') {
    const requested = new URL(location.href).searchParams.get('lang');
    let saved;
    try { saved = localStorage.getItem('lang'); } catch { /* Browser storage can be unavailable. */ }
    let savedTheme;
    try { savedTheme = localStorage.getItem('theme'); } catch { /* Use the requested or system theme. */ }
    const requestedTheme = new URL(location.href).searchParams.get('theme');
    const theme = [requestedTheme, savedTheme].find(value => ['dark', 'light'].includes(value)) || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
    const cookie = document.cookie.match(/(?:^|; )lang=(it|en)(?:;|$)/)?.[1];
    document.documentElement.lang = [requested, saved, cookie].find(value => ['it', 'en'].includes(value)) || (navigator.language.startsWith('it') ? 'it' : 'en');
  }
  const publisher = 'ca-pub-8896739816580918';
  const slot = '5611479310';
  const production = location.hostname === 'giacomel.info' || location.hostname.endsWith('.giacomel.info');
  // Live serving stays off until the owner's Google privacy setup is complete.
  const liveAdsEnabled = false;
  const consent = { advertising: false, 'google-fonts': false, 'google-ai': false, analytics: false };

  // Google Consent Mode v2 (Advanced Mode): define dataLayer and default consent signals before tag execution
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  if (typeof window.gtag !== 'function') window.gtag = gtag;
  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    analytics_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500
  });
  window.gtag('set', 'ads_data_redaction', true);

  function syncGoogleConsent() {
    if (typeof window.gtag !== 'function') return;
    const adAllowed = Boolean(consent.advertising);
    const analyticsAllowed = Boolean(consent.analytics);
    window.gtag('consent', 'update', {
      ad_storage: adAllowed ? 'granted' : 'denied',
      analytics_storage: analyticsAllowed ? 'granted' : 'denied',
      ad_user_data: adAllowed ? 'granted' : 'denied',
      ad_personalization: adAllowed ? 'granted' : 'denied'
    });
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({
        event: 'klaro_consent_update',
        consents: { ...consent },
        consent_mode_v2: {
          ad_storage: adAllowed ? 'granted' : 'denied',
          analytics_storage: analyticsAllowed ? 'granted' : 'denied',
          ad_user_data: adAllowed ? 'granted' : 'denied',
          ad_personalization: adAllowed ? 'granted' : 'denied'
        }
      });
    }
  }

  let manager, config, googlePromise, opener, modalWasOpen = false, consentReady = false, started = false;
  const initialized = new WeakSet();
  const boundChoices = new WeakSet();
  const theme = () => document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  const policyUrl = () => '/privacy.html?lang=' + lang() + '&theme=' + theme();
  const lang = () => document.documentElement.lang.toLowerCase().startsWith('it') ? 'it' : 'en';
  const text = {
    it: {
      privacy: 'Privacy', choices: 'Preferenze privacy', ad: 'Pubblicità',
      home: 'Torna alla homepage', navigation: 'Navigazione Giacomel.info', languages: 'Lingua',
      notice: 'Scegli se attivare servizi facoltativi. Puoi continuare senza: i progressi restano salvati.',
      description: 'Scegli solo ciò che ti serve. Per i minori decide un genitore o tutore; il pannello non verifica età o identità.',
      decline: 'Rifiuta facoltativi', accept: 'Salva scelte', save: 'Salva scelte',
      ads: 'Pubblicità Google (Consent Mode v2)', adsBody: 'Annunci Google con Consent Mode v2 avanzato. Segnali ad_storage, ad_user_data e ad_personalization negati di default e aggiornati su tua scelta.',
      fonts: 'Caratteri Google', fontsBody: 'Caratteri scaricati da Google. In alternativa, quelli del dispositivo.',
      ai: 'Funzioni Google AI online', aiBody: 'Pronunce e suggerimenti online. Non inviare dati personali; restano le alternative locali.',
      analytics: 'Statistiche di utilizzo', analyticsBody: 'Statistiche facoltative con analytics_storage gestito via Consent Mode v2 dove presente.',
    },
    en: {
      privacy: 'Privacy', choices: 'Privacy preferences', ad: 'Advertisement',
      home: 'Back to homepage', navigation: 'Giacomel.info navigation', languages: 'Language',
      notice: 'Choose whether to enable optional services. You can continue without them; saved progress stays.',
      description: 'Choose only what you need. A parent or guardian decides for children; this panel does not verify age or identity.',
      decline: 'Decline optional', accept: 'Save choices', save: 'Save choices',
      ads: 'Google advertising (Consent Mode v2)', adsBody: 'Google ads with advanced Consent Mode v2. Consent signals ad_storage, ad_user_data and ad_personalization denied by default and updated upon choice.',
      fonts: 'Google fonts', fontsBody: 'Fonts downloaded from Google. Device fonts are the alternative.',
      ai: 'Online Google AI features', aiBody: 'Online pronunciations and suggestions. Do not send personal data; local alternatives remain.',
      analytics: 'Usage statistics', analyticsBody: 'Optional statistics with analytics_storage managed via Consent Mode v2 where present.',
    },
  };
  const api = {
    version: '1.2.0',
    get ready() { return ready; },
    hasConsent: name => consentReady && consent[name] === true,
    open: async (source = document.activeElement) => { opener = source; await api.ready; window.klaro.show(config, true); },
    setLanguage,
    getStatus: () => ({ consentReady, liveAdsEnabled, production, consentMode: 'v2-advanced', consent: { ...consent } }),
    getConsentMode: () => ({
      version: 'v2',
      mode: 'advanced',
      default: {
        ad_storage: 'denied',
        analytics_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        wait_for_update: 500
      },
      current: {
        ad_storage: consent.advertising ? 'granted' : 'denied',
        analytics_storage: consent.analytics ? 'granted' : 'denied',
        ad_user_data: consent.advertising ? 'granted' : 'denied',
        ad_personalization: consent.advertising ? 'granted' : 'denied'
      }
    }),
    // Dependency injection is used by the local regression fixture, never for live impressions.
    mountAd: (target, options = {}) => mountAd(target, options),
  };
  window.SitePrivacy = Object.freeze(api);

  function setLanguage(language) {
    if (!['it', 'en'].includes(language)) throw new TypeError('Unsupported language');
    if (profile === 'game' && window.__gameKit?.settings) window.__gameKit.settings.update({ language });
    else {
      document.documentElement.lang = language;
      if (profile === 'privacy') {
        try { localStorage.setItem('lang', language); } catch { document.documentElement.dataset.languageStorage = 'unavailable'; }
        document.cookie = 'lang=' + language + '; path=/; max-age=31536000; samesite=lax' + (location.protocol === 'https:' ? '; secure' : '');
        const url = new URL(location.href); url.searchParams.set('lang', language); history.replaceState(null, '', url);
      }
      window.dispatchEvent(new CustomEvent('sitelanguagechange', { detail: { language } }));
    }
  }

  function publish(name, value) {
    const previous = consent[name];
    consent[name] = Boolean(value);
    const key = 'privacy' + name.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join('');
    document.documentElement.dataset[key] = value ? 'allowed' : 'denied';
    window.dispatchEvent(new CustomEvent('siteprivacychange', { detail: { service: name, allowed: Boolean(value) } }));
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({
        event: 'klaro-' + name + '-' + (value ? 'accepted' : 'declined'),
        service: name,
        allowed: Boolean(value)
      });
    }
    if (name === 'advertising' || name === 'analytics') syncGoogleConsent();
    if (name === 'google-fonts') {
      for (const link of document.querySelectorAll('link[data-privacy-font-href]')) {
        if (value) link.href = link.dataset.privacyFontHref;
        else link.removeAttribute('href');
      }
    }
    if (name === 'advertising' && previous && !value && document.getElementById('giacomel-google-ads')) {
      // Klaro saves the choice in the current task; reload removes already loaded provider code.
      setTimeout(() => location.reload(), 0);
    }
    if (name === 'advertising' && value && liveAdsEnabled && production) showLiveAd();
  }

  function loadScript(id, url, attributes = {}) {
    return new Promise((resolve, reject) => {
      const existing = document.getElementById(id);
      if (existing?.dataset.loaded === 'true') { resolve(existing); return; }
      const script = existing || document.createElement('script');
      const timeout = setTimeout(() => finish(new Error('Script load timeout: ' + id)), 15000);
      const loaded = () => finish();
      const failed = () => finish(new Error('Script unavailable: ' + id));
      function finish(error) {
        clearTimeout(timeout); script.removeEventListener('load', loaded); script.removeEventListener('error', failed);
        if (error) { if (!existing) script.remove(); reject(error); }
        else { script.dataset.loaded = 'true'; resolve(script); }
      }
      script.addEventListener('load', loaded, { once: true }); script.addEventListener('error', failed, { once: true });
      if (!existing) {
        script.id = id; script.src = url; script.async = true;
        for (const [key, value] of Object.entries(attributes)) script.setAttribute(key, value);
        document.head.appendChild(script);
      }
    });
  }

  function loadGoogle() {
    googlePromise ||= loadScript('giacomel-google-ads', 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + publisher, { crossorigin: 'anonymous' });
    return googlePromise;
  }

  function mountAd(target, { enabled = liveAdsEnabled && production, hasConsent = () => api.hasConsent('advertising'), load = loadGoogle, test = false } = {}) {
    if (!enabled || !hasConsent() || !target?.isConnected || target.querySelector('[data-site-ad]')) return null;
    const aside = document.createElement('aside'); aside.className = 'site-ad'; aside.dataset.siteAd = '';
    aside.setAttribute('aria-label', text[lang()].ad);
    const label = document.createElement('p'); label.className = 'site-ad-label'; label.textContent = text[lang()].ad;
    const ins = document.createElement('ins'); ins.className = 'adsbygoogle'; ins.style.display = 'block'; ins.style.width = '100%';
    ins.dataset.adClient = publisher; ins.dataset.adSlot = slot; ins.dataset.adFormat = 'auto'; ins.dataset.fullWidthResponsive = 'true'; ins.dataset.tagForAgeTreatment = '1';
    if (test) ins.dataset.adtest = 'on';
    aside.append(label, ins); target.appendChild(aside);
    const collapse = () => { aside.hidden = true; };
    const observer = new MutationObserver(() => { if (ins.dataset.adStatus === 'unfilled') { collapse(); observer.disconnect(); } });
    observer.observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] });
    Promise.resolve().then(load).then(() => {
      if (!hasConsent() || !ins.isConnected) { observer.disconnect(); aside.remove(); return; }
      if (initialized.has(ins) || ins.getBoundingClientRect().width <= 0) { collapse(); observer.disconnect(); return; }
      initialized.add(ins);
      const queue = window.adsbygoogle ||= [];
      queue.push({});
      aside.dataset.state = 'requested';
    }).catch(error => { aside.dataset.error = error.message; collapse(); observer.disconnect(); });
    return aside;
  }

  function showLiveAd() {
    if (location.pathname.endsWith('/privacy.html')) return;
    const target = document.querySelector('main');
    if (target) mountAd(target);
  }

  function translate() {
    if (config) {
      config.lang = lang();
      for (const language of ['it', 'en']) config.translations[language].privacyPolicyUrl = '/privacy.html?lang=' + language + '&theme=' + theme();
      if (document.querySelector('#klaro .cm-modal')) window.klaro?.show(config, true);
      else window.klaro?.render(config);
    }
    for (const link of document.querySelectorAll('[data-site-privacy-link]')) { link.textContent = text[lang()].privacy; link.href = policyUrl(); }
    for (const button of document.querySelectorAll('[data-site-privacy-open]')) button.textContent = text[lang()].choices;
    for (const link of document.querySelectorAll('[data-site-home]')) link.setAttribute('aria-label', text[lang()].home);
    for (const nav of document.querySelectorAll('[data-site-nav]')) nav.setAttribute('aria-label', text[lang()].navigation);
    for (const group of document.querySelectorAll('[data-site-languages]')) group.setAttribute('aria-label', text[lang()].languages);
    for (const button of document.querySelectorAll('[data-site-language]')) {
      const selected = button.dataset.siteLanguage === lang();
      button.setAttribute('aria-pressed', String(selected));
      button.setAttribute('aria-label', button.dataset.siteLanguage === 'it' ? (selected ? 'Italiano' : 'Switch to Italian') : (selected ? 'English' : 'Passa all’inglese'));
    }
    for (const section of document.querySelectorAll('[data-site-locale]')) section.hidden = section.dataset.siteLocale !== lang();
    const policyTitle = document.querySelector('[data-site-locale="' + lang() + '"] h1');
    if (policyTitle) document.title = policyTitle.textContent + ' — Giacomel.info';
    for (const label of document.querySelectorAll('.site-ad-label')) label.textContent = text[lang()].ad;
    for (const aside of document.querySelectorAll('[data-site-ad]')) aside.setAttribute('aria-label', text[lang()].ad);
  }

  function makeChoices() {
    const block = document.createElement('div'); block.className = 'site-privacy-links';
    const link = document.createElement('a'); link.href = policyUrl(); link.dataset.sitePrivacyLink = ''; link.textContent = text[lang()].privacy;
    const button = document.createElement('button'); button.type = 'button'; button.dataset.sitePrivacyOpen = ''; button.textContent = text[lang()].choices;
    bindChoices(button);
    block.append(link, button); return block;
  }

  function bindChoices(button) {
    if (boundChoices.has(button)) return;
    boundChoices.add(button);
    button.addEventListener('click', async () => {
      const controller = window.__gameKit;
      controller?.lifecycle?.pause('privacy-consent');
      try {
        const dialog = controller?.dialog?.element;
        // Native close restores the settings opener in a later task. Wait for it
        // before Klaro takes focus, otherwise keyboard input escapes the modal.
        if (dialog?.open) await new Promise(resolve => {
          dialog.addEventListener('close', resolve, { once: true });
          controller.dialog.close();
        });
        await api.open(button);
      } catch (error) {
        document.documentElement.dataset.privacyError = error.message;
        controller?.lifecycle?.resume('privacy-consent'); location.href = policyUrl();
      }
    });
  }

  function installLinks() {
    for (const button of document.querySelectorAll('.site-policy-action')) button.addEventListener('click', () => {
      void api.open(button).catch(() => { button.textContent = lang() === 'it' ? 'Preferenze non disponibili' : 'Preferences unavailable'; });
    });
    const homeLink = (image = false) => {
      const link = document.createElement('a'); link.href = 'https://www.giacomel.info/'; link.dataset.siteHome = '';
      if (image) {
        const icon = document.createElement('img'); icon.src = new URL('favicon.svg', base); icon.width = 32; icon.height = 32; icon.alt = ''; link.appendChild(icon);
      } else link.textContent = 'giacomel.info';
      return link;
    };
    let header = document.querySelector('[data-site-header]');
    if (!header) {
    header = document.createElement('header'); header.className = 'site-header'; header.dataset.siteHeader = '';
    const nav = document.createElement('nav'); nav.className = 'site-shell-inner'; nav.dataset.siteNav = '';
    const languages = document.createElement('div'); languages.className = 'site-languages'; languages.setAttribute('role', 'group'); languages.dataset.siteLanguages = '';
    for (const language of ['it', 'en']) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.siteLanguage = language; button.lang = language; button.textContent = language.toUpperCase();
      languages.appendChild(button);
    }
    nav.append(homeLink(true), languages); header.appendChild(nav); document.body.prepend(header);
    }
    for (const button of header.querySelectorAll('[data-site-language]')) button.addEventListener('click', () => setLanguage(button.dataset.siteLanguage));
    let footer = document.querySelector('[data-site-footer]');
    if (!footer) {
    footer = document.createElement('footer'); footer.className = 'site-footer'; footer.dataset.siteFooter = '';
    const inner = document.createElement('nav'); inner.className = 'site-shell-inner'; inner.dataset.siteNav = ''; inner.append(homeLink(), makeChoices()); footer.appendChild(inner); document.body.appendChild(footer);
    } else for (const button of footer.querySelectorAll('[data-site-privacy-open]')) bindChoices(button);
    translate();
    let attached = false;
    const attach = () => {
      const dialog = window.__gameKit?.dialog?.element;
      if (dialog && !attached) { dialog.appendChild(makeChoices()); attached = true; return true; }
      return false;
    };
    if (!attach()) {
      const observer = new MutationObserver(() => { if (attach()) observer.disconnect(); });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => observer.disconnect(), 15000);
    }
    const syncFullscreen = () => {
      const active = Boolean(document.fullscreenElement || document.querySelector('.ag-fullscreen'));
      document.documentElement.classList.toggle('fullscreen-mode', active);
      document.documentElement.classList.toggle('ag-fullscreen-active', active);
      document.body?.classList?.toggle('fullscreen-mode', active);
      document.body?.classList?.toggle('ag-fullscreen-active', active);
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);
    syncFullscreen();
  }

  function translations(language) {
    const t = text[language];
    return { privacyPolicyUrl: '/privacy.html?lang=' + language + '&theme=' + theme(), ok: language === 'it' ? 'Consenti facoltativi' : 'Allow optional', acceptSelected: t.accept, acceptAll: language === 'it' ? 'Consenti tutti' : 'Allow all', decline: t.decline, save: t.save,
      consentNotice: { description: t.notice, learnMore: t.choices }, consentModal: { title: t.choices, description: t.description },
      purposes: { advertising: { title: t.ads, description: t.adsBody }, styling: { title: t.fonts, description: t.fontsBody }, ai: { title: t.ai, description: t.aiBody }, analytics: { title: t.analytics, description: t.analyticsBody } } };
  }

  async function start() {
    if (started) return; started = true;
    const sheet = document.createElement('link'); sheet.rel = 'stylesheet'; sheet.href = new URL('vendor/klaro-0.7.21/klaro.min.css', base); document.head.appendChild(sheet);
    const ownUrl = new URL('site.css', base);
    if (!document.body.hasAttribute('data-site-shell-styled') && ![...document.querySelectorAll('link[rel=stylesheet]')].some(link => link.href === ownUrl.href)) {
      const own = document.createElement('link'); own.rel = 'stylesheet'; own.href = ownUrl; document.head.appendChild(own);
    }
    config = { elementID: 'klaro', storageMethod: 'cookie', storageName: 'giacomel_privacy_v1', cookieExpiresAfterDays: 180,
      ...(production ? { cookieDomain: '.giacomel.info' } : {}), default: false, mustConsent: false, acceptAll: false, hideDeclineAll: false, hideLearnMore: false, groupByPurpose: false, hideToggleAll: true,
      htmlTexts: false, lang: lang(), translations: { it: translations('it'), en: translations('en') },
      services: [ ['advertising', 'advertising', 'ads', 'adsBody'], ['google-fonts', 'styling', 'fonts', 'fontsBody'], ['google-ai', 'ai', 'ai', 'aiBody'], ['analytics', 'analytics', 'analytics', 'analyticsBody'] ].map(([name, purpose, title, body]) => ({ name, purposes: [purpose], default: false, required: false, optOut: false,
        translations: { it: { title: text.it[title], description: text.it[body] }, en: { title: text.en[title], description: text.en[body] } }, callback: value => publish(name, value) })),
    };
    window.giacomelPrivacyConfig = config;
    installLinks();
    await loadScript('giacomel-klaro', new URL('vendor/klaro-0.7.21/klaro-no-css.js', base), { 'data-klaro-config': 'giacomelPrivacyConfig' });
    manager = window.klaro.getManager(config); consentReady = true;
    for (const name of Object.keys(consent)) publish(name, manager.confirmed && manager.getConsent(name));
    new MutationObserver(translate).observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'class'] });
    const privacyRoot = document.getElementById('klaro');
    if (privacyRoot) {
      privacyRoot.addEventListener('keydown', event => {
        const modal = privacyRoot.querySelector('.cm-modal');
        if (!modal) return;
        if (event.key === 'Escape') { event.preventDefault(); modal.querySelector('button.hide')?.click(); return; }
        if (event.key !== 'Tab') return;
        const controls = [...modal.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled)')].filter(node => node.getBoundingClientRect().width > 0);
        if (!controls.length) return;
        const current = controls.indexOf(document.activeElement);
        const next = current < 0 ? 0 : (current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
        event.preventDefault(); controls[next].focus();
      });
      new MutationObserver(() => {
      const modal = privacyRoot.querySelector('.cm-modal');
      const open = Boolean(modal && getComputedStyle(modal).display !== 'none');
      // Klaro 0.7's flat service list omits the visible flag used for tabIndex.
      // Keep the real native checkboxes keyboard reachable without forking Klaro.
      if (open) for (const input of modal.querySelectorAll('input:not(:disabled)')) input.tabIndex = 0;
      const controller = window.__gameKit?.lifecycle;
      if (controller) { if (open) controller.pause('privacy-consent'); else controller.resume('privacy-consent'); }
      if (modalWasOpen && !open) {
        const target = opener?.isConnected && opener.getBoundingClientRect().width > 0 ? opener : (window.__gameKit?.settingsButton || document.querySelector('[data-site-language][aria-pressed=true]'));
        target?.focus();
      }
      modalWasOpen = open;
    }).observe(privacyRoot, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    }
    // The host may finish restoring its saved language while Klaro is loading.
    translate();
    return api;
  }
  // The frozen public API exposes the promise through a getter from the outset.
  const ready = document.readyState === 'loading' ? new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true })).then(start) : start();
  // Avoid unhandled rejections when a content blocker prevents the consent UI; optional services remain denied.
  ready.catch(() => { document.documentElement.dataset.privacyStatus = 'unavailable'; });
  Object.defineProperty(window, '__sitePrivacyReady', { value: ready });
})();
