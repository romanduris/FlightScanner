(() => {
  "use strict";

  const translations = window.FLIGHT_TRANSLATIONS || {};
  const supportedLanguages = ["sk", "en"];
  const requestedLanguage = new URLSearchParams(window.location?.search || "").get("lang");
  let storedLanguage = null;
  try {
    storedLanguage = window.localStorage?.getItem("flightscanner-language");
  } catch (_error) {
    storedLanguage = null;
  }
  const language = supportedLanguages.includes(requestedLanguage)
    ? requestedLanguage
    : supportedLanguages.includes(storedLanguage) ? storedLanguage : "sk";
  const dictionary = translations[language] || translations.sk;

  function t(key, values = {}) {
    const template = dictionary?.text?.[key] ?? translations.sk?.text?.[key] ?? key;
    return String(template).replace(/\{([A-Za-z0-9_]+)\}/g, (_match, name) => (
      Object.hasOwn(values, name) ? String(values[name]) : `{${name}}`
    ));
  }

  function destinationName(iata, fallback) {
    return dictionary?.destinations?.[String(iata || "").toUpperCase()] || fallback || iata || "—";
  }

  function countryName(countryCode, fallback) {
    if (language === "sk") return fallback || countryCode || "—";
    try {
      return new Intl.DisplayNames([dictionary.locale], { type: "region" }).of(String(countryCode || "").toUpperCase()) || fallback;
    } catch (_error) {
      return fallback || countryCode || "—";
    }
  }

  function applyStaticTranslations() {
    if (document.documentElement) document.documentElement.lang = language;
    document.title = t("meta.title");
    document.querySelector('meta[name="description"]')?.setAttribute("content", t("meta.description"));
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = t(element.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((element) => {
      element.setAttribute("aria-label", t(element.dataset.i18nAria));
    });
    document.querySelectorAll("[data-language]").forEach((button) => {
      const active = button.dataset.language === language;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function selectLanguage(nextLanguage) {
    if (!supportedLanguages.includes(nextLanguage) || nextLanguage === language) return;
    try {
      window.localStorage?.setItem("flightscanner-language", nextLanguage);
    } catch (_error) {
      // The URL still preserves the language when storage is unavailable.
    }
    const url = new URL(window.location.href);
    if (nextLanguage === "sk") url.searchParams.delete("lang");
    else url.searchParams.set("lang", nextLanguage);
    window.location.assign(url.toString());
  }

  window.FlightI18n = {
    language,
    locale: dictionary.locale,
    weekdays: dictionary.weekdays,
    months: dictionary.months,
    t,
    destinationName,
    countryName,
  };

  applyStaticTranslations();
  document.querySelectorAll("[data-language]").forEach((button) => {
    button.addEventListener("click", () => selectLanguage(button.dataset.language));
  });
})();
