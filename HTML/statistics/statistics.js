(() => {
  "use strict";

  const copy = {
    sk: {
      back: "← Späť na lety", eyebrow: "Štatistiky", title: "Ako funguje BTSFLIGHTSCANER",
      subtitle: "Návštevnosť stránky, aktuálnosť letových dát a história automatických zberov.",
      trafficEyebrow: "Návštevnosť", trafficTitle: "Ľudia na stránke", loading: "Načítavam…",
      visits: "Návštevy", humanTraffic: "bez automatizovaných botov", pageviews: "Zobrazenia", pagesOpened: "otvorené stránky",
      pagesPerVisit: "Stránky / návštevu", visitAverage: "priemer za návštevu", engagement: "Čas na stránke", engagementNote: "aktívny priemer",
      mobileShare: "Mobilné zariadenia", trafficShare: "podiel návštevnosti", analyticsUnavailable: "Cloudflare štatistiky zatiaľ nie sú pripojené",
      analyticsUnavailableBody: "Letové a GitHub štatistiky nižšie fungujú ďalej.", trafficTrend: "Vývoj návštevnosti",
      countries: "Krajiny", devices: "Zariadenia", browsers: "Prehliadače", operatingSystems: "Operačné systémy", topPages: "Najnavštevovanejšie stránky", sources: "Zdroje návštev",
      performanceEyebrow: "Výkon", performanceTitle: "Rýchlosť a stabilita stránky", realVisitors: "merané u skutočných návštevníkov",
      pageLoad: "Načítanie stránky", average: "priemer", largestContent: "hlavný obsah", interaction: "odozva interakcií", layoutStability: "stabilita rozloženia", firstContent: "prvý obsah",
      scannerEyebrow: "Letové dáta", scannerTitle: "Aktuálny zber", flightsFound: "Nájdené lety", routes: "Trasy", directDestinations: "priame destinácie",
      directConnections: "priame spojenia", returnFlights: "Spiatočné lety", possibleReturns: "nájdené návraty", providerErrors: "Chyby poskytovateľov", latestScan: "posledný zber",
      dataThrough: "Dáta do", cheapestFlight: "Najlacnejší nájdený let", averagePrice: "Priemerná jednosmerná cena", allAvailableFlights: "všetky dostupné odlety",
      routeChanges: "Zmeny trás", runsTitle: "Posledné behy automatizácie", successRate: "úspešnosť", averageDuration: "priemerné trvanie zberu",
      started: "Spustené", type: "Typ", state: "Stav", duration: "Trvanie", details: "Detail", historyNote: "Počty letov sa ukladajú od zavedenia tejto stránky. Staršie behy preto môžu mať iba čas a stav.",
      privacy: "súkromie bez cookies a sledovania jednotlivcov", live: "Aktuálne dáta", noData: "Zatiaľ bez dát", direct: "Priamy vstup", scan: "Zber dát", deploy: "Nasadenie", manual: "Ručný zber",
      success: "Úspešný", failure: "Chyba", cancelled: "Zrušený", in_progress: "Prebieha", queued: "Čaká", open: "Otvoriť", days: "dní", ago: "dozadu",
      newRoutes: "nové", removedRoutes: "odstránené", noChanges: "Bez zmeny oproti predošlému zberu", flights: "lety", returns: "návraty", errors: "chyby",
    },
    en: {
      back: "← Back to flights", eyebrow: "Statistics", title: "How BTSFLIGHTSCANER works",
      subtitle: "Website traffic, flight data freshness and the history of automated scans.",
      trafficEyebrow: "Traffic", trafficTitle: "People on the website", loading: "Loading…",
      visits: "Visits", humanTraffic: "automated bots excluded", pageviews: "Page views", pagesOpened: "pages opened",
      pagesPerVisit: "Pages / visit", visitAverage: "average per visit", engagement: "Time on page", engagementNote: "active average",
      mobileShare: "Mobile devices", trafficShare: "share of traffic", analyticsUnavailable: "Cloudflare statistics are not connected yet",
      analyticsUnavailableBody: "Flight and GitHub statistics below remain available.", trafficTrend: "Traffic trend",
      countries: "Countries", devices: "Devices", browsers: "Browsers", operatingSystems: "Operating systems", topPages: "Most visited pages", sources: "Traffic sources",
      performanceEyebrow: "Performance", performanceTitle: "Website speed and stability", realVisitors: "measured for real visitors",
      pageLoad: "Page load", average: "average", largestContent: "main content", interaction: "interaction response", layoutStability: "layout stability", firstContent: "first content",
      scannerEyebrow: "Flight data", scannerTitle: "Current scan", flightsFound: "Flights found", routes: "Routes", directDestinations: "direct destinations",
      directConnections: "direct connections", returnFlights: "Return flights", possibleReturns: "returns found", providerErrors: "Provider errors", latestScan: "latest scan",
      dataThrough: "Data through", cheapestFlight: "Cheapest flight found", averagePrice: "Average one-way price", allAvailableFlights: "all available departures",
      routeChanges: "Route changes", runsTitle: "Latest automation runs", successRate: "success rate", averageDuration: "average scan duration",
      started: "Started", type: "Type", state: "Status", duration: "Duration", details: "Details", historyNote: "Flight counts are stored from the launch of this page. Older runs may only show their time and status.",
      privacy: "privacy without cookies or individual tracking", live: "Live data", noData: "No data yet", direct: "Direct", scan: "Data scan", deploy: "Deployment", manual: "Manual scan",
      success: "Successful", failure: "Failed", cancelled: "Cancelled", in_progress: "Running", queued: "Queued", open: "Open", days: "days", ago: "ago",
      newRoutes: "new", removedRoutes: "removed", noChanges: "No change since the previous scan", flights: "flights", returns: "returns", errors: "errors",
    },
  };

  const queryLanguage = new URLSearchParams(location.search).get("lang");
  let language = queryLanguage === "en" ? "en" : "sk";
  let days = 30;
  let staticData = null;
  let liveData = null;

  const text = (key) => copy[language][key] || copy.sk[key] || key;
  const byId = (id) => document.getElementById(id);
  const number = (value, digits = 0) => value == null || !Number.isFinite(Number(value))
    ? "—"
    : new Intl.NumberFormat(language === "sk" ? "sk-SK" : "en-GB", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(Number(value));
  const money = (value) => value == null ? "—" : new Intl.NumberFormat(language === "sk" ? "sk-SK" : "en-IE", { style: "currency", currency: "EUR" }).format(value);
  const date = (value, withTime = false) => {
    if (!value) return "—";
    const parsed = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
    if (Number.isNaN(parsed.getTime())) return "—";
    return new Intl.DateTimeFormat(language === "sk" ? "sk-SK" : "en-GB", withTime
      ? { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Bratislava" }
      : { day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed);
  };
  const duration = (seconds) => {
    if (seconds == null) return "—";
    const minutes = Math.floor(seconds / 60);
    const rest = Math.round(seconds % 60);
    return minutes ? `${minutes} min ${rest} s` : `${rest} s`;
  };
  const milliseconds = (value) => value == null ? "—" : value >= 1000 ? `${number(value / 1000, 2)} s` : `${number(value)} ms`;

  function applyLanguage() {
    document.documentElement.lang = language;
    document.querySelectorAll("[data-text]").forEach((element) => { element.textContent = text(element.dataset.text); });
    document.querySelectorAll("[data-lang]").forEach((button) => button.classList.toggle("active", button.dataset.lang === language));
    const url = new URL(location.href);
    url.searchParams.set("lang", language);
    history.replaceState(null, "", url);
    if (staticData) renderAll();
  }

  function setMetric(id, value) { byId(id).textContent = value; }

  function barList(id, values, valueKey = "count") {
    const target = byId(id);
    target.replaceChildren();
    if (!values?.length) {
      const empty = document.createElement("span");
      empty.className = "muted";
      empty.textContent = text("noData");
      target.append(empty);
      return;
    }
    const maximum = Math.max(...values.map((item) => Number(item[valueKey]) || 0), 1);
    values.slice(0, 6).forEach((item) => {
      const row = document.createElement("div");
      row.className = "bar-row";
      const label = document.createElement("span");
      label.title = item.label || "—";
      label.textContent = item.label || "—";
      const track = document.createElement("span");
      track.className = "bar-track";
      const fill = document.createElement("i");
      fill.style.width = `${Math.max(2, (Number(item[valueKey]) || 0) / maximum * 100)}%`;
      track.append(fill);
      const amount = document.createElement("b");
      amount.textContent = number(item[valueKey]);
      row.append(label, track, amount);
      target.append(row);
    });
  }

  function countryName(code) {
    try {
      return new Intl.DisplayNames([language === "sk" ? "sk" : "en"], { type: "region" }).of(code) || code;
    } catch (_error) {
      return code;
    }
  }

  function renderChart(points) {
    const target = byId("traffic-chart");
    if (!points?.length) {
      target.className = "line-chart empty-chart";
      target.dataset.empty = text("noData");
      target.replaceChildren();
      return;
    }
    target.className = "line-chart";
    const width = 1000, height = 180, left = 34, right = 8, top = 10, bottom = 25;
    const max = Math.max(...points.flatMap((item) => [item.visits || 0, item.pageviews || 0]), 1);
    const x = (index) => left + (points.length === 1 ? (width - left - right) / 2 : index * (width - left - right) / (points.length - 1));
    const y = (value) => top + (height - top - bottom) * (1 - value / max);
    const line = (key) => points.map((item, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(item[key] || 0).toFixed(1)}`).join(" ");
    const labels = points.length <= 8 ? points : points.filter((_, index) => index % Math.ceil(points.length / 7) === 0 || index === points.length - 1);
    const svg = `
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${text("trafficTrend")}">
        <defs><linearGradient id="traffic-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#133f91"/><stop offset="1" stop-color="#fff"/></linearGradient></defs>
        ${[0, .25, .5, .75, 1].map((part) => `<line class="grid" x1="${left}" y1="${y(max * part)}" x2="${width - right}" y2="${y(max * part)}"/><text class="axis-label" x="0" y="${y(max * part) + 3}">${Math.round(max * part)}</text>`).join("")}
        <path class="area" d="${line("visits")} L${x(points.length - 1)},${height - bottom} L${x(0)},${height - bottom} Z"/>
        <path class="visits-line" d="${line("visits")}"/><path class="views-line" d="${line("pageviews")}"/>
        ${labels.map((item) => { const index = points.indexOf(item); return `<text class="axis-label" text-anchor="middle" x="${x(index)}" y="${height - 5}">${date(item.date).slice(0, 5)}</text>`; }).join("")}
      </svg>`;
    target.innerHTML = svg;
  }

  function renderTraffic() {
    const traffic = liveData?.traffic;
    const available = traffic?.available === true;
    byId("traffic-unavailable").hidden = available;
    byId("traffic-state").textContent = available ? text("live") : text("noData");
    byId("traffic-state").classList.toggle("loading", !available);
    const summary = traffic?.summary || {};
    setMetric("metric-visits", available ? number(summary.visits) : "—");
    setMetric("metric-pageviews", available ? number(summary.pageviews) : "—");
    setMetric("metric-ratio", available && summary.visits ? number(summary.pageviews / summary.visits, 1) : "—");
    setMetric("metric-engagement", summary.average_engagement_seconds == null ? "—" : duration(summary.average_engagement_seconds));
    const mobile = (traffic?.devices || []).find((item) => item.label?.toLowerCase() === "mobile")?.count || 0;
    const allDevices = (traffic?.devices || []).reduce((sum, item) => sum + (item.count || 0), 0);
    setMetric("metric-mobile", available && allDevices ? `${number(mobile / allDevices * 100)} %` : "—");
    setMetric("metric-load", milliseconds(summary.page_load_ms));
    setMetric("metric-lcp", milliseconds(summary.lcp_ms));
    setMetric("metric-inp", milliseconds(summary.inp_ms));
    setMetric("metric-cls", summary.cls == null ? "—" : number(summary.cls, 3));
    setMetric("metric-fcp", milliseconds(summary.fcp_ms));
    renderChart(traffic?.trend || []);
    barList("country-list", (traffic?.countries || []).map((item) => ({ ...item, label: countryName(item.label) })));
    barList("device-list", traffic?.devices);
    barList("browser-list", traffic?.browsers);
    barList("os-list", traffic?.operating_systems);
    barList("page-list", traffic?.pages);
    barList("referrer-list", traffic?.referrers);
  }

  function scanAge(value) {
    const elapsed = Date.now() - new Date(value).getTime();
    if (!Number.isFinite(elapsed)) return "—";
    const hours = Math.max(0, Math.floor(elapsed / 3_600_000));
    return language === "sk" ? `Aktualizované pred ${hours} h` : `Updated ${hours} h ago`;
  }

  function renderScanner() {
    const current = staticData?.current || {};
    setMetric("scan-flights", number(current.flights));
    setMetric("scan-routes", number(current.routes));
    setMetric("scan-countries", number(current.countries));
    setMetric("scan-returns", number(current.return_flights));
    setMetric("scan-errors", number(current.failures));
    setMetric("scan-through", date(current.period_end));
    setMetric("scan-days", current.scan_days ? `${current.scan_days} ${text("days")}` : "—");
    setMetric("scan-period", `${date(current.period_start)} – ${date(current.period_end)}`);
    byId("scan-freshness").textContent = scanAge(current.scanned_at_utc);
    const cheapest = current.cheapest_one_way;
    setMetric("cheapest-flight", cheapest ? `${money(cheapest.price)} · ${cheapest.destination}` : "—");
    setMetric("cheapest-detail", cheapest ? `${date(cheapest.date)} · ${cheapest.airline}` : "—");
    setMetric("average-price", money(current.average_one_way_price));
    const additions = current.new_routes || [];
    const removals = current.removed_routes || [];
    setMetric("route-changes", additions.length || removals.length ? `+${additions.length} / −${removals.length}` : "0");
    setMetric("route-change-detail", additions.length || removals.length
      ? `${text("newRoutes")}: ${additions.join(", ") || "—"} · ${text("removedRoutes")}: ${removals.join(", ") || "—"}`
      : text("noChanges"));
    const target = byId("airline-grid");
    target.replaceChildren();
    (current.airlines || []).forEach((airline) => {
      const card = document.createElement("article");
      card.className = "airline-card";
      const display = airline.airline === "RYANAIR" ? "RYANAIR" : "Wizz Air";
      card.innerHTML = `<strong class="airline-name ${airline.airline === "Wizz Air" ? "wizz" : ""}">${display}</strong>
        <span class="airline-stat"><span>${text("routes")}</span><b>${number(airline.routes)}</b></span>
        <span class="airline-stat"><span>${text("flights")}</span><b>${number(airline.flights)}</b></span>
        <span class="airline-stat"><span>${text("returns")}</span><b>${number(airline.returns)}</b></span>
        <span class="airline-stat"><span>${text("errors")}</span><b>${number(airline.failures)}</b></span>`;
      target.append(card);
    });
  }

  function findSnapshot(run, history) {
    if (!run.started_at || !["schedule", "workflow_dispatch"].includes(run.event)) return null;
    const start = new Date(run.started_at).getTime();
    const end = new Date(run.updated_at || run.started_at).getTime() + 20 * 60_000;
    return history.find((item) => {
      const scanned = new Date(item.scanned_at_utc).getTime();
      return scanned >= start - 5 * 60_000 && scanned <= end;
    }) || null;
  }

  function renderRuns() {
    const runs = liveData?.github?.runs?.length ? liveData.github.runs : (staticData?.action_runs || []);
    const history = staticData?.scan_history || [];
    const completed = runs.filter((run) => run.status === "completed");
    const successful = completed.filter((run) => run.conclusion === "success");
    const scans = completed.filter((run) => ["schedule", "workflow_dispatch"].includes(run.event) && run.duration_seconds != null);
    setMetric("success-rate", completed.length ? `${number(successful.length / completed.length * 100)} %` : "—");
    setMetric("average-duration", scans.length ? duration(scans.reduce((sum, run) => sum + run.duration_seconds, 0) / scans.length) : "—");
    const body = byId("runs-table");
    body.replaceChildren();
    runs.slice(0, 20).forEach((run) => {
      const snapshot = findSnapshot(run, history);
      const type = run.event === "schedule" ? text("scan") : run.event === "workflow_dispatch" ? text("manual") : text("deploy");
      const stateKey = run.status !== "completed" ? run.status : run.conclusion;
      const row = document.createElement("tr");
      row.innerHTML = `<td><strong>${date(run.started_at, true)}</strong><small>${run.commit || ""}</small></td>
        <td><span class="run-type">${type}</span></td>
        <td><span class="status ${stateKey}">${text(stateKey)}</span></td>
        <td>${duration(run.duration_seconds)}</td>
        <td>${snapshot ? number(snapshot.routes) : "—"}</td>
        <td>${snapshot ? number(snapshot.flights) : "—"}</td>
        <td><a class="detail-link" href="${run.url}" target="_blank" rel="noopener">${text("open")} ↗</a></td>`;
      body.append(row);
    });
  }

  function renderAll() {
    renderTraffic();
    renderScanner();
    renderRuns();
  }

  async function loadLiveData() {
    try {
      const response = await fetch(`/api/statistics?days=${days}`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      liveData = await response.json();
    } catch (_error) {
      liveData = { traffic: { available: false }, github: { runs: staticData?.action_runs || [] } };
    }
    renderAll();
  }

  document.querySelectorAll("[data-lang]").forEach((button) => button.addEventListener("click", () => { language = button.dataset.lang; applyLanguage(); }));
  document.querySelectorAll("[data-days]").forEach((button) => button.addEventListener("click", async () => {
    days = Number(button.dataset.days);
    document.querySelectorAll("[data-days]").forEach((item) => item.classList.toggle("active", item === button));
    byId("traffic-state").textContent = text("loading");
    byId("traffic-state").classList.add("loading");
    await loadLiveData();
  }));

  applyLanguage();
  Promise.all([
    fetch("data.json", { cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }),
  ]).then(([data]) => {
    staticData = data;
    renderAll();
    return loadLiveData();
  }).catch(() => {
    staticData = { current: {}, scan_history: [], action_runs: [] };
    renderAll();
    loadLiveData();
  });
})();
