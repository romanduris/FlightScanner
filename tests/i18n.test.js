"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function testElement(dataset = {}) {
  return {
    dataset,
    textContent: "",
    attributes: {},
    listeners: {},
    classList: { toggle() {} },
    addEventListener(type, listener) { this.listeners[type] = listener; },
    setAttribute(name, value) { this.attributes[name] = String(value); },
  };
}

const translatedText = testElement({ i18n: "filters.title" });
const translatedAria = testElement({ i18nAria: "language.label" });
const skButton = testElement({ language: "sk" });
const enButton = testElement({ language: "en" });
const description = testElement();
const storage = new Map();
let assignedUrl = null;

global.window = {
  location: {
    search: "?lang=en",
    href: "https://btsflightscaner.rodulab.com/?lang=en",
    assign(value) { assignedUrl = value; },
  },
  localStorage: {
    getItem(key) { return storage.get(key) || null; },
    setItem(key, value) { storage.set(key, value); },
  },
};
global.document = {
  documentElement: { lang: "sk" },
  title: "",
  querySelector(selector) { return selector === 'meta[name="description"]' ? description : null; },
  querySelectorAll(selector) {
    if (selector === "[data-i18n]") return [translatedText];
    if (selector === "[data-i18n-aria]") return [translatedAria];
    if (selector === "[data-language]") return [skButton, enButton];
    return [];
  },
};

require(path.join(__dirname, "..", "HTML", "i18n", "sk.js"));
require(path.join(__dirname, "..", "HTML", "i18n", "en.js"));
require(path.join(__dirname, "..", "HTML", "i18n", "i18n.js"));

assert.equal(window.FlightI18n.language, "en");
assert.equal(window.FlightI18n.locale, "en-GB");
assert.equal(document.documentElement.lang, "en");
assert.equal(document.title, "BTSFLIGHTSCANER — flights from Bratislava");
assert.equal(translatedText.textContent, "Flights from Bratislava");
assert.equal(translatedAria.attributes["aria-label"], "Page language");
assert.equal(window.FlightI18n.destinationName("ATH", "ATÉNY"), "Athens");
assert.equal(window.FlightI18n.countryName("GR", "Grécko"), "Greece");
assert.equal(window.FLIGHT_TRANSLATIONS.sk.text["contact.title"], "Napíšte nám");
assert.equal(window.FLIGHT_TRANSLATIONS.en.text["contact.title"], "Write to us");

const html = fs.readFileSync(path.join(__dirname, "..", "HTML", "index.html"), "utf8");
const dashboard = fs.readFileSync(path.join(__dirname, "..", "HTML", "dashboard.js"), "utf8");
const contact = fs.readFileSync(path.join(__dirname, "..", "HTML", "contact", "contact.js"), "utf8");
const translationKeys = new Set([
  ...[...html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)].map((match) => match[1]),
  ...[...dashboard.matchAll(/\bt\("([^"]+)"/g)].map((match) => match[1]),
  ...[...contact.matchAll(/\.t\("([^"]+)"/g)].map((match) => match[1]),
]);
for (const language of ["sk", "en"]) {
  const missingKeys = [...translationKeys].filter((key) => !(key in window.FLIGHT_TRANSLATIONS[language].text));
  assert.deepEqual(missingKeys, [], `${language} is missing translation keys`);
}

skButton.listeners.click();
assert.equal(storage.get("flightscanner-language"), "sk");
assert.equal(assignedUrl, "https://btsflightscaner.rodulab.com/");

console.log("English language switch and translations: OK");
