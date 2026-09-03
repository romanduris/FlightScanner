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
    this.attributes = {};
    this.listeners = {};
    this.hidden = false;
    this.innerHTML = "";
    this.textContent = "";
    this.value = "";
    this.style = { values: {}, setProperty: (name, value) => { this.style.values[name] = value; } };
  }
  addEventListener(type, callback) { this.listeners[type] = callback; }
  insertAdjacentHTML(_position, html) { this.innerHTML += html; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
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
    end_date: "2026-11-30",
    scan_days: 90,
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
const collapseToggle = new Element();
collapseToggle.dataset.sectionName = "filtre";
collapseToggle.setAttribute("aria-expanded", "true");
collapseToggle.setAttribute("aria-controls", "filters-content");
const collapseSection = new Element();
collapseSection.querySelector = (selector) => selector === ".section-toggle" ? collapseToggle : null;

global.document = {
  body: new Element(),
  querySelector: element,
  querySelectorAll: (selector) => selector === "[data-collapsible]" ? [collapseSection] : [],
};

require(path.join(__dirname, "..", "HTML", "dashboard.js"));

collapseToggle.listeners.click();
assert.equal(element("#filters-content").hidden, true);
assert.equal(collapseToggle.getAttribute("aria-expanded"), "false");
assert.equal(collapseToggle.getAttribute("aria-label"), "Zobraziť filtre");
assert.equal(collapseSection.classList.contains("collapsed"), true);
collapseToggle.listeners.click();
assert.equal(element("#filters-content").hidden, false);
assert.equal(collapseToggle.getAttribute("aria-expanded"), "true");

const rows = element("#flight-rows");
assert.match(rows.innerHTML, /10\.09\.2026/);
assert.match(rows.innerHTML, /124,99\s*€\*/);
assert.match(rows.innerHTML, /18\.09\.2026/);
assert.match(rows.innerHTML, /28\.09\.2026/);
assert.equal(element("#date-from-filter").max, 29);
assert.equal(element("#date-to-filter").max, 29);
assert.equal(element("#date-from-output").value, "2. 9. 2026");
assert.equal(element("#date-to-output").value, "1. 10. 2026");
assert.equal(element("#planning-window-from-filter").max, 89);
assert.equal(element("#planning-window-to-filter").max, 89);
assert.equal(element("#planning-window-from").value, "2. 9. 2026");
assert.equal(element("#planning-window-to").value, "1. 10. 2026");
assert.equal(element("#planning-range-note").textContent, "90 dní dát · krok 15 dní");
assert.match(element("#planning-weekend-markers").innerHTML, /weekend-marker/);
assert.match(element("#date-weekend-markers").innerHTML, /weekend-marker/);
assert.equal(element("#stat-routes").textContent, 2);
assert.equal(element("#stat-routes-total").textContent, "z 2 destinácií");

element("#date-from-filter").listeners.input({ target: { value: "3" } });
assert.equal(element("#date-from-filter").classList.contains("weekend-day"), true);
element("#date-from-filter").listeners.input({ target: { value: "0" } });

element("#planning-window-from-filter").listeners.input({ target: { value: "45" } });
assert.equal(element("#planning-window-from").value, "17. 10. 2026");
assert.equal(element("#planning-window-to").value, "15. 11. 2026");
assert.equal(element("#date-from-output").value, "17. 10. 2026");
assert.equal(element("#date-to-output").value, "15. 11. 2026");
assert.equal(element("#date-from-filter").min, 45);
assert.equal(element("#date-to-filter").max, 74);
assert.equal(element("#planning-window-from-filter").classList.contains("weekend-day"), true);
assert.equal(element("#planning-window-to-filter").classList.contains("weekend-day"), true);
assert.doesNotMatch(rows.innerHTML, /10\.09\.2026|18\.09\.2026|28\.09\.2026/);

element("#planning-window-to-filter").listeners.input({ target: { value: "44" } });
assert.equal(element("#planning-window-from").value, "17. 9. 2026");
assert.equal(element("#planning-window-to").value, "16. 10. 2026");
assert.doesNotMatch(rows.innerHTML, /10\.09\.2026/);
assert.match(rows.innerHTML, /18\.09\.2026|28\.09\.2026/);

element("#planning-window-from-filter").listeners.input({ target: { value: "0" } });

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
assert.match(element("#period-label").textContent, /2\. septembra – 30\. novembra 2026/);

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
assert.match(html, /id="date-to-filter"[^>]+value="29"/);
assert.match(html, /id="planning-window-from-filter"[\s\S]+id="planning-window-to-filter"/);
assert.match(html, /30-dňové obdobie[\s\S]+Rozsah podľa načítaných dát/);
assert.match(javascript, /flagcdn\.com\/24x18/);
assert.doesNotMatch(rows.innerHTML, /\/h/);
assert.match(html, /class="table-note table-note-bottom">\* Cena spolu: zobrazený let tam \+ najlacnejší nájdený let späť/);
const resultsHelp = html.match(/class="results-help">([\s\S]*?)<\/div>/)?.[1] || "";
assert.doesNotMatch(resultsHelp, /Cena spolu:/);
assert.match(html, /id="results-content"[\s\S]+class="table-note table-note-bottom">\* Cena spolu:/);
assert.match(html, /class="weekend-legend"[\s\S]+Zelená označuje víkend/);
assert.match(javascript, /class="scan-label">Dáta aktualizované/);
assert.doesNotMatch(css, /\.scan-status span\s*\{\s*display:\s*none/);
assert.doesNotMatch(html, /data-sort="country">Krajina/);
assert.match(html, /class="column-destination"><button data-sort="destination_name">Destinácia/);
assert.match(javascript, /class="column-destination"><span class="destination-cell">\$\{flag\(offer\.country_code\)\}/);
assert.match(css, /max-width:\s*680px[\s\S]+column-duration[\s\S]+column-destination[\s\S]+width:\s*40%/);
assert.equal((html.match(/data-collapsible/g) || []).length, 4);
assert.match(html, /aria-controls="overview-content"/);
assert.match(html, /aria-controls="filters-content"/);
assert.match(html, /aria-controls="map-content"/);
assert.match(html, /aria-controls="results-content"/);
assert.match(css, /input\.weekend-day::-(?:webkit-slider-thumb|moz-range-thumb)[^}]+background:\s*var\(--green\)/);
assert.match(css, /\.results-help\s*\{[^}]*align-self:\s*flex-end;[^}]*text-align:\s*right/);
assert.match(css, /\.table-note-bottom\s*\{[^}]*text-align:\s*right/);
assert.match(javascript, /function bindCollapsibleSections\(\)/);
assert.match(javascript, /map\.invalidateSize\(\)/);
assert.match(javascript, /class="detail-flight"[\s\S]+offer\.flight_number[\s\S]+class="detail-plane"[\s\S]+duration\(offer\.duration_minutes\)/);
assert.match(javascript, /Najlacnejšia obojsmerná letenka[\s\S]+roundTripPrice/);
assert.match(javascript, /<span>Krajina<\/span>[\s\S]+<span>Vzdialenosť<\/span>[\s\S]+<span>Odlet<\/span>[\s\S]+<span>Prílet<\/span>/);
assert.doesNotMatch(javascript, /Cena za hodinu|<span>Číslo letu<\/span>|<span>Dĺžka letu<\/span>|<span>Typ ceny<\/span>|<span>Časy<\/span>/);
assert.match(css, /\.detail-flight\s*\{[^}]*flex-direction:\s*column/);
assert.match(css, /\.collapsible-content\[hidden\]\s*\{\s*display:\s*none !important;/);
assert.match(css, /\.map-card\.collapsed \.section-header\s*\{[^}]*flex-direction:\s*row/);
assert.match(css, /\.map-card\.collapsed \.map-actions\s*\{[^}]*width:\s*auto;[^}]*flex-direction:\s*column/);
assert.doesNotMatch(html, /data-max-price/);
assert.doesNotMatch(javascript, /plane-arrow|arrowPoint/);

console.log("Dashboard filters, branding and map routes: OK");
