"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

class ClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
  toggle(value, force) {
    const enabled = force === undefined ? !this.values.has(value) : force;
    if (enabled) this.values.add(value);
    else this.values.delete(value);
    return enabled;
  }
}

class Element {
  constructor() {
    this.classList = new ClassList();
    this.dataset = {};
    this.listeners = {};
    this.hidden = false;
    this.innerHTML = "";
    this.textContent = "";
    this.value = "";
  }
  addEventListener(type, callback) { this.listeners[type] = callback; }
  insertAdjacentHTML(_position, html) { this.innerHTML += html; }
  querySelectorAll() { return []; }
  setAttribute() {}
}

const elements = new Map();
const element = (selector) => {
  if (!elements.has(selector)) elements.set(selector, new Element());
  return elements.get(selector);
};

global.window = {
  FLIGHT_DATA: {
    year: 2026,
    month: 9,
    start_date: "2026-09-02",
    end_date: "2026-10-01",
    scan_days: 30,
    scanned_at_utc: "2026-09-02T08:00:00+00:00",
    return_window_days: 10,
    origin: { latitude: 48.17, longitude: 17.21 },
    offers: [{
      airline: "Wizz Air",
      origin_iata: "BTS",
      destination_name: "ATÉNY",
      destination_iata: "ATH",
      country: "Grécko",
      country_code: "GR",
      flight_number: "W67035",
      departure_local: "2026-09-28T19:55",
      arrival_local: "2026-09-28T23:10",
      duration_minutes: 195,
      distance_km: 1261,
      price: 100,
      price_per_hour: 4.34,
      operating_schedule: ["Pon 19:55", "Pia 19:55"],
      outbound_offers: [
        {
          departure_local: "2026-09-28T19:55",
          arrival_local: "2026-09-28T23:10",
          duration_minutes: 195,
          flight_number: "W67035",
          price: 14.09,
          currency: "EUR",
        },
        {
          departure_local: "2026-09-18T19:55",
          arrival_local: "2026-09-18T23:10",
          duration_minutes: 195,
          flight_number: "W67035",
          price: 42.29,
          currency: "EUR",
        },
      ],
      return_offers: [],
    }],
  },
};
global.window.FLIGHT_DATA.offers.push({
  ...global.window.FLIGHT_DATA.offers[0],
  airline: "RYANAIR",
  destination_name: "SKORŠÍ LET",
  destination_iata: "TST",
  flight_number: "FR0001",
  departure_local: "2026-09-10T08:00",
  arrival_local: "2026-09-10T09:00",
  price: 99,
  outbound_offers: [{
    departure_local: "2026-09-10T08:00",
    arrival_local: "2026-09-10T09:00",
    duration_minutes: 60,
    flight_number: "FR0001",
    price: 99,
    currency: "EUR",
  }],
});
global.document = {
  body: new Element(),
  querySelector: element,
  querySelectorAll: () => [],
};

require(path.join(__dirname, "..", "HTML", "dashboard.js"));

const rows = element("#flight-rows");
assert.match(rows.innerHTML, /28\.09\.2026/);
assert.match(rows.innerHTML, /14,09/);
assert.ok(rows.innerHTML.indexOf("SKORŠÍ LET") < rows.innerHTML.indexOf("ATÉNY"));

const fridayButton = {
  dataset: { weekday: "Pia" },
  classList: new ClassList(),
  setAttribute() {},
};
element("#weekday-buttons").listeners.click({
  target: { closest: () => fridayButton },
});

assert.match(rows.innerHTML, /18\.09\.2026/);
assert.match(rows.innerHTML, /42,29/);
assert.doesNotMatch(rows.innerHTML, /28\.09\.2026/);
assert.match(element("#period-label").textContent, /2\. septembra – 1\. októbra 2026/);

const css = fs.readFileSync(
  path.join(__dirname, "..", "HTML", "dashboard.css"),
  "utf8",
);
assert.match(css, /\.map-fallback\[hidden\]\s*\{\s*display:\s*none;/);

const html = fs.readFileSync(
  path.join(__dirname, "..", "HTML", "index.html"),
  "utf8",
);
const javascript = fs.readFileSync(
  path.join(__dirname, "..", "HTML", "dashboard.js"),
  "utf8",
);
assert.match(html, /class="brand-bts">BTS<\/span><span class="brand-flight">FLIGHT<\/span><span class="brand-scaner">SCANER<\/span>/);
assert.match(html, /data-sort="departure_local">Odlet/);
assert.doesNotMatch(html, /data-max-price/);
assert.doesNotMatch(javascript, /plane-arrow|arrowPoint/);

console.log("Dashboard filters, branding and map routes: OK");
