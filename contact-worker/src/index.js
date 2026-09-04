const CONTACT_PATH = "/api/contact";
const CONFIG_PATH = `${CONTACT_PATH}/config`;
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_REQUEST_BYTES = 16_384;

function jsonResponse(body, status = 200, origin = "") {
  const headers = {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] = "Content-Type";
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    headers.Vary = "Origin";
  }
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers });
}

function cleanText(value, maximumLength) {
  return typeof value === "string" ? value.trim().slice(0, maximumLength) : "";
}

function validEmail(value) {
  return value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

async function verifyTurnstile(request, env, token) {
  const verification = new URLSearchParams({
    secret: env.TURNSTILE_SECRET,
    response: token,
  });
  const remoteIp = request.headers.get("CF-Connecting-IP");
  if (remoteIp) verification.set("remoteip", remoteIp);

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: verification,
    signal: AbortSignal.timeout(7_000),
  });
  if (!response.ok) return false;

  const result = await response.json();
  return result.success === true
    && result.action === "contact"
    && result.hostname === env.EXPECTED_HOSTNAME;
}

function hasRequiredConfiguration(env) {
  return Boolean(
    env.EMAIL
    && env.CONTACT_EMAIL
    && env.CONTACT_FROM_EMAIL
    && env.TURNSTILE_SECRET
    && env.TURNSTILE_SITE_KEY
    && env.ALLOWED_ORIGIN
    && env.EXPECTED_HOSTNAME,
  );
}

async function sendContactEmail(env, fields) {
  const senderName = fields.name.replace(/[\r\n]+/g, " ");
  const page = fields.page || "—";
  const text = [
    "Nová správa z BTSFLIGHTSCANER",
    "",
    `Meno: ${senderName}`,
    `E-mail: ${fields.email}`,
    `Jazyk stránky: ${fields.language}`,
    `Stránka: ${page}`,
    "",
    fields.message,
  ].join("\n");
  const html = `
    <h2>Nová správa z BTSFLIGHTSCANER</h2>
    <p><strong>Meno:</strong> ${escapeHtml(senderName)}<br>
    <strong>E-mail:</strong> ${escapeHtml(fields.email)}<br>
    <strong>Jazyk stránky:</strong> ${escapeHtml(fields.language)}<br>
    <strong>Stránka:</strong> ${escapeHtml(page)}</p>
    <p style="white-space:pre-wrap">${escapeHtml(fields.message)}</p>`;

  await env.EMAIL.send({
    to: env.CONTACT_EMAIL,
    from: { email: env.CONTACT_FROM_EMAIL, name: "BTSFLIGHTSCANER" },
    replyTo: { email: fields.email, name: senderName },
    subject: "Nová správa z BTSFLIGHTSCANER",
    text,
    html,
  });
}

async function handleContactRequest(request, env, origin) {
  if (!hasRequiredConfiguration(env)) {
    return jsonResponse({ ok: false, error: "not_configured" }, 503, origin);
  }

  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_REQUEST_BYTES || !request.headers.get("Content-Type")?.includes("application/json")) {
    return jsonResponse({ ok: false, error: "invalid_request" }, 400, origin);
  }

  let input;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      return jsonResponse({ ok: false, error: "invalid_request" }, 400, origin);
    }
    input = JSON.parse(rawBody);
  } catch (_error) {
    return jsonResponse({ ok: false, error: "invalid_request" }, 400, origin);
  }

  const fields = {
    name: cleanText(input.name, 80),
    email: cleanText(input.email, 254).toLowerCase(),
    message: cleanText(input.message, 2_000),
    website: cleanText(input.website, 200),
    turnstileToken: cleanText(input.turnstileToken, 2_048),
    page: cleanText(input.page, 500),
    language: input.language === "en" ? "en" : "sk",
  };

  if (fields.website) return jsonResponse({ ok: true }, 200, origin);
  if (fields.name.length < 2 || !validEmail(fields.email) || fields.message.length < 10 || !fields.turnstileToken) {
    return jsonResponse({ ok: false, error: "invalid_request" }, 400, origin);
  }

  let verified = false;
  try {
    verified = await verifyTurnstile(request, env, fields.turnstileToken);
  } catch (_error) {
    return jsonResponse({ ok: false, error: "verification_failed" }, 503, origin);
  }
  if (!verified) return jsonResponse({ ok: false, error: "invalid_request" }, 400, origin);

  try {
    await sendContactEmail(env, fields);
  } catch (error) {
    if (error?.code === "E_RATE_LIMIT_EXCEEDED" || error?.code === "E_DAILY_LIMIT_EXCEEDED") {
      return jsonResponse({ ok: false, error: "rate_limited" }, 429, origin);
    }
    console.error("Contact email delivery failed", error?.code || "unknown_error");
    return jsonResponse({ ok: false, error: "delivery_failed" }, 502, origin);
  }

  return jsonResponse({ ok: true }, 200, origin);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = env.ALLOWED_ORIGIN || "";

    if (url.pathname === CONFIG_PATH && request.method === "GET") {
      if (!env.TURNSTILE_SITE_KEY) return jsonResponse({ ok: false, error: "not_configured" }, 503);
      return jsonResponse({ turnstileSiteKey: env.TURNSTILE_SITE_KEY });
    }

    if (url.pathname !== CONTACT_PATH) return jsonResponse({ ok: false, error: "not_found" }, 404);
    if (request.method === "OPTIONS") {
      return origin === allowedOrigin
        ? jsonResponse({ ok: true }, 204, origin)
        : jsonResponse({ ok: false, error: "forbidden" }, 403);
    }
    if (request.method !== "POST") return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
    if (!allowedOrigin || origin !== allowedOrigin) {
      return jsonResponse({ ok: false, error: "forbidden" }, 403);
    }

    return handleContactRequest(request, env, origin);
  },
};
