/**
 * Runtime i18n for Zen Internet.
 *
 * Translations live in _locales/<locale>/messages.json using the standard
 * WebExtension message format, so adding a language only requires a new
 * folder plus an entry in _locales/languages.json.
 */
(function () {
  const DEFAULT_LOCALE = "en";
  const STORAGE_KEY = "uiLanguage";
  const AUTO = "auto";
  const LANGUAGE_INDEX = "_locales/languages.json";

  let activeLocale = DEFAULT_LOCALE;
  let messages = {};
  let initPromise = null;
  const messageCache = new Map();

  function normalizeLocaleId(raw) {
    if (!raw || typeof raw !== "string") return "";
    const parts = raw.replace(/_/g, "-").split("-").filter(Boolean);
    if (!parts.length) return "";
    const language = parts[0].toLowerCase();
    if (parts.length === 1) return language;
    return `${language}_${parts[1].toUpperCase()}`;
  }

  function localeCandidates(raw) {
    const normalized = normalizeLocaleId(raw);
    const list = [];
    if (normalized) list.push(normalized);
    const base = normalized.split("_")[0];
    if (base && base !== normalized) list.push(base);
    if (base === "zh") list.push("zh_CN");
    list.push(DEFAULT_LOCALE);
    return [...new Set(list.filter(Boolean))];
  }

  async function loadMessages(localeId) {
    if (!localeId) return null;
    if (messageCache.has(localeId)) return messageCache.get(localeId);

    const request = (async () => {
      try {
        const url = browser.runtime.getURL(`_locales/${localeId}/messages.json`);
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        return data && typeof data === "object" ? data : null;
      } catch (error) {
        return null;
      }
    })();

    messageCache.set(localeId, request);
    return request;
  }

  async function getPreference() {
    try {
      const data = await browser.storage.local.get(STORAGE_KEY);
      return data[STORAGE_KEY] || AUTO;
    } catch (error) {
      return AUTO;
    }
  }

  function getBrowserLocale() {
    try {
      if (browser.i18n && typeof browser.i18n.getUILanguage === "function") {
        const locale = browser.i18n.getUILanguage();
        if (locale) return locale;
      }
    } catch (error) {}
    try {
      if (typeof navigator !== "undefined" && navigator.language) {
        return navigator.language;
      }
    } catch (error) {}
    return DEFAULT_LOCALE;
  }

  function init() {
    if (initPromise) return initPromise;

    initPromise = (async () => {
      const preference = await getPreference();
      const requested =
        preference && preference !== AUTO ? preference : getBrowserLocale();

      for (const candidate of localeCandidates(requested)) {
        const dictionary = await loadMessages(candidate);
        if (dictionary && Object.keys(dictionary).length) {
          messages = dictionary;
          activeLocale = candidate;
          return activeLocale;
        }
      }

      messages = (await loadMessages(DEFAULT_LOCALE)) || {};
      activeLocale = DEFAULT_LOCALE;
      return activeLocale;
    })();

    return initPromise;
  }

  function formatMessage(template, substitutions) {
    let result = template.replace(/\$\$/g, "\u0000");
    if (substitutions !== undefined && substitutions !== null) {
      const values = Array.isArray(substitutions) ? substitutions : [substitutions];
      result = result.replace(/\$(\d)/g, (match, digit) => {
        const value = values[Number(digit) - 1];
        return value === undefined || value === null ? match : String(value);
      });
    }
    return result.replace(/\u0000/g, "$");
  }

  function t(key, substitutions) {
    let template = messages[key] && messages[key].message;
    if (typeof template !== "string") {
      try {
        template = browser.i18n && browser.i18n.getMessage
          ? browser.i18n.getMessage(key)
          : "";
      } catch (error) {
        template = "";
      }
    }
    if (!template) return key;
    return formatMessage(template, substitutions);
  }

  function translatedValue(key) {
    const value = t(key);
    return value === key ? null : value;
  }

  function apply(root) {
    const scope = root || document;

    scope.querySelectorAll("[data-i18n]").forEach((element) => {
      const value = translatedValue(element.getAttribute("data-i18n"));
      if (value !== null) element.textContent = value;
    });

    scope.querySelectorAll("[data-i18n-html]").forEach((element) => {
      const value = translatedValue(element.getAttribute("data-i18n-html"));
      if (value !== null) element.innerHTML = value;
    });

    scope.querySelectorAll("[data-i18n-title]").forEach((element) => {
      const value = translatedValue(element.getAttribute("data-i18n-title"));
      if (value !== null) element.title = value;
    });

    scope.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
      const value = translatedValue(
        element.getAttribute("data-i18n-placeholder")
      );
      if (value !== null) element.placeholder = value;
    });

    scope.querySelectorAll("[data-i18n-alt]").forEach((element) => {
      const value = translatedValue(element.getAttribute("data-i18n-alt"));
      if (value !== null) element.alt = value;
    });

    if (document.documentElement) {
      document.documentElement.lang = activeLocale.replace(/_/g, "-");
    }
  }

  async function getLanguages() {
    try {
      const response = await fetch(browser.runtime.getURL(LANGUAGE_INDEX));
      if (!response.ok) return {};
      const data = await response.json();
      return data && typeof data === "object" ? data : {};
    } catch (error) {
      return {};
    }
  }

  async function setLanguage(preference) {
    await browser.storage.local.set({ [STORAGE_KEY]: preference || AUTO });
  }

  function getLocale() {
    return activeLocale;
  }

  window.ZenI18n = {
    AUTO,
    STORAGE_KEY,
    init,
    t,
    apply,
    getLocale,
    getPreference,
    setLanguage,
    getLanguages,
  };
})();
