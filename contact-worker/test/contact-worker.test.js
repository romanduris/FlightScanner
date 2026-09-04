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
    if (String(url).includes("/analytics_engine/sql")) {
      return Response.json({ data: [{ seconds: 240, sessions: 2 }] });
    }
    const body = JSON.parse(options.body);
    if (body.query.includes("query Traffic")) {
      return Response.json({ data: { viewer: { accounts: [{
        totals: [{ count: 12, sum: { visits: 8 } }],
        trend: [{ count: 12, sum: { visits: 8 }, dimensions: { date: "2026-09-04" } }],
        countries: [{ count: 7, dimensions: { countryName: "SK" } }],
        devices: [{ count: 6, dimensions: { deviceType: "mobile" } }],
        browsers: [{ count: 8, dimensions: { userAgentBrowser: "Chrome" } }],
        operatingSystems: [{ count: 5, dimensions: { userAgentOS: "Android" } }],
        pages: [{ count: 12, dimensions: { requestPath: "/" } }],
        referrers: [{ count: 4, dimensions: { refererHost: "" } }],
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
    assert.deepEqual(result.traffic.referrers[0], { label: "Direct", count: 4 });
  } finally {
    globalThis.fetch = originalFetch;
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
