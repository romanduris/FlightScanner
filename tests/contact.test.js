"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

class Element {
  constructor() {
    this.attributes = {};
    this.dataset = {};
    this.disabled = false;
    this.listeners = {};
    this.textContent = "";
  }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  reportValidity() { return true; }
  reset() { this.wasReset = true; }
}

const elements = {
  "#contact-form": new Element(),
  '[aria-controls="contact-content"]': new Element(),
  "#contact-turnstile": new Element(),
  "#contact-submit": new Element(),
  "#contact-status": new Element(),
};
elements['[aria-controls="contact-content"]'].attributes["aria-expanded"] = "true";
elements["#contact-submit"].disabled = true;

const scriptElement = new Element();
let turnstileOptions = null;
let submittedPayload = null;
let fetchCount = 0;

global.window = {
  FlightI18n: {
    language: "sk",
    t(key) { return key; },
  },
  location: {
    origin: "https://btsflightscaner.rodulab.com",
    pathname: "/",
    search: "",
  },
};
global.document = {
  head: {
    appendChild() {
      window.turnstile = {
        render(_container, options) {
          turnstileOptions = options;
          options.callback("verified-token");
          return 7;
        },
        reset(widgetId) { assert.equal(widgetId, 7); },
      };
      scriptElement.listeners.load();
    },
  },
  createElement(name) {
    assert.equal(name, "script");
    return scriptElement;
  },
  querySelector(selector) { return elements[selector] || null; },
};
global.FormData = class {
  get(name) {
    return {
      name: "Test User",
      email: "visitor@example.com",
      message: "A useful test message.",
      website: "",
    }[name];
  }
};
global.fetch = async (_url, options = {}) => {
  fetchCount += 1;
  if (!options.method) return Response.json({ turnstileSiteKey: "public-site-key" });
  submittedPayload = JSON.parse(options.body);
  return Response.json({ ok: true });
};

require(path.join(__dirname, "..", "HTML", "contact", "contact.js"));

(async () => {
  elements['[aria-controls="contact-content"]'].listeners.click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(turnstileOptions.sitekey, "public-site-key");
  assert.equal(turnstileOptions.action, "contact");
  assert.equal(elements["#contact-submit"].disabled, false);

  await elements["#contact-form"].listeners.submit({ preventDefault() {} });
  assert.equal(fetchCount, 2);
  assert.equal(submittedPayload.turnstileToken, "verified-token");
  assert.equal(submittedPayload.email, "visitor@example.com");
  assert.equal(elements["#contact-form"].wasReset, true);
  assert.equal(elements["#contact-status"].textContent, "contact.success");
  assert.equal(elements["#contact-status"].dataset.state, "success");
  console.log("Contact form and Turnstile submission: OK");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
