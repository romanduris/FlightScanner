(() => {
  "use strict";

  const copy = {
    sk: {
      back: "← Späť na lety", eyebrow: "Štatistiky", title: "BTSFLIGHTSCANER",
      subtitle: "Návštevnosť, interakcie a história automatických zberov.",
      trafficEyebrow: "Návštevnosť", trafficTitle: "Ľudia na stránke", loading: "Načítavam…",
      visits: "Návštevy", humanTraffic: "príchody",
      engagement: "Čas na webe", engagementNote: "priemer m:ss",
      mobileShare: "Mobily", trafficShare: "podiel", analyticsUnavailable: "Cloudflare štatistiky zatiaľ nie sú pripojené",
      analyticsUnavailableBody: "História automatizácie nižšie funguje ďalej.", trafficTrend: "Vývoj návštevnosti",
      countries: "Krajiny", devices: "Zariadenia", browsers: "Prehliadače", operatingSystems: "Operačné systémy", topPages: "Najnavštevovanejšie stránky", sources: "Zdroje návštev",
      performanceEyebrow: "Výkon", performanceTitle: "Rýchlosť a stabilita", realVisitors: "merané u skutočných návštevníkov",
      pageLoad: "Načítanie stránky", average: "priemer", largestContent: "hlavný obsah", interaction: "odozva interakcií", layoutStability: "stabilita rozloženia", firstContent: "prvý obsah",
      scannerEyebrow: "Letové dáta", scannerTitle: "Aktuálny zber", flightsFound: "Nájdené lety", routes: "Trasy", directDestinations: "priame destinácie",
      directConnections: "priame spojenia", returnFlights: "Spiatočné lety", possibleReturns: "nájdené návraty", providerErrors: "Chyby poskytovateľov", latestScan: "posledný zber",
      dataThrough: "Dáta do", cheapestFlight: "Najlacnejší nájdený let", averagePrice: "Priemerná jednosmerná cena", allAvailableFlights: "všetky dostupné odlety",
      routeChanges: "Zmeny trás", runsTitle: "Posledné behy", successRate: "úspešnosť", averageDuration: "priemerné trvanie zberu",
      started: "Spustené", type: "Typ", state: "Stav", duration: "Trvanie", details: "Detail", historyNote: "Počty letov sa ukladajú od zavedenia tejto stránky. Staršie behy preto môžu mať iba čas a stav.",
      privacy: "súkromie bez cookies a sledovania jednotlivcov", live: "Aktuálne dáta", noData: "Zatiaľ bez dát", direct: "Priamy vstup", scan: "Zber dát", deploy: "Nasadenie", manual: "Ručný zber",
      success: "Úspešný", failure: "Chyba", cancelled: "Zrušený", in_progress: "Prebieha", queued: "Čaká", open: "Otvoriť", days: "dní", ago: "dozadu",
      lastRefreshed: "Naposledy obnovené", updatedAt: "údaje z",
      clickComparison: "Interakcie po dňoch", selectDay: "Vybrať deň", dailyHint: "Denné počty · UTC", chartHint: "Vyberte deň v grafe alebo posuvníkom.", clicksUnavailable: "Údaje o kliknutiach nie sú dostupné.",
      clicksEyebrow: "Interakcie", clicksTitle: "Na čo klikajú", clicksNote: "anonymné súčty za vybrané obdobie",
      audienceEyebrow: "Publikum", audienceTitle: "Podrobnosti návštevnosti",
      offersOpened: "Ponuky", flightDetails: "detaily", ryanairClicks: "Ryanair", wizzClicks: "Wizz Air",
      bookingClicks: "Booking.com", airlineBooking: "letenky", accommodationLink: "ubytovanie",
      showSection: "Zobraziť", hideSection: "Skryť",
      newRoutes: "nové", removedRoutes: "odstránené", noChanges: "Bez zmeny oproti predošlému zberu", flights: "lety", returns: "návraty", errors: "chyby",
    },
    en: {
      back: "← Back to flights", eyebrow: "Statistics", title: "BTSFLIGHTSCANER",
      subtitle: "Traffic, interactions and the history of automated scans.",
      trafficEyebrow: "Traffic", trafficTitle: "People on the website", loading: "Loading…",
      visits: "Visits", humanTraffic: "arrivals",
      engagement: "Time on site", engagementNote: "avg. m:ss",
      mobileShare: "Mobile", trafficShare: "share", analyticsUnavailable: "Cloudflare statistics are not connected yet",
      analyticsUnavailableBody: "The automation history below remains available.", trafficTrend: "Traffic trend",
      countries: "Countries", devices: "Devices", browsers: "Browsers", operatingSystems: "Operating systems", topPages: "Most visited pages", sources: "Traffic sources",
      performanceEyebrow: "Performance", performanceTitle: "Speed and stability", realVisitors: "measured for real visitors",
      pageLoad: "Page load", average: "average", largestContent: "main content", interaction: "interaction response", layoutStability: "layout stability", firstContent: "first content",
      scannerEyebrow: "Flight data", scannerTitle: "Current scan", flightsFound: "Flights found", routes: "Routes", directDestinations: "direct destinations",
      directConnections: "direct connections", returnFlights: "Return flights", possibleReturns: "returns found", providerErrors: "Provider errors", latestScan: "latest scan",
      dataThrough: "Data through", cheapestFlight: "Cheapest flight found", averagePrice: "Average one-way price", allAvailableFlights: "all available departures",
      routeChanges: "Route changes", runsTitle: "Latest runs", successRate: "success rate", averageDuration: "average scan duration",
      started: "Started", type: "Type", state: "Status", duration: "Duration", details: "Details", historyNote: "Flight counts are stored from the launch of this page. Older runs may only show their time and status.",
      privacy: "privacy without cookies or individual tracking", live: "Live data", noData: "No data yet", direct: "Direct", scan: "Data scan", deploy: "Deployment", manual: "Manual scan",
      success: "Successful", failure: "Failed", cancelled: "Cancelled", in_progress: "Running", queued: "Queued", open: "Open", days: "days", ago: "ago",
      lastRefreshed: "Last refreshed", updatedAt: "data from",
      clickComparison: "Daily interactions", selectDay: "Select day", dailyHint: "Daily counts · UTC", chartHint: "Select a day in the chart or with the slider.", clicksUnavailable: "Click data is unavailable.",
      clicksEyebrow: "Interactions", clicksTitle: "What gets clicked", clicksNote: "anonymous totals for the selected period",
      audienceEyebrow: "Audience", audienceTitle: "Traffic details",
      offersOpened: "Offers", flightDetails: "details", ryanairClicks: "Ryanair", wizzClicks: "Wizz Air",
      bookingClicks: "Booking.com", airlineBooking: "flights", accommodationLink: "stays",
      showSection: "Show", hideSection: "Hide",
      newRoutes: "new", removedRoutes: "removed", noChanges: "No change since the previous scan", flights: "flights", returns: "returns", errors: "errors",
    },
  };

  const queryLanguage = new URLSearchParams(location.search).get("lang");
  let language = queryLanguage === "sk" ? "sk" : "en";
  let days = 30;
  let staticData = null;
  let liveData = null;

  const text = (key) => copy[language][key] || copy.sk[key] || key;
  const byId = (id) => document.getElementById(id);
  const number = (value, digits = 0) => value == null || !Number.isFinite(Number(value))
    ? "—"
    : new Intl.NumberFormat(language === "sk" ? "sk-SK" : "en-GB", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(Number(value));
  const date = (value, withTime = false) => {
    if (!value) return "—";
    const parsed = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
    if (Number.isNaN(parsed.getTime())) return "—";
    return new Intl.DateTimeFormat(language === "sk" ? "sk-SK" : "en-GB", withTime
      ? { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Bratislava" }
      : { day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed);
  };
  const exactDateTime = (value) => {
    if (!value) return "—";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "—";
    const parts = Object.fromEntries(new Intl.DateTimeFormat("sk-SK", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
      timeZone: "Europe/Bratislava",
    }).formatToParts(parsed).map(({ type, value }) => [type, value]));
    return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
  };
  const duration = (seconds) => {
    if (seconds == null) return "—";
    const minutes = Math.floor(seconds / 60);
    const rest = Math.round(seconds % 60);
    return minutes ? `${minutes} min ${rest} s` : `${rest} s`;
  };
  const engagementDuration = (seconds) => {
    if (seconds == null) return "—";
    const total = Math.max(0, Math.round(seconds));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  };
  const milliseconds = (value) => value == null ? "—" : value >= 1000 ? `${number(value / 1000, 2)} s` : `${number(value)} ms`;

  function applyLanguage() {
    document.documentElement.lang = language;
    document.querySelectorAll("[data-text]").forEach((element) => { element.textContent = text(element.dataset.text); });
    document.querySelectorAll("[data-lang]").forEach((button) => button.classList.toggle("active", button.dataset.lang === language));
    const url = new URL(location.href);
    url.searchParams.set("lang", language);
    history.replaceState(null, "", url);
    updateCollapseLabels();
    if (staticData) renderAll();
  }

  function updateCollapseLabels() {
    document.querySelectorAll("[data-collapsible] .section-toggle").forEach((button) => {
      const action = button.getAttribute("aria-expanded") === "true" ? text("hideSection") : text("showSection");
      button.setAttribute("aria-label", `${action} ${text(button.dataset.sectionText)}`);
    });
  }

  function bindCollapsibleSections() {
    document.querySelectorAll("[data-collapsible]").forEach((section) => {
      const button = section.querySelector(".section-toggle");
      const content = button ? byId(button.getAttribute("aria-controls")) : null;
      if (!button || !content) return;
      button.addEventListener("click", () => {
        const collapse = button.getAttribute("aria-expanded") === "true";
        button.setAttribute("aria-expanded", String(!collapse));
        section.classList.toggle("collapsed", collapse);
        content.hidden = collapse;
        updateCollapseLabels();
      });
    });
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
    const width = Math.max(240, target.clientWidth), height = 180, left = 40, right = 18, top = 10, bottom = 25;
    const max = Math.max(...points.map((item) => item.visits || 0), 1);
    const x = (index) => left + (points.length === 1 ? (width - left - right) / 2 : index * (width - left - right) / (points.length - 1));
    const y = (value) => top + (height - top - bottom) * (1 - value / max);
    const line = (key) => points.map((item, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(item[key] || 0).toFixed(1)}`).join(" ");
    const labelCount = Math.max(2, Math.floor((width - left - right) / 65));
    const labelStep = Math.max(1, Math.ceil((points.length - 1) / (labelCount - 1)));
    const labels = points.filter((_, index) => index % labelStep === 0);
    if (labels.at(-1) !== points.at(-1)) {
      if (points.length - 1 - points.indexOf(labels.at(-1)) < labelStep / 2) labels.pop();
      labels.push(points.at(-1));
    }
    const svg = `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${text("trafficTrend")}">
        <defs><linearGradient id="traffic-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#133f91"/><stop offset="1" stop-color="#fff"/></linearGradient></defs>
        ${[0, .25, .5, .75, 1].map((part) => `<line class="grid" x1="${left}" y1="${y(max * part)}" x2="${width - right}" y2="${y(max * part)}"/><text class="axis-label" x="0" y="${y(max * part) + 3}">${Math.round(max * part)}</text>`).join("")}
        <path class="area" d="${line("visits")} L${x(points.length - 1)},${height - bottom} L${x(0)},${height - bottom} Z"/>
        <path class="visits-line" d="${line("visits")}"/>
        ${labels.map((item) => { const index = points.indexOf(item); return `<text class="axis-label" text-anchor="middle" x="${x(index)}" y="${height - 5}">${new Intl.DateTimeFormat(language === "sk" ? "sk-SK" : "en-GB", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${item.date}T12:00:00Z`))}</text>`; }).join("")}
      </svg>`;
    target.innerHTML = svg;
  }

  function renderTraffic() {
    const traffic = liveData?.traffic;
    const available = traffic?.available === true;
    byId("traffic-unavailable").hidden = available;
    const refreshedAt = liveData?.generated_at_utc;
    byId("traffic-state").textContent = updatedStamp(refreshedAt);
    byId("traffic-state").classList.toggle("loading", !available);
    byId("clicks-freshness").textContent = updatedStamp(refreshedAt);
    byId("audience-freshness").textContent = updatedStamp(refreshedAt);
    byId("performance-freshness").textContent = updatedStamp(refreshedAt);
    const summary = traffic?.summary || {};
    setMetric("metric-visits", available ? number(summary.visits) : "—");
    setMetric("metric-engagement", engagementDuration(summary.average_engagement_seconds));
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
    const clicks = traffic?.clicks;
    renderInteractions(clicks);
    setMetric("click-offers", clicks?.available ? number(clicks.offer_opens) : "—");
    setMetric("click-ryanair", clicks?.available ? number(clicks.ryanair) : "—");
    setMetric("click-wizz", clicks?.available ? number(clicks.wizz_air) : "—");
    setMetric("click-booking", clicks?.available ? number(clicks.booking_com) : "—");
  }


  function renderInteractions(clicks) {
    const target = byId("interaction-bars");
    target.replaceChildren();
    if (!clicks?.available || !clicks.trend?.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = text("clicksUnavailable");
      target.append(empty);
      return;
    }
    const series = [
      ["offer_opens", text("offersOpened"), "var(--interaction-offers)"],
      ["booking_com", "Booking.com", "var(--interaction-booking)"],
      ["ryanair", "Ryanair", "var(--interaction-ryanair)"],
      ["wizz_air", "Wizz Air", "var(--interaction-wizz)"],
    ];
    const points = clicks.trend.map(point => ({
      date: point.date,
      values: series.map(([key]) => Math.max(0, Number(point[key]) || 0)),
    }));
    const totals = points.map(point => point.values.reduce((sum, value) => sum + value, 0));
    const minSlot = Math.max(24, ...totals.map(total => number(total).length * 8 + 10));
    const width = Math.max(240, target.clientWidth, points.length * minSlot + 56);
    const height = 200, left = 36, right = 20, top = 24, bottom = 28;
    const plotHeight = height - top - bottom;
    const max = Math.ceil(Math.max(4, ...totals) / 4) * 4;
    const slot = (width - left - right) / points.length;
    const barWidth = Math.min(32, slot * .72);
    const x = index => left + (index + .5) * slot;
    const y = value => top + plotHeight * (1 - value / max);
    const labelStep = Math.max(1, Math.ceil(64 / slot));
    const shortDate = value => new Intl.DateTimeFormat(language === "sk" ? "sk-SK" : "en-GB", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
    const scroll = document.createElement("div");
    scroll.className = "interaction-scroll";
    scroll.innerHTML = `<svg class="interaction-timeline" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${text("clickComparison")}">
      ${[0, 1, 2, 3, 4].map(i => `<line class="grid" x1="${left}" x2="${width - right}" y1="${y(i * max / 4)}" y2="${y(i * max / 4)}"/><text class="axis-label" x="0" y="${y(i * max / 4) + 3}">${number(i * max / 4)}</text>`).join("")}
      ${points.map((point, index) => {
        let total = 0;
        const bars = point.values.map((value, seriesIndex) => {
          total += value;
          return `<rect data-series="${series[seriesIndex][0]}" x="${x(index) - barWidth / 2}" y="${y(total)}" width="${barWidth}" height="${plotHeight * value / max}" fill="${series[seriesIndex][2]}"><title>${date(point.date)} · ${series[seriesIndex][1]}: ${number(value)}</title></rect>`;
        }).join("");
        const showLabel = index === points.length - 1 || (index % labelStep === 0 && points.length - 1 - index >= labelStep / 2);
        return `<g data-day="${index}">${bars}<text class="day-total" text-anchor="middle" x="${x(index)}" y="${y(total) - 7}"><title>${date(point.date)}</title>${number(total)}</text></g>${showLabel ? `<text class="axis-label" text-anchor="middle" x="${x(index)}" y="${height - 5}">${shortDate(point.date)}</text>` : ""}`;
      }).join("")}
    </svg>`;
    target.append(scroll);
    scroll.scrollLeft = scroll.scrollWidth;
  }

  function scanAge(value) {
    const elapsed = Date.now() - new Date(value).getTime();
    if (!Number.isFinite(elapsed)) return "—";
    const hours = Math.max(0, Math.floor(elapsed / 3_600_000));
    return language === "sk" ? `Aktualizované pred ${hours} h` : `Updated ${hours} h ago`;
  }

  function updatedStamp(value) {
    return exactDateTime(value);
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
    byId("runs-freshness").textContent = updatedStamp(liveData?.generated_at_utc);
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
    renderRuns();
  }

  let liveRequest = 0;
  async function loadLiveData() {
    const request = ++liveRequest;
    const requestedDays = days;
    let result;
    try {
      const response = await fetch(`/api/statistics?days=${requestedDays}`, { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      result = await response.json();
    } catch (_error) {
      result = { traffic: { available: false }, github: { runs: staticData?.action_runs || [] } };
    }
    if (request !== liveRequest) return;
    liveData = result;
    renderAll();
  }

  let interactionWidth = 0;
  new ResizeObserver(([entry]) => {
    const width = Math.round(entry.contentRect.width);
    if (width > 0 && width !== interactionWidth) {
      interactionWidth = width;
      renderInteractions(liveData?.traffic?.clicks);
    }
  }).observe(byId("interaction-bars"));
  new ResizeObserver(() => renderChart(liveData?.traffic?.trend)).observe(byId("traffic-chart"));

  document.querySelectorAll("[data-lang]").forEach((button) => button.addEventListener("click", () => { language = button.dataset.lang; applyLanguage(); }));
  document.querySelectorAll("[data-days]").forEach((button) => button.addEventListener("click", async () => {
    days = Number(button.dataset.days);
    document.querySelectorAll("[data-days]").forEach((item) => item.classList.toggle("active", item === button));
    byId("traffic-state").textContent = text("loading");
    byId("traffic-state").classList.add("loading");
    await loadLiveData();
  }));

  bindCollapsibleSections();
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

  setInterval(() => { loadLiveData(); }, 5 * 60 * 1000);
})();
