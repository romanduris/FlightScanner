import assert from "node:assert/strict";
import test from "node:test";

import worker from "../src/index.js";

const ORIGIN = "https://btsflightscaner.rodulab.com";

function environment(send) {
  return {
    ALLOWED_ORIGIN: ORIGIN,
    EXPECTED_HOSTNAME: "btsflightscaner.rodulab.com",
    CONTACT_FROM_EMAIL: "contact@notify.rodulab.com",
    CONTACT_EMAIL: "owner@example.test",
    TURNSTILE_SECRET: "turnstile-secret",
    TURNSTILE_SITE_KEY: "turnstile-site-key",
    EMAIL: { send },
  };
}

function contactRequest(overrides = {}, origin = ORIGIN) {
  return new Request(`${ORIGIN}/api/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({
      name: "Roman Visitor",
      email: "visitor@example.com",
      message: "This is a useful message for the creators.",
      website: "",
      turnstileToken: "valid-token",
      page: "/?lang=en",
      language: "en",
      ...overrides,
    }),
  });
}

test("configuration exposes only the public Turnstile site key", async () => {
  const response = await worker.fetch(
    new Request(`${ORIGIN}/api/contact/config`),
    environment(async () => {}),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { turnstileSiteKey: "turnstile-site-key" });
});

test("requests from another origin are rejected", async () => {
  const response = await worker.fetch(
    contactRequest({}, "https://example.com"),
    environment(async () => assert.fail("email must not be sent")),
  );
  assert.equal(response.status, 403);
});

test("honeypot submissions are discarded without revealing the rejection", async () => {
  let sent = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => assert.fail("Turnstile must not be called");
  try {
    const response = await worker.fetch(contactRequest({ website: "spam.example" }), environment(async () => { sent = true; }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(sent, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a valid submission is verified and sent to the secret destination", async () => {
  let sentMessage = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
    assert.equal(options.method, "POST");
    assert.equal(options.body.get("secret"), "turnstile-secret");
    assert.equal(options.body.get("response"), "valid-token");
    return Response.json({ success: true, action: "contact", hostname: "btsflightscaner.rodulab.com" });
  };
  try {
    const response = await worker.fetch(contactRequest({ message: "Hello <script>alert(1)</script> creators!" }), environment(async (message) => {
      sentMessage = message;
      return { messageId: "test-message" };
    }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(sentMessage.to, "owner@example.test");
    assert.equal(sentMessage.from.email, "contact@notify.rodulab.com");
    assert.equal(sentMessage.replyTo.email, "visitor@example.com");
    assert.match(sentMessage.text, /Hello <script>alert\(1\)<\/script> creators!/);
    assert.doesNotMatch(sentMessage.html, /<script>/);
    assert.match(sentMessage.html, /&lt;script&gt;/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("an invalid Turnstile result prevents delivery", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ success: false });
  try {
    const response = await worker.fetch(contactRequest(), environment(async () => assert.fail("email must not be sent")));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { ok: false, error: "invalid_request" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("statistics combine GitHub runs with anonymous Cloudflare aggregates", async () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  Date.now = () => Date.parse("2026-09-09T12:00:00Z");
  let clicksQuery = "";
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes("api.github.com")) {
      return Response.json({ workflow_runs: [{
        id: 42,
        event: "schedule",
        status: "completed",
        conclusion: "success",
        run_started_at: "2026-09-04T08:00:00Z",
        updated_at: "2026-09-04T08:05:30Z",
        html_url: "https://github.com/example/run/42",
        head_sha: "abcdef123456",
      }] });
    }
    if (String(url).includes("/analytics_engine/sql") && String(options.body).includes("GROUP BY blob4")) {
      clicksQuery = String(options.body);
      return Response.json({ data: [
        { click_event: "offer_open", provider: "RYANAIR", clicks: 9 },
        { click_event: "offer_open", provider: "Wizz Air", clicks: 4 },
        { click_event: "airline_booking", provider: "RYANAIR", clicks: 3 },
        { click_event: "airline_booking", provider: "Wizz Air", clicks: 2 },
        { click_event: "booking_com", provider: "Booking.com", clicks: 5 },
      ] });
    }
    if (String(url).includes("/analytics_engine/sql")) {
      return Response.json({ data: [{ seconds: 240, sessions: 2 }] });
    }
    const body = JSON.parse(options.body);
    if (body.query.includes("query Traffic")) {
      if (body.variables.start > "2026-09-04") return Response.json({ data: { viewer: { accounts: [{}] } } });
      return Response.json({ data: { viewer: { accounts: [{
        totals: [{ count: 12, sum: { visits: 8 } }],
        trend: [{ count: 12, sum: { visits: 8 }, dimensions: { date: "2026-09-04" } }],
        countries: [{ count: 7, dimensions: { date: "2026-09-04", countryName: "SK" } }],
        devices: [{ count: 6, dimensions: { date: "2026-09-04", deviceType: "mobile" } }],
        browsers: [{ count: 8, dimensions: { date: "2026-09-04", userAgentBrowser: "Chrome" } }],
        operatingSystems: [{ count: 5, dimensions: { date: "2026-09-04", userAgentOS: "Android" } }],
        pages: [{ count: 12, dimensions: { date: "2026-09-04", requestPath: "/" } }],
        referrers: [{ count: 4, dimensions: { date: "2026-09-04", refererHost: "" } }],
      }] } } });
    }
    return Response.json({ data: { viewer: { accounts: [{
      performance: [{ avg: { pageLoadTime: 900000, firstContentfulPaint: 300000 } }],
      vitals: [{ avg: { largestContentfulPaint: 800000, interactionToNextPaint: 70000, cumulativeLayoutShift: 0.02, firstContentfulPaint: 280000 } }],
    }] } } });
  };
  try {
    const env = {
      ...environment(async () => {}),
      CLOUDFLARE_ACCOUNT_ID: "account-id",
      CLOUDFLARE_ANALYTICS_TOKEN: "analytics-token",
    };
    const response = await worker.fetch(new Request(`${ORIGIN}/api/statistics?days=7`), env);
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.github.runs[0].duration_seconds, 330);
    assert.equal(result.traffic.summary.visits, 8);
    assert.equal(result.traffic.summary.average_engagement_seconds, 120);
    assert.equal(result.traffic.summary.page_load_ms, 900);
    assert.equal(result.traffic.summary.lcp_ms, 800);
    assert.deepEqual(result.traffic.clicks, {
      available: true,
      offer_opens: 13,
      ryanair: 3,
      wizz_air: 2,
      booking_com: 5,
    });
    assert.match(clicksQuery, /SUM\(_sample_interval \* double2\) AS clicks/);
    assert.deepEqual(result.traffic.referrers[0], { label: "Direct", count: 4 });
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});

test("engagement stores only an ephemeral session, page, device, country and seconds", async () => {
  let point = null;
  const env = {
    ...environment(async () => {}),
    ENGAGEMENT: { writeDataPoint(value) { point = value; } },
  };
  const response = await worker.fetch(new Request(`${ORIGIN}/api/statistics/engagement`, {
    method: "POST",
    headers: { Origin: ORIGIN, "Content-Type": "application/json", "Sec-CH-UA-Mobile": "?1" },
    body: JSON.stringify({ session: "temporary-session", seconds: 30, path: "/statistics/" }),
  }), env);
  assert.equal(response.status, 202);
  assert.deepEqual(point, {
    blobs: ["/statistics/", "mobile", "XX"],
    doubles: [30],
    indexes: ["temporary-session"],
  });
});

test("click events store anonymous event and provider counters", async () => {
  let point = null;
  const env = {
    ...environment(async () => {}),
    ENGAGEMENT: { writeDataPoint(value) { point = value; } },
  };
  const response = await worker.fetch(new Request(`${ORIGIN}/api/statistics/engagement`, {
    method: "POST",
    headers: { Origin: ORIGIN, "Content-Type": "application/json", "Sec-CH-UA-Mobile": "?1" },
    body: JSON.stringify({
      session: "temporary-session",
      path: "/",
      event: "airline_booking",
      provider: "Wizz Air",
    }),
  }), env);
  assert.equal(response.status, 202);
  assert.deepEqual(point, {
    blobs: ["/", "mobile", "XX", "airline_booking", "Wizz Air"],
    doubles: [0, 1],
    indexes: ["temporary-session"],
  });
});

test("7/30/90-day totals share weekly rows, include boundaries once and match their trend", async () => {
  const originalFetch = globalThis.fetch, originalNow = Date.now, originalCaches = globalThis.caches;
  const now = Date.parse("2026-09-09T12:00:00Z"), day = 86400000;
  Date.now = () => now;
  const stored = new Map(), requests = [];
  globalThis.caches = { default: {
    async match(key) { return stored.get(key.url)?.clone(); },
    async put(key, value) { stored.set(key.url, value.clone()); },
  } };
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes("api.github.com")) return Response.json({ workflow_runs: [] });
    if (String(url).includes("analytics_engine/sql")) {
      assert.match(options.body, /timestamp >= toDateTime\('[\d-]+ 00:00:00'\) AND timestamp < toDateTime\('2026-09-09 12:00:00'\)/);
      return Response.json({ data: [] });
    }
    const { query, variables } = JSON.parse(options.body);
    if (!query.includes("query Traffic")) return Response.json({ data: { viewer: { accounts: [{}] } } });
    assert.match(query, /datetime_lt: \$end/);
    assert.equal(new Date(variables.start).getUTCDay(), 1);
    assert.ok(Date.parse(variables.end) - Date.parse(variables.start) <= 7 * day);
    requests.push(variables.start);
    const rows = [];
    for (let time = Date.parse(variables.start); time < Date.parse(variables.end); time += day) {
      rows.push({ count: 3, sum: { visits: 2 }, dimensions: { date: new Date(time).toISOString().slice(0, 10), countryName: "SK" } });
    }
    return Response.json({ data: { viewer: { accounts: [{ trend: rows, countries: rows }] } } });
  };
  try {
    const env = { ...environment(async () => {}), CLOUDFLARE_ACCOUNT_ID: "account", CLOUDFLARE_ANALYTICS_TOKEN: "token" };
    for (const days of [7, 30, 90, 7]) {
      const response = await worker.fetch(new Request(`${ORIGIN}/api/statistics?days=${days}`), env);
      const { traffic } = await response.json();
      assert.equal(traffic.available, true);
      assert.equal(traffic.trend.length, days);
      assert.equal(new Set(traffic.trend.map(p => p.date)).size, days);
      assert.equal(traffic.trend.at(-1).date, "2026-09-09");
      assert.equal(traffic.summary.visits, 2 * days);
      assert.equal(traffic.summary.pageviews, 3 * days);
      assert.equal(traffic.summary.visits, traffic.trend.reduce((sum, p) => sum + p.visits, 0));
      assert.equal(traffic.countries[0].count, 3 * days);
      assert.equal(traffic.range.days, days);
    }
    assert.equal(requests.length, new Set(requests).size, "overlapping weeks must come from the same cache");
    assert.ok(requests.length <= 14, "90 days need no more than 14 weekly requests");
    const fallback = await (await worker.fetch(new Request(`${ORIGIN}/api/statistics?days=1`), env)).json();
    assert.equal(fallback.traffic.range.days, 30);
  } finally {
    globalThis.fetch = originalFetch; Date.now = originalNow; globalThis.caches = originalCaches;
  }
});
