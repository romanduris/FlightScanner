"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function app(query = "", writeText = async () => {}) {
  const elements = new Map();
  function element(key) {
    if (!elements.has(key)) elements.set(key, {
      value: "", innerHTML: "", textContent: "", hidden: false, listeners: {}, dataset: {},
      style: { setProperty() {} }, classList: { toggle() {}, add() {}, remove() {} },
      setAttribute() {}, addEventListener(type, handler) { this.listeners[type] = handler; },
      querySelector() { return null; }, querySelectorAll() { return []; },
      showModal() { this.open = true; },
      focus() {}, select() {},
    });
    return elements.get(key);
  }
  const offers = Array.from({ length: 65 }, (_, i) => ({
    airline: "Wizz Air", origin_iata: "BTS", destination_iata: "ATH", destination_name: "ATÉNY", country_code: "GR", country: "Grécko",
    flight_number: `W${i}`, departure_local: "2026-09-18T08:00", arrival_local: "2026-09-18T10:00", duration_minutes: 120, price: i + 10,
    return_offers: i < 3 ? [{ departure_local: `2026-09-${[20, 23, 27][i]}T10:00`, price: [50, 20, 10][i], origin_iata: "ATH" }] : [],
  }));
  const location = new URL(`https://example.com/${query}`);
  const window = {
    FLIGHTSCANNER_TODAY: "2026-09-18", location,
    history: { replaceState(_state, _title, url) { location.href = String(url); } },
    FLIGHT_DATA: { offers, start_date: "2026-09-01", end_date: "2026-11-30", scan_days: 91, return_window_days: 10, scanned_at_utc: "2026-09-18T06:00:00Z", origin: {latitude: 48, longitude: 17} },
    FlightBookingButtons: { createReturnButton: ({content}) => content },
    BookingComLinks: {createButton: () => ""},
  };
  const context = vm.createContext({ window, URL, URLSearchParams, Intl, navigator: { clipboard: { writeText } }, document: {querySelector: element, querySelectorAll: () => [], documentElement: {}}, console });
  for (const name of ["i18n/sk.js", "i18n/en.js", "i18n/i18n.js", "dashboard.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../HTML", name), "utf8"), context);
  }
  const change = (id, value) => { const el = element(id); el.value = value; el.listeners.change({target: el}); };
  const rows = () => (element("#flight-rows").innerHTML.match(/<tr /g) || []).length;
  return { element, change, rows, location, offers };
}

test("pagination reveals 30 at a time and filters reset the visible count", () => {
  const page = app();
  assert.equal(page.rows(), 30);
  page.element("#more-offers").listeners.click();
  assert.equal(page.rows(), 60);
  page.element("#more-offers").listeners.click();
  assert.equal(page.rows(), 65);
  assert.equal(page.element("#more-offers").hidden, true);
  page.change("#sort-filter", "price");
  assert.equal(page.rows(), 30);
});

test("compact fares omit one-way labels and keep the return price beside its label", () => {
  const html = app().element("#flight-rows").innerHTML;
  assert.doesNotMatch(html, /fare-label|jednosmerne/);
  assert.match(html, /Spiatočne od <b>/);
});

test("sharing copies silently but keeps the manual fallback when clipboard access fails", async () => {
  let copied;
  const page = app("", async (url) => { copied = url; });
  await page.element("#share-search").listeners.click();
  assert.match(copied, /from=/);
  assert.equal(page.element("#share-status").hidden, true);
  assert.equal(page.element("#share-status").textContent, "");
  assert.equal(page.element("#share-fallback").hidden, true);
  const denied = app("", async () => { throw new Error("denied"); });
  await denied.element("#share-search").listeners.click();
  assert.equal(denied.element("#share-fallback").hidden, false);
  assert.equal(denied.element("#share-status").hidden, false);
  assert.match(denied.element("#share-url").value, /from=/);
});

test("stay and weekend filters use matching returns and round-trip sort keeps missing returns last", () => {
  const page = app();
  page.change("#stay-filter", "5-8");
  assert.equal(page.rows(), 1);
  assert.match(page.element("#flight-rows").innerHTML, /31,00/);
  page.element("#weekend-filter").checked = true;
  page.element("#weekend-filter").listeners.change();
  assert.equal(page.rows(), 0);
  page.change("#stay-filter", "");
  assert.equal(page.rows(), 1);
  assert.match(page.element("#flight-rows").innerHTML, /60,00/);
  page.element("#reset-filters").listeners.click();
  assert.equal(page.rows(), 30);
  page.change("#sort-filter", "round_trip");
  const html = page.element("#flight-rows").innerHTML;
  assert.ok(html.indexOf('>W2<') < html.indexOf('>W1<'));
  assert.ok(html.indexOf('>W1<') < html.indexOf('>W0<'));
});

test("a shared search restores dates, travellers and filters, and a shared offer opens the matching detail", () => {
  const page = app();
  page.change("#stay-filter", "5-8");
  page.element("#traveller-plus").listeners.click();
  const restored = app(page.location.search);
  assert.equal(restored.rows(), 1);
  assert.equal(restored.element("#traveller-count").value, 2);
  assert.match(restored.element("#flight-rows").innerHTML, /62,00/);
  const params = new URLSearchParams(page.location.search);
  params.set("offer", "Wizz Air|ATH|2026-09-18T08:00|W1");
  const detail = app(`?${params}`);
  assert.equal(detail.element("#flight-detail").open, true);
  assert.match(detail.element("#detail-content").innerHTML, /23\.09\.2026/);
  assert.doesNotMatch(detail.element("#detail-content").innerHTML, /class="return-price"/);
  assert.match(detail.element("#detail-content").innerHTML, /class="return-total"[^]*?<strong>62,00/);
  const expired = app("?offer=missing");
  assert.equal(expired.element("#share-status").hidden, false);
});

test("malformed shared filters fall back to usable defaults", () => {
  const page = app("?from=bad&to=2026-99-99&price=NaN&travellers=999&stay=bad&sort=bad&destination=ZZZ");
  assert.equal(page.rows(), 30);
  assert.equal(page.element("#traveller-count").value, 9);
  assert.equal(page.element("#destination-filter").value, "");
});
