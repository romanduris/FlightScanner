import assert from "node:assert/strict";
import test from "node:test";

import worker from "../src/index.js";

const ORIGIN = "https://btsflightscaner.rodulab.com";

function environment(send) {
  return {
    ALLOWED_ORIGIN: ORIGIN,
    EXPECTED_HOSTNAME: "btsflightscaner.rodulab.com",
    CONTACT_FROM_EMAIL: "contact@rodulab.com",
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
    assert.equal(sentMessage.from.email, "contact@rodulab.com");
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
