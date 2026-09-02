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
    this.style = { values: {}, setProperty: (name, value) => { this.style.values[name] = value; } };
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
      return_offers: [
        {
          origin_iata: "ATH",
          departure_local: "2026-09-20T10:00",
          price: 25.99,
        },
        {
          origin_iata: "ATH",
          departure_local: "2026-09-22T10:00",
          price: 19.99,
        },
        {
          origin_iata: "ATH",
          departure_local: "2026-09-29T10:00",
          price: 9.99,
        },
      ],
    }],
  },
};
global.window.FLIGHT_DATA.offers.push({
  ...global.window.FLIGHT_DATA.offers[0],
  airline: "RYANAIR",
  destination_name: "SKORŠÍ LET",
  destination_iata: "TST",
  country: "Testland",
  country_code: "TS",
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
assert.match(rows.innerHTML, /10\.09\.2026/);
assert.match(rows.innerHTML, /25,99\s*€\*/);
assert.doesNotMatch(rows.innerHTML, /18\.09\.2026|28\.09\.2026/);
assert.equal(element("#date-from-filter").max, 29);
assert.equal(element("#date-to-filter").max, 29);
assert.equal(element("#date-from-output").value, "2. 9. 2026");
assert.equal(element("#date-to-output").value, "15. 9. 2026");
assert.equal(element("#stat-routes").textContent, 1);
assert.equal(element("#stat-routes-total").textContent, "z 2 destinácií");

element("#date-to-filter").listeners.input({ target: { value: "29" } });
assert.match(rows.innerHTML, /18\.09\.2026/);
assert.match(rows.innerHTML, /28\.09\.2026/);
assert.ok(rows.innerHTML.indexOf("10.09.2026") < rows.innerHTML.indexOf("18.09.2026"));
assert.ok(rows.innerHTML.indexOf("18.09.2026") < rows.innerHTML.indexOf("28.09.2026"));

element("#date-from-filter").listeners.input({ target: { value: "9" } });
assert.doesNotMatch(rows.innerHTML, /10\.09\.2026/);
assert.match(rows.innerHTML, /18\.09\.2026|28\.09\.2026/);
element("#date-from-filter").listeners.input({ target: { value: "0" } });

element("#country-filter").listeners.change({ target: { value: "Grécko" } });
assert.match(element("#destination-filter").innerHTML, /ATÉNY \(ATH\)/);
assert.doesNotMatch(element("#destination-filter").innerHTML, /SKORŠÍ LET/);
assert.match(rows.innerHTML, /ATÉNY/);
assert.doesNotMatch(rows.innerHTML, /SKORŠÍ LET/);

element("#destination-filter").listeners.change({ target: { value: "ATH" } });
assert.match(rows.innerHTML, /ATÉNY/);

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
assert.doesNotMatch(rows.innerHTML, /10\.09\.2026/);
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
assert.match(html, /<span class="stat-label">Destinácie<\/span>/);
assert.match(html, /id="destination-filter"/);
assert.doesNotMatch(html, /id="search-input"|id="airline-filter"/);
assert.doesNotMatch(html, /Najnižšia cena|Priemerná cena|Najkratší let/);
assert.match(html, /id="date-from-filter"[^>]+value="0"/);
assert.match(html, /id="date-to-filter"[^>]+value="13"/);
assert.match(javascript, /flagcdn\.com\/24x18/);
assert.doesNotMatch(rows.innerHTML, /\/h/);
assert.match(html, /class="table-note">\* Najnižšia nájdená cena samostatného spiatočného letu/);
assert.match(javascript, /class="scan-label">Dáta aktualizované/);
assert.doesNotMatch(css, /\.scan-status span\s*\{\s*display:\s*none/);
assert.doesNotMatch(html, /data-sort="country">Krajina/);
assert.match(html, /class="column-destination"><button data-sort="destination_name">Destinácia/);
assert.match(javascript, /class="column-destination"><span class="destination-cell">\$\{flag\(offer\.country_code\)\}/);
assert.match(css, /max-width:\s*680px[\s\S]+column-duration[\s\S]+column-destination[\s\S]+width:\s*40%/);
assert.doesNotMatch(html, /data-max-price/);
assert.doesNotMatch(javascript, /plane-arrow|arrowPoint/);

console.log("Dashboard filters, branding and map routes: OK");
