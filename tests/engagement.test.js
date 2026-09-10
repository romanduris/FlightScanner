"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

test("records repeated primary and middle clicks once, ignoring other auxiliary buttons", async () => {
  const handlers = {};
  const sent = [];
  const context = {
    crypto: { randomUUID: () => "test-session" },
    document: { visibilityState: "visible", addEventListener: (type, handler) => { handlers[type] = handler; } },
    performance: { now: () => 0 },
    location: { pathname: "/" },
    navigator: { sendBeacon: (url, body) => { sent.push(body); return true; } },
    Blob, window: {}, addEventListener() {}, setInterval() {},
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../HTML/statistics/engagement.js"), "utf8"), context);
  for (const provider of ["RYANAIR", "Wizz Air", "Booking.com"]) {
    const click = {
      button: 0,
      target: { closest: () => ({ dataset: { statClick: provider === "Booking.com" ? "booking_com" : "airline_booking", statProvider: provider } }) },
    };
    for (let i = 0; i < 10; i++) handlers.click(click);
    handlers.auxclick({ ...click, button: 1 });
    handlers.auxclick({ ...click, button: 2 });
    handlers.auxclick({ ...click, button: 3 });
  }
  handlers.click({ target: { closest: () => null } });
  const events = await Promise.all(sent.map(async body => JSON.parse(await body.text())));
  assert.equal(events.length, 33);
  for (const provider of ["RYANAIR", "Wizz Air", "Booking.com"]) {
    assert.equal(events.filter(event => event.provider === provider).length, 11);
  }
});
