const CONTACT_PATH = "/api/contact";
const CONFIG_PATH = `${CONTACT_PATH}/config`;
const STATISTICS_PATH = "/api/statistics";
const ENGAGEMENT_PATH = `${STATISTICS_PATH}/engagement`;
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_REQUEST_BYTES = 16_384;
const GITHUB_RUNS_URL = "https://api.github.com/repos/romanduris/FlightScanner/actions/workflows/refresh-dashboard.yml/runs?per_page=40";
const GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";
const STATISTICS_CACHE_VERSION = "3";

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

function parseDate(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : null;
}

function runDuration(run) {
  if (run.status !== "completed") return null;
  const start = parseDate(run.run_started_at || run.created_at);
  const end = parseDate(run.updated_at);
  return start == null || end == null ? null : Math.max(0, Math.round((end - start) / 1000));
}

function compactRun(run) {
  return {
    id: run.id,
    event: run.event,
    status: run.status,
    conclusion: run.conclusion,
    started_at: run.run_started_at || run.created_at,
    updated_at: run.updated_at,
    duration_seconds: runDuration(run),
    url: run.html_url,
    commit: String(run.head_sha || "").slice(0, 7),
  };
}

async function fetchGithubRuns(env) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "BTSFLIGHTSCANER-statistics",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (env.GITHUB_STATS_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_STATS_TOKEN}`;
  const response = await fetch(GITHUB_RUNS_URL, { headers, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`github_${response.status}`);
  const data = await response.json();
  return (data.workflow_runs || []).map(compactRun);
}

const PAGELOAD_QUERY = `
  query Traffic($accountTag: string!, $start: Time!, $host: string!) {
    viewer { accounts(filter: { accountTag: $accountTag }) {
      totals: rumPageloadEventsAdaptiveGroups(limit: 1, filter: { datetime_geq: $start, requestHost: $host, bot: 0 }) { count sum { visits } }
      trend: rumPageloadEventsAdaptiveGroups(limit: 100, orderBy: [date_ASC], filter: { datetime_geq: $start, requestHost: $host, bot: 0 }) { count sum { visits } dimensions { date } }
      countries: rumPageloadEventsAdaptiveGroups(limit: 10, orderBy: [count_DESC], filter: { datetime_geq: $start, requestHost: $host, bot: 0 }) { count dimensions { countryName } }
      devices: rumPageloadEventsAdaptiveGroups(limit: 10, orderBy: [count_DESC], filter: { datetime_geq: $start, requestHost: $host, bot: 0 }) { count dimensions { deviceType } }
      browsers: rumPageloadEventsAdaptiveGroups(limit: 10, orderBy: [count_DESC], filter: { datetime_geq: $start, requestHost: $host, bot: 0 }) { count dimensions { userAgentBrowser } }
      operatingSystems: rumPageloadEventsAdaptiveGroups(limit: 10, orderBy: [count_DESC], filter: { datetime_geq: $start, requestHost: $host, bot: 0 }) { count dimensions { userAgentOS } }
      pages: rumPageloadEventsAdaptiveGroups(limit: 10, orderBy: [count_DESC], filter: { datetime_geq: $start, requestHost: $host, bot: 0 }) { count dimensions { requestPath } }
      referrers: rumPageloadEventsAdaptiveGroups(limit: 10, orderBy: [count_DESC], filter: { datetime_geq: $start, requestHost: $host, bot: 0 }) { count dimensions { refererHost } }
    } }
  }`;

const PERFORMANCE_QUERY = `
  query Performance($accountTag: string!, $start: Time!, $host: string!) {
    viewer { accounts(filter: { accountTag: $accountTag }) {
      performance: rumPerformanceEventsAdaptiveGroups(limit: 1, filter: { datetime_geq: $start, requestHost: $host, bot: 0 }) {
        avg { pageLoadTime firstContentfulPaint }
      }
      vitals: rumWebVitalsEventsAdaptiveGroups(limit: 1, filter: { datetime_geq: $start, requestHost: $host, bot: 0 }) {
        avg { largestContentfulPaint interactionToNextPaint cumulativeLayoutShift firstContentfulPaint }
      }
    } }
  }`;

async function graphql(env, query, variables) {
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CLOUDFLARE_ANALYTICS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`cloudflare_${response.status}`);
  const result = await response.json();
  if (result.errors?.length) throw new Error("cloudflare_graphql");
  return result.data?.viewer?.accounts?.[0] || {};
}

function aggregateGroups(groups, dimension) {
  const totals = new Map();
  for (const group of groups || []) {
    const label = String(group.dimensions?.[dimension] || "").trim() || "Direct";
    totals.set(label, (totals.get(label) || 0) + Number(group.count || 0));
  }
  return [...totals.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function aggregateTrend(groups) {
  const totals = new Map();
  for (const group of groups || []) {
    const date = group.dimensions?.date;
    if (!date) continue;
    const current = totals.get(date) || { date, visits: 0, pageviews: 0 };
    current.visits += Number(group.sum?.visits || 0);
    current.pageviews += Number(group.count || 0);
    totals.set(date, current);
  }
  return [...totals.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function microsecondsToMilliseconds(value) {
  return value == null ? null : Number(value) / 1000;
}

async function fetchEngagement(env, days) {
  if (!env.CLOUDFLARE_ANALYTICS_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) return null;
  const safeDays = [1, 7, 30, 90].includes(days) ? days : 30;
  const query = `SELECT SUM(double1) AS seconds, COUNT(DISTINCT index1) AS sessions FROM flightscanner_engagement WHERE timestamp >= NOW() - INTERVAL '${safeDays}' DAY AND double1 > 0`;
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/analytics_engine/sql`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.CLOUDFLARE_ANALYTICS_TOKEN}`, "Content-Type": "text/plain" },
    body: query,
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) return null;
  const result = await response.json();
  const row = result.data?.[0] || result.result?.data?.[0] || result.result?.[0];
  if (!row || !Number(row.sessions)) return null;
  return Number(row.seconds || 0) / Number(row.sessions);
}

async function fetchClicks(env, days) {
  const empty = { available: false, offer_opens: 0, ryanair: 0, wizz_air: 0, booking_com: 0 };
  if (!env.CLOUDFLARE_ANALYTICS_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) return empty;
  const safeDays = [1, 7, 30, 90].includes(days) ? days : 30;
  const query = `SELECT blob4 AS click_event, blob5 AS provider, SUM(double2) AS clicks FROM flightscanner_engagement WHERE timestamp >= NOW() - INTERVAL '${safeDays}' DAY AND double2 > 0 GROUP BY blob4, blob5`;
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/analytics_engine/sql`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.CLOUDFLARE_ANALYTICS_TOKEN}`, "Content-Type": "text/plain" },
    body: query,
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) return empty;
  const result = await response.json();
  const rows = result.data || result.result?.data || result.result || [];
  const totals = { ...empty, available: true };
  for (const row of Array.isArray(rows) ? rows : []) {
    const clicks = Number(row.clicks || 0);
    if (row.click_event === "offer_open") totals.offer_opens += clicks;
    if (row.click_event === "airline_booking" && row.provider === "RYANAIR") totals.ryanair += clicks;
    if (row.click_event === "airline_booking" && row.provider === "Wizz Air") totals.wizz_air += clicks;
    if (row.click_event === "booking_com") totals.booking_com += clicks;
  }
  return totals;
}

async function fetchTraffic(env, days) {
  if (!env.CLOUDFLARE_ANALYTICS_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID || !env.EXPECTED_HOSTNAME) {
    return { available: false, reason: "not_configured" };
  }
  const start = new Date(Date.now() - days * 86_400_000).toISOString();
  const variables = { accountTag: env.CLOUDFLARE_ACCOUNT_ID, start, host: env.EXPECTED_HOSTNAME };
  const [page, performance, engagement, clicks] = await Promise.all([
    graphql(env, PAGELOAD_QUERY, variables),
    graphql(env, PERFORMANCE_QUERY, variables),
    fetchEngagement(env, days),
    fetchClicks(env, days),
  ]);
  const total = page.totals?.[0] || {};
  const timings = performance.performance?.[0]?.avg || {};
  const vitals = performance.vitals?.[0]?.avg || {};
  return {
    available: true,
    summary: {
      visits: Number(total.sum?.visits || 0),
      pageviews: Number(total.count || 0),
      average_engagement_seconds: engagement,
      page_load_ms: microsecondsToMilliseconds(timings.pageLoadTime),
      fcp_ms: microsecondsToMilliseconds(vitals.firstContentfulPaint ?? timings.firstContentfulPaint),
      lcp_ms: microsecondsToMilliseconds(vitals.largestContentfulPaint),
      inp_ms: microsecondsToMilliseconds(vitals.interactionToNextPaint),
      cls: vitals.cumulativeLayoutShift ?? null,
    },
    trend: aggregateTrend(page.trend),
    countries: aggregateGroups(page.countries, "countryName"),
    devices: aggregateGroups(page.devices, "deviceType"),
    browsers: aggregateGroups(page.browsers, "userAgentBrowser"),
    operating_systems: aggregateGroups(page.operatingSystems, "userAgentOS"),
    pages: aggregateGroups(page.pages, "requestPath"),
    referrers: aggregateGroups(page.referrers, "refererHost"),
    clicks,
  };
}

async function handleStatistics(env, days) {
  const [githubResult, trafficResult] = await Promise.allSettled([
    fetchGithubRuns(env),
    fetchTraffic(env, days),
  ]);
  return {
    generated_at_utc: new Date().toISOString(),
    github: githubResult.status === "fulfilled" ? { runs: githubResult.value } : { runs: [], error: "unavailable" },
    traffic: trafficResult.status === "fulfilled" ? trafficResult.value : { available: false, reason: "unavailable" },
  };
}

async function recordEngagement(request, env, origin) {
  if (!env.ENGAGEMENT) return jsonResponse({ ok: false, error: "not_configured" }, 503, origin);
  if (origin !== env.ALLOWED_ORIGIN || !request.headers.get("Content-Type")?.includes("application/json")) {
    return jsonResponse({ ok: false, error: "forbidden" }, 403, origin);
  }
  try {
    const input = await request.json();
    const seconds = Math.round(Number(input.seconds));
    const session = cleanText(input.session, 64);
    const path = cleanText(input.path, 120);
    const event = cleanText(input.event, 32);
    const provider = cleanText(input.provider, 32);
    const allowedEvents = new Set(["offer_open", "airline_booking", "booking_com"]);
    if (event) {
      const validProvider = event === "booking_com"
        ? provider === "Booking.com"
        : ["RYANAIR", "Wizz Air"].includes(provider);
      if (!session || !path.startsWith("/") || !allowedEvents.has(event) || !validProvider) {
        return jsonResponse({ ok: false, error: "invalid_request" }, 400, origin);
      }
      const mobile = request.headers.get("Sec-CH-UA-Mobile") === "?1" ? "mobile" : "desktop";
      env.ENGAGEMENT.writeDataPoint({
        blobs: [path, mobile, request.cf?.country || "XX", event, provider],
        doubles: [0, 1],
        indexes: [session],
      });
      return jsonResponse({ ok: true }, 202, origin);
    }
    if (!session || !path.startsWith("/") || !Number.isFinite(seconds) || seconds < 1 || seconds > 120) {
      return jsonResponse({ ok: false, error: "invalid_request" }, 400, origin);
    }
    const mobile = request.headers.get("Sec-CH-UA-Mobile") === "?1" ? "mobile" : "desktop";
    env.ENGAGEMENT.writeDataPoint({
      blobs: [path, mobile, request.cf?.country || "XX"],
      doubles: [seconds],
      indexes: [session],
    });
    return jsonResponse({ ok: true }, 202, origin);
  } catch (_error) {
    return jsonResponse({ ok: false, error: "invalid_request" }, 400, origin);
  }
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

    if (url.pathname === STATISTICS_PATH && request.method === "GET") {
      const days = [1, 7, 30, 90].includes(Number(url.searchParams.get("days"))) ? Number(url.searchParams.get("days")) : 30;
      const cache = globalThis.caches?.default;
      const cacheKey = new Request(`${url.origin}${STATISTICS_PATH}?days=${days}&v=${STATISTICS_CACHE_VERSION}`, request);
      const cached = cache ? await cache.match(cacheKey) : null;
      if (cached) return cached;
      const response = jsonResponse(await handleStatistics(env, days));
      response.headers.set("Cache-Control", "public, max-age=300");
      if (cache) await cache.put(cacheKey, response.clone());
      return response;
    }

    if (url.pathname === ENGAGEMENT_PATH && request.method === "POST") {
      return recordEngagement(request, env, origin);
    }

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
