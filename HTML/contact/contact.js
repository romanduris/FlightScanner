(() => {
  "use strict";

  const i18n = window.FlightI18n;
  const form = document.querySelector("#contact-form");
  const toggle = document.querySelector('[aria-controls="contact-content"]');
  const turnstileContainer = document.querySelector("#contact-turnstile");
  const submitButton = document.querySelector("#contact-submit");
  const status = document.querySelector("#contact-status");
  if (!i18n || !form || !toggle || !turnstileContainer || !submitButton || !status) return;

  const endpoint = new URL("/api/contact", window.location.origin).toString();
  let initializationPromise = null;
  let turnstileWidgetId = null;
  let turnstileToken = "";

  function setStatus(message, state = "") {
    status.textContent = message;
    if (state) status.dataset.state = state;
    else delete status.dataset.state;
  }

  function loadTurnstileApi() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    return new Promise((resolve, reject) => {
      const existing = document.querySelector("script[data-contact-turnstile-api]");
      const script = existing || document.createElement("script");
      const onLoad = () => window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile is unavailable"));
      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", () => reject(new Error("Turnstile failed to load")), { once: true });
      if (!existing) {
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.dataset.contactTurnstileApi = "";
        document.head.appendChild(script);
      }
    });
  }

  async function initializeContactForm() {
    if (turnstileWidgetId != null) return;
    if (initializationPromise) return initializationPromise;

    initializationPromise = (async () => {
      const response = await fetch(`${endpoint}/config`, {
        headers: { Accept: "application/json" },
        credentials: "omit",
      });
      if (!response.ok) throw new Error("Contact configuration is unavailable");
      const configuration = await response.json();
      if (!configuration.turnstileSiteKey) throw new Error("Turnstile site key is missing");

      const turnstile = await loadTurnstileApi();
      turnstileWidgetId = turnstile.render(turnstileContainer, {
        sitekey: configuration.turnstileSiteKey,
        action: "contact",
        theme: "light",
        language: i18n.language,
        callback(token) {
          turnstileToken = token;
          submitButton.disabled = false;
          setStatus("");
        },
        "expired-callback"() {
          turnstileToken = "";
          submitButton.disabled = true;
          setStatus(i18n.t("contact.verification"));
        },
        "error-callback"() {
          turnstileToken = "";
          submitButton.disabled = true;
          setStatus(i18n.t("contact.error"), "error");
        },
      });
    })().catch(() => {
      initializationPromise = null;
      submitButton.disabled = true;
      setStatus(i18n.t("contact.unavailable"), "error");
    });

    return initializationPromise;
  }

  function resetVerification() {
    turnstileToken = "";
    submitButton.disabled = true;
    if (turnstileWidgetId != null && window.turnstile) {
      window.turnstile.reset(turnstileWidgetId);
    }
  }

  toggle.addEventListener("click", () => {
    if (toggle.getAttribute("aria-expanded") === "true") initializeContactForm();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) {
      setStatus(i18n.t("contact.invalid"), "error");
      return;
    }
    if (!turnstileToken) {
      setStatus(i18n.t("contact.verification"), "error");
      return;
    }

    const fields = new FormData(form);
    submitButton.disabled = true;
    submitButton.textContent = i18n.t("contact.sending");
    setStatus(i18n.t("contact.sending"));

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "omit",
        body: JSON.stringify({
          name: fields.get("name"),
          email: fields.get("email"),
          message: fields.get("message"),
          website: fields.get("website"),
          turnstileToken,
          page: `${window.location.pathname}${window.location.search}`,
          language: i18n.language,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        const error = new Error("Contact request failed");
        error.code = result.error;
        throw error;
      }

      form.reset();
      setStatus(i18n.t("contact.success"), "success");
    } catch (error) {
      const messageKey = error.code === "invalid_request"
        ? "contact.invalid"
        : error.code === "rate_limited" ? "contact.rateLimited" : "contact.error";
      setStatus(i18n.t(messageKey), "error");
    } finally {
      submitButton.textContent = i18n.t("contact.submit");
      resetVerification();
    }
  });
})();
