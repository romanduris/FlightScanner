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
  FLIGHTSCANNER_TODAY: "2026-09-04",
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
          departure_local: "2026-09-23T10:00",
          price: 29.99,
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
collapseToggle.dataset.sectionKey = "filters.sectionName";
collapseToggle.setAttribute("aria-expanded", "true");
collapseToggle.setAttribute("aria-controls", "filters-content");
const collapseSection = new Element();
collapseSection.querySelector = (selector) => selector === ".section-toggle" ? collapseToggle : null;

global.document = {
  body: new Element(),
  querySelector: element,
  querySelectorAll: (selector) => selector === "[data-collapsible]" ? [collapseSection] : [],
};

require(path.join(__dirname, "..", "HTML", "i18n", "sk.js"));
require(path.join(__dirname, "..", "HTML", "i18n", "en.js"));
require(path.join(__dirname, "..", "HTML", "i18n", "i18n.js"));
assert.equal(window.FlightI18n.language, "sk");
assert.equal(window.FlightI18n.t("filters.title"), "Lety z Bratislavy");
assert.equal(window.FLIGHT_TRANSLATIONS.en.text["filters.title"], "Flights from Bratislava");
assert.equal(window.FLIGHT_TRANSLATIONS.en.text["overview.flights"], "Flights");
assert.equal(window.FLIGHT_TRANSLATIONS.en.text["overview.visiblePeriod"], "displayed period");
assert.equal(window.FLIGHT_TRANSLATIONS.en.text["return.stayOneDay"], "{count} day");
assert.equal(window.FLIGHT_TRANSLATIONS.en.text["return.stayDays"], "{count} days");
assert.equal(window.FLIGHT_TRANSLATIONS.en.destinations.ATH, "Athens");

require(path.join(__dirname, "..", "HTML", "booking", "booking-com-config.js"));
require(path.join(__dirname, "..", "HTML", "booking", "booking-com.js"));
const hotelUrl = new URL(window.BookingComLinks.buildUrl({
  destinationIata: "NAP",
  destinationName: "NEAPOL",
  checkinDate: "2026-09-03T16:05",
  checkoutDate: "2026-09-08T16:40",
  adults: 1,
}));
assert.equal(hotelUrl.origin, "https://www.booking.com");
assert.equal(hotelUrl.searchParams.get("ss"), "Naples");
assert.equal(hotelUrl.searchParams.get("checkin"), "2026-09-03");
assert.equal(hotelUrl.searchParams.get("checkout"), "2026-09-08");
assert.equal(hotelUrl.searchParams.get("group_adults"), "1");
assert.equal(hotelUrl.searchParams.get("no_rooms"), "1");
assert.equal(hotelUrl.searchParams.get("currency"), "EUR");
assert.equal(hotelUrl.searchParams.get("selected_currency"), "EUR");
assert.equal(hotelUrl.searchParams.has("aid"), false);
window.BOOKING_COM_CONFIG.affiliateId = "123456";
const affiliateHotelUrl = new URL(window.BookingComLinks.buildUrl({
  destinationIata: "STN",
  checkinDate: "2026-10-01",
  checkoutDate: "2026-10-05",
}));
assert.equal(affiliateHotelUrl.searchParams.get("ss"), "London");
assert.equal(affiliateHotelUrl.searchParams.get("aid"), "123456");
assert.equal(affiliateHotelUrl.searchParams.get("label"), "flightscanner-return-stay");
assert.equal(affiliateHotelUrl.searchParams.get("currency"), "EUR");
assert.equal(affiliateHotelUrl.searchParams.get("selected_currency"), "EUR");
window.BOOKING_COM_CONFIG.affiliateId = "";
const hotelButton = window.BookingComLinks.createButton({
  stay: {
    destinationIata: "NAP",
    checkinDate: "2026-09-03",
    checkoutDate: "2026-09-08",
  },
  label: "Hľadať ubytovanie",
});
assert.match(hotelButton, /class="hotel-booking-link"/);
assert.match(hotelButton, /rel="noopener sponsored"/);
assert.match(hotelButton, /<strong><span>Booking<\/span><span>\.com<\/span><\/strong>/);
assert.doesNotMatch(hotelButton, /Ubytovanie|Find a stay|↗/);

require(path.join(__dirname, "..", "HTML", "booking", "booking-buttons.js"));
require(path.join(__dirname, "..", "HTML", "booking", "ryanair.js"));
require(path.join(__dirname, "..", "HTML", "booking", "wizzair.js"));

const ryanairBookingUrl = new URL(window.FlightBookingButtons.buildUrl("RYANAIR", {
  originIata: "BTS",
  destinationIata: "PMO",
  outboundDate: "2026-09-02T13:45",
  returnDate: "2026-09-08T10:55",
  adults: 1,
}));
assert.equal(ryanairBookingUrl.origin, "https://www.ryanair.com");
assert.equal(ryanairBookingUrl.searchParams.get("originIata"), "BTS");
assert.equal(ryanairBookingUrl.searchParams.get("destinationIata"), "PMO");
assert.equal(ryanairBookingUrl.searchParams.get("dateOut"), "2026-09-02");
assert.equal(ryanairBookingUrl.searchParams.get("dateIn"), "2026-09-08");
assert.equal(ryanairBookingUrl.searchParams.get("isReturn"), "true");

const wizzBookingUrl = window.FlightBookingButtons.buildUrl("Wizz Air", {
  originIata: "BTS",
  destinationIata: "ALC",
  outboundDate: "2026-10-23T05:40",
  returnDate: "2026-10-28T09:30",
  adults: 1,
});
assert.equal(wizzBookingUrl, "https://www.wizzair.com/en-gb/booking/select-flight/BTS/ALC/2026-10-23/2026-10-28/1/0/0/null");
const returnButton = window.FlightBookingButtons.createReturnButton({
  airline: "Wizz Air",
  trip: {
    originIata: "BTS",
    destinationIata: "ALC",
    outboundDate: "2026-10-23T05:40",
    returnDate: "2026-10-28T09:30",
  },
  className: "return-option cheapest",
  label: "Rezervovať spiatočný let",
  content: "Obsah letu",
});
assert.match(returnButton, /^<a class="return-option cheapest"/);
assert.match(returnButton, /target="_blank" rel="noopener"/);
assert.match(returnButton, /BTS\/ALC\/2026-10-23\/2026-10-28/);

const renderedRows = [];
element("#flight-rows").querySelectorAll = () => {
  const count = (element("#flight-rows").innerHTML.match(/<tr/g) || []).length;
  renderedRows.splice(0, renderedRows.length, ...Array.from({ length: count }, () => new Element()));
  return renderedRows;
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
assert.match(rows.innerHTML, /10\.09\.2026 \(Štv\)/);
assert.match(rows.innerHTML, /08:00 → 09:00<span class="responsive-duration"> \(1 h 00 min\)<\/span>/);
assert.doesNotMatch(rows.innerHTML, /miestny čas|local time/);
assert.match(rows.innerHTML, /124,99\s*€\*/);
assert.match(rows.innerHTML, /18\.09\.2026/);
assert.match(rows.innerHTML, /28\.09\.2026/);
assert.equal(element("#date-to-filter").min, 2);
assert.equal(element("#date-to-filter").max, 31);
assert.equal(element("#date-from-output").value, "4. 9. 2026 (Pia)");
assert.equal(element("#date-to-output").value, "3. 10. 2026 (Sob)");
assert.equal(element("#calendar-selected-date").textContent, "4. 9. 2026 (Pia)");
assert.match(element("#calendar-months").innerHTML, /september 2026/i);
assert.match(element("#calendar-months").innerHTML, /október 2026/i);
assert.match(element("#calendar-months").innerHTML, /data-calendar-day="2"[^>]*aria-pressed="true"/);
assert.equal(element("#stat-routes").textContent, 2);
assert.equal(element("#stat-routes-total").textContent, "z 2 destinácií");
assert.equal(element("#stat-flights").textContent, "3");
assert.match(element("#airline-summary").innerHTML, /Letov denne<strong>0<\/strong>/);
assert.match(element("#airline-summary").innerHTML, /Dáta do<\/span><strong>30\.11\.2026<\/strong>/);
assert.equal(element("#traveller-count").value, 1);
assert.equal(element("#traveller-minus").disabled, true);
assert.equal(element("#price-filter").max, 100);

renderedRows[1].listeners.click();
assert.match(element("#detail-content").innerHTML, /20\.09\.2026 \(Ned\): 2 dni/);
assert.match(element("#detail-content").innerHTML, /22\.09\.2026 \(Uto\): 4 dni/);
assert.match(element("#detail-content").innerHTML, /23\.09\.2026 \(Str\): 5 dní/);

element("#traveller-plus").listeners.click();
assert.equal(element("#traveller-count").value, 2);
assert.equal(element("#traveller-minus").disabled, false);
assert.equal(element("#price-filter").max, 200);
assert.equal(element("#price-filter").value, 200);
assert.equal(element("#price-output").value, "200,00 €");
assert.match(rows.innerHTML, /198,00\s*€/);
assert.match(rows.innerHTML, /249,98\s*€\*/);
element("#traveller-minus").listeners.click();
assert.equal(element("#traveller-count").value, 1);

const dashboardCss = fs.readFileSync(path.join(__dirname, "..", "HTML", "dashboard.css"), "utf8");
assert.match(dashboardCss, /\.results-card\.collapsed \.results-date-controls \{ display: none; \}/);
assert.match(dashboardCss, /@media \(max-width: 400px\)[\s\S]*\.airline-meta span:nth-child\(3\) \{ display: none; \}/);

const selectedSeptember18 = { dataset: { calendarDay: "16" }, disabled: false };
element("#calendar-months").listeners.click({ target: { closest: () => selectedSeptember18 } });
assert.equal(element("#calendar-selected-date").textContent, "18. 9. 2026 (Pia)");
assert.equal(element("#date-from-output").value, "18. 9. 2026 (Pia)");
assert.equal(element("#date-to-output").value, "17. 10. 2026 (Sob)");
assert.equal(element("#date-to-filter").min, 16);
assert.equal(element("#date-to-filter").max, 45);
assert.doesNotMatch(rows.innerHTML, /10\.09\.2026/);
assert.match(rows.innerHTML, /18\.09\.2026|28\.09\.2026/);

element("#date-to-filter").listeners.input({ target: { value: "26" } });
assert.equal(element("#date-to-output").value, "28. 9. 2026 (Pon)");
assert.match(rows.innerHTML, /18\.09\.2026/);
assert.match(rows.innerHTML, /28\.09\.2026/);

const selectedToday = { dataset: { calendarDay: "2" }, disabled: false };
element("#calendar-months").listeners.click({ target: { closest: () => selectedToday } });
assert.match(rows.innerHTML, /10\.09\.2026/);
assert.match(rows.innerHTML, /18\.09\.2026/);
assert.match(rows.innerHTML, /28\.09\.2026/);
assert.ok(rows.innerHTML.indexOf("10.09.2026") < rows.innerHTML.indexOf("18.09.2026"));
assert.ok(rows.innerHTML.indexOf("18.09.2026") < rows.innerHTML.indexOf("28.09.2026"));

element("#country-filter").listeners.change({ target: { value: "GR" } });
assert.match(element("#destination-filter").innerHTML, /ATÉNY \(ATH\)/);
assert.doesNotMatch(element("#destination-filter").innerHTML, /SKORŠÍ LET/);
assert.match(rows.innerHTML, /ATÉNY/);
assert.doesNotMatch(rows.innerHTML, /SKORŠÍ LET/);

element("#destination-filter").listeners.change({ target: { value: "ATH" } });
assert.match(rows.innerHTML, /ATÉNY/);

assert.match(rows.innerHTML, /18\.09\.2026/);
assert.match(rows.innerHTML, /42,29/);
assert.match(rows.innerHTML, /28\.09\.2026/);
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
const contactJavascript = fs.readFileSync(
  path.join(__dirname, "..", "HTML", "contact", "contact.js"),
  "utf8",
);
assert.match(html, /class="brand-bts">BTS<\/span><span class="brand-flight">FLIGHT<\/span><span class="brand-scaner">SCANER<\/span>/);
assert.match(html, /data-sort="departure_local"[^>]*>[\s\S]{0,100}Odlet/);
assert.match(html, /class="stat-label"[^>]*>Destinácie<\/span>/);
assert.ok(html.indexOf('data-i18n="overview.countries"') < html.indexOf('data-i18n="overview.destinations"'));
assert.match(html, /id="destination-filter"/);
assert.doesNotMatch(html, /id="search-input"|id="airline-filter"/);
assert.doesNotMatch(html, /Najnižšia cena|Priemerná cena|Najkratší let/);
assert.match(html, /id="date-to-filter"[^>]+value="29"/);
assert.doesNotMatch(html, /id="date-from-filter"|id="planning-window-filter"/);
assert.match(html, /id="calendar-selected-date"/);
assert.match(html, /id="calendar-prev"[\s\S]+id="calendar-next"[\s\S]+id="calendar-months"/);
assert.match(javascript, /flagcdn\.com\/24x18/);
assert.doesNotMatch(rows.innerHTML, /\/h/);
assert.match(html, /class="table-note table-note-bottom"[^>]*>\* Cena spolu: zobrazený let tam \+ najlacnejší nájdený let späť/);
assert.match(html, /id="results-content"[\s\S]+class="table-note table-note-bottom"[^>]*>\* Cena spolu:/);
assert.doesNotMatch(html, /weekend-legend|date-weekend-markers|planning-weekend-markers/);
assert.match(html, /id="traveller-minus"[\s\S]+id="traveller-count"[\s\S]+id="traveller-plus"/);
assert.doesNotMatch(html, /range-help|Posuvníkom môžeš skrátiť|Use the slider to shorten|results-help/);
assert.match(javascript, /class="scan-label">\$\{t\("header\.updated"\)\}/);
assert.doesNotMatch(css, /\.scan-status span\s*\{\s*display:\s*none/);
assert.doesNotMatch(html, /data-sort="country">Krajina/);
assert.match(html, /class="column-destination"><button data-sort="destination_name">[\s\S]{0,100}Destinácia/);
assert.match(javascript, /class="column-destination"><span class="destination-cell">\$\{flag\(offer\.country_code\)\}/);
assert.match(css, /max-width:\s*680px[\s\S]+column-duration[\s\S]+column-destination[\s\S]+width:\s*40%/);
assert.match(css, /\.responsive-duration\s*\{\s*display:\s*none;/);
assert.match(css, /max-width:\s*680px[\s\S]+\.responsive-duration\s*\{\s*display:\s*inline;/);
assert.equal((html.match(/data-collapsible/g) || []).length, 6);
assert.match(html, /aria-controls="overview-content"/);
assert.match(html, /aria-controls="filters-content"/);
assert.match(html, /aria-controls="map-content"/);
assert.match(html, /aria-controls="calendar-content"/);
assert.match(html, /aria-controls="results-content"/);
assert.match(html, /aria-controls="contact-content"/);
assert.match(html, /class="overview-section collapsible-section"[\s\S]+aria-expanded="true"[^>]+aria-controls="overview-content"[\s\S]+id="overview-content"[^>]*>/);
assert.doesNotMatch(html, /id="overview-content"[^>]+hidden/);
assert.match(html, /class="filter-panel collapsible-section collapsed"[\s\S]+aria-expanded="false"[^>]+aria-controls="filters-content"[\s\S]+id="filters-content"[^>]+hidden/);
assert.match(html, /class="contact-card collapsible-section collapsed"[\s\S]+aria-expanded="false"[^>]+aria-controls="contact-content"[\s\S]+id="contact-content"[^>]+hidden/);
assert.match(html, /data-i18n="contact\.eyebrow">Kontakt<\/span>[\s\S]+data-i18n="contact\.title">Napíšte nám<\/h2>/);
assert.match(html, /id="contact-name"[\s\S]+id="contact-email"[\s\S]+id="contact-message"[\s\S]+id="contact-submit"/);
assert.doesNotMatch(html, /mailto:/i);
const filterContent = html.match(/id="filters-content"[\s\S]*?<\/section>/)?.[0] || "";
const calendarContent = html.match(/id="calendar-content"[\s\S]*?<\/section>/)?.[0] || "";
assert.doesNotMatch(filterContent, /id="weekday-buttons"/);
assert.doesNotMatch(calendarContent, /id="weekday-buttons"|filters\.departureDay/);
assert.ok(html.indexOf('class="map-card') < html.indexOf('class="filter-panel'));
assert.ok(html.indexOf('class="filter-panel') < html.indexOf('class="calendar-card'));
assert.ok(html.indexOf('class="calendar-card') < html.indexOf('class="results-card'));
assert.doesNotMatch(css, /weekend-marker|weekend-legend|weekend-day|--weekend/);
assert.match(css, /\.single-range\s*\{[^}]*--range-to:\s*100%/);
assert.doesNotMatch(css, /\.planning-slider|\.dual-range/);
assert.match(css, /\.calendar-months\s*\{[^}]*grid-template-columns:\s*repeat\(2/);
assert.match(css, /max-width:\s*680px[\s\S]+\.calendar-months\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(css, /\.results-heading\s*\{[^}]*grid-template-areas:\s*"heading range travellers"/);
assert.match(css, /max-width:\s*680px[\s\S]+\.results-heading\s*\{[^}]*grid-template-areas:\s*"heading travellers" "range range"/);
assert.match(css, /\.table-note-bottom\s*\{[^}]*text-align:\s*right/);
assert.match(javascript, /function bindCollapsibleSections\(\)/);
assert.match(javascript, /map\.invalidateSize\(\)/);
assert.match(javascript, /class="detail-flight"[\s\S]+offer\.flight_number[\s\S]+class="detail-plane"[\s\S]+duration\(offer\.duration_minutes\)/);
assert.match(javascript, /t\("detail\.cheapestRoundTrip"\)[\s\S]+roundTripPrice/);
assert.match(javascript, /FlightBookingButtons\.createReturnButton/);
assert.match(javascript, /BookingComLinks\.createButton/);
assert.match(javascript, /adults:\s*state\.travellers/g);
assert.match(javascript, /groupPrice\(offer\.price\)/);
assert.match(javascript, /roundLogoUrls[\s\S]+assets\.ryanair\.com[\s\S]+Wizz_Air_logo_2015\.svg/);
assert.match(javascript, /roundAirlineLogo\(offer\.airline\)/);
assert.doesNotMatch(javascript, /class="booking-link|detail\.openAirline|airlineSites/);
assert.match(css, /\.detail-price > div:last-child\s*\{[^}]*text-align:\s*right/);
assert.match(html, /booking\/booking-com-config\.js[\s\S]+booking\/booking-com\.js[\s\S]+booking\/booking-buttons\.js[\s\S]+booking\/ryanair\.js[\s\S]+booking\/wizzair\.js[\s\S]+dashboard\.js/);
assert.match(css, /\.return-option\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 95px/);
assert.match(css, /max-width:\s*680px[\s\S]+\.return-option\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 83px/);
assert.match(css, /\.hotel-booking-link\s*\{[^}]*background:\s*#064b9e/);
assert.match(css, /\.return-option\s*\{[^}]*gap:\s*8px/);
assert.match(css, /\.return-flight-link\s*\{[^}]*border:\s*1px solid var\(--line\)[^}]*border-radius:\s*8px/);
assert.match(css, /\.return-airline-logo\s*\{[^}]*width:\s*30px[^}]*height:\s*30px[^}]*border-radius:\s*50%/);
assert.match(css, /\.return-airline-logo\.wizz\s*\{[^}]*linear-gradient/);
assert.doesNotMatch(css, /\.booking-link/);
assert.match(css, /\.hotel-booking-link\s*\{[^}]*border-radius:\s*8px/);
assert.match(css, /\.return-option\.cheapest \.return-flight-link\s*\{[^}]*background:\s*#f0fbf7/);
assert.match(javascript, /t\("detail\.country"\)[\s\S]+t\("detail\.distance"\)[\s\S]+t\("detail\.departure"\)[\s\S]+t\("detail\.arrival"\)/);
assert.match(javascript, /function numericDateWithWeekday\([\s\S]+padStart\(2, "0"\)[\s\S]+\$\{weekday\}/);
assert.match(javascript, /function returnDate\(value\)\s*\{\s*return numericDateWithWeekday\(value\);/);
assert.match(javascript, /detailDateTime\(offer\.departure_local\)[\s\S]+detailDateTime\(offer\.arrival_local\)/);
assert.doesNotMatch(javascript, /Cena za hodinu|<span>Číslo letu<\/span>|<span>Dĺžka letu<\/span>|<span>Typ ceny<\/span>|<span>Časy<\/span>/);
assert.match(css, /\.detail-flight\s*\{[^}]*flex-direction:\s*column/);
assert.match(css, /\.collapsible-content\[hidden\]\s*\{\s*display:\s*none !important;/);
assert.match(css, /\.map-card\.collapsed \.section-header\s*\{[^}]*flex-direction:\s*row/);
assert.match(css, /\.map-card\.collapsed \.map-actions\s*\{[^}]*width:\s*auto;[^}]*flex-direction:\s*column/);
assert.doesNotMatch(html, /data-max-price/);
assert.doesNotMatch(javascript, /plane-arrow|arrowPoint/);
assert.match(html, /class="language-switcher"[\s\S]+data-language="sk"[\s\S]+data-language="en"/);
assert.match(html, /i18n\/sk\.js[\s\S]+i18n\/en\.js[\s\S]+i18n\/i18n\.js[\s\S]+dashboard\.js/);
assert.match(css, /\.language-switcher button\.active\s*\{[^}]*background:\s*var\(--yellow\)/);
assert.match(css, /\.contact-content\s*\{[^}]*grid-template-columns:/);
assert.match(contactJavascript, /new URL\("\/api\/contact", window\.location\.origin\)/);
assert.match(contactJavascript, /turnstile\.render/);
assert.doesNotMatch(contactJavascript, /roman\.duris|gmail\.com/i);

console.log("Dashboard filters, branding and map routes: OK");
