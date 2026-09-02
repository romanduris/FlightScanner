(() => {
  "use strict";

  const payload = window.FLIGHT_DATA;
  if (!payload || !Array.isArray(payload.offers)) {
    document.body.innerHTML = '<main class="empty-state"><strong>Chýbajú dáta dashboardu</strong><span>Spusti: python3 3.GenerateDashboard.py</span></main>';
    return;
  }

  const offers = payload.offers;
  const weekdays = ["Pon", "Uto", "Str", "Štv", "Pia", "Sob", "Ned"];
  const monthNames = ["január", "február", "marec", "apríl", "máj", "jún", "júl", "august", "september", "október", "november", "december"];
  const logoUrls = {
    "RYANAIR": "https://commons.wikimedia.org/wiki/Special:FilePath/Ryanair_logo.svg?width=260",
    "Wizz Air": "https://commons.wikimedia.org/wiki/Special:FilePath/Wizz_Air_logo_2015.svg?width=260",
  };
  const airlineSites = {
    "RYANAIR": "https://www.ryanair.com/",
    "Wizz Air": "https://www.wizzair.com/",
  };
  const flights = offers.flatMap((offer) => {
    const outboundOffers = Array.isArray(offer.outbound_offers) && offer.outbound_offers.length
      ? offer.outbound_offers
      : [offer];
    return outboundOffers.map((outbound) => ({
      ...offer,
      ...outbound,
      price_per_hour: outbound.duration_minutes
        ? Math.round((outbound.price / (outbound.duration_minutes / 60)) * 100) / 100
        : null,
    }));
  });
  const scanDays = Math.max(1, Number(payload.scan_days) || 30);
  const defaultVisibleDays = Math.min(14, scanDays);
  const lastScanDay = scanDays - 1;
  const totalDestinations = new Set(offers.map((offer) => offer.destination_iata)).size;
  const maxPrice = Math.ceil(Math.max(...flights.map((offer) => offer.price)) / 5) * 5;
  const maxDuration = Math.ceil(Math.max(...flights.map((offer) => offer.duration_minutes || 0)) / 15) * 15;
  const state = {
    country: "",
    destination: "",
    maxPrice,
    maxDuration,
    firstVisibleDay: 0,
    lastVisibleDay: defaultVisibleDays - 1,
    selectedWeekdays: new Set(),
    sortKey: "departure_local",
    sortDirection: "asc",
    selectedOffer: null,
  };
  let map = null;
  let routeLayer = null;
  let visibleOffers = [...flights];

  const elements = {
    country: document.querySelector("#country-filter"),
    destination: document.querySelector("#destination-filter"),
    price: document.querySelector("#price-filter"),
    priceOutput: document.querySelector("#price-output"),
    duration: document.querySelector("#duration-filter"),
    durationOutput: document.querySelector("#duration-output"),
    dateFrom: document.querySelector("#date-from-filter"),
    dateTo: document.querySelector("#date-to-filter"),
    dateFromOutput: document.querySelector("#date-from-output"),
    dateToOutput: document.querySelector("#date-to-output"),
    dateRange: document.querySelector("#date-range"),
    weekdays: document.querySelector("#weekday-buttons"),
    rows: document.querySelector("#flight-rows"),
    resultCount: document.querySelector("#result-count"),
    empty: document.querySelector("#empty-state"),
    dialog: document.querySelector("#flight-detail"),
    detail: document.querySelector("#detail-content"),
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
    })[character]);
  }

  function euro(value) {
    return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(value);
  }

  function integer(value) {
    return new Intl.NumberFormat("sk-SK").format(value);
  }

  function duration(minutes) {
    if (!minutes) return "—";
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return `${hours} h ${String(rest).padStart(2, "0")} min`;
  }

  function flag(countryCode) {
    const code = String(countryCode || "").toLowerCase();
    if (!/^[a-z]{2}$/.test(code)) return '<span class="flag-fallback">🌐</span>';
    return `<img class="flag" src="https://flagcdn.com/24x18/${code}.png" srcset="https://flagcdn.com/48x36/${code}.png 2x" width="20" height="15" alt="${escapeHtml(code.toUpperCase())}" loading="lazy">`;
  }

  function localDate(value, withYear = false) {
    if (!value) return "—";
    const [date, time = ""] = value.split("T");
    const [year, month, day] = date.split("-").map(Number);
    return `${day}. ${monthNames[month - 1]}${withYear ? ` ${year}` : ""}${time ? ` · ${time}` : ""}`;
  }

  function shortDate(value) {
    if (!value) return ["—", "—"];
    const [date, time] = value.split("T");
    const [year, month, day] = date.split("-");
    return [`${day}.${month}.${year}`, time || "—"];
  }

  function isoDate(value) {
    const [year, month, day] = String(value || "").split("T")[0].split("-").map(Number);
    return year && month && day ? new Date(Date.UTC(year, month - 1, day)) : null;
  }

  function addDays(value, days) {
    const result = isoDate(value);
    if (!result) return null;
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }

  function calendarDate(value) {
    const parsed = value instanceof Date ? value : isoDate(value);
    if (!parsed) return "—";
    return new Intl.DateTimeFormat("sk-SK", {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(parsed);
  }

  function returnDate(value) {
    const parsed = isoDate(value);
    if (!parsed) return "—";
    const weekday = weekdays[(parsed.getUTCDay() + 6) % 7];
    return `${weekday} ${calendarDate(parsed)}`;
  }

  function weekdayFor(value) {
    const parsed = isoDate(value);
    return parsed ? weekdays[(parsed.getUTCDay() + 6) % 7] : null;
  }

  function rangeDateLabel(value) {
    const parsed = value instanceof Date ? value : isoDate(value);
    if (!parsed) return "—";
    return new Intl.DateTimeFormat("sk-SK", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(parsed);
  }

  function airlineClass(airline) {
    return airline === "Wizz Air" ? "wizz" : "ryanair";
  }

  function airlineLogo(airline) {
    const url = logoUrls[airline];
    if (!url) return `<strong>${escapeHtml(airline)}</strong>`;
    return `<img src="${url}" alt="${escapeHtml(airline)}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('strong'),{textContent:this.alt}))">`;
  }

  function populateDestinations() {
    const matchingOffers = state.country
      ? offers.filter((offer) => offer.country === state.country)
      : offers;
    const destinations = new Map();
    matchingOffers.forEach((offer) => destinations.set(offer.destination_iata, offer.destination_name));
    const sortedDestinations = [...destinations.entries()].sort(([, nameA], [, nameB]) => nameA.localeCompare(nameB, "sk"));

    if (state.destination && !destinations.has(state.destination)) state.destination = "";
    elements.destination.innerHTML = [
      '<option value="">Všetky destinácie</option>',
      ...sortedDestinations.map(([iata, name]) => `<option value="${escapeHtml(iata)}">${escapeHtml(name)} (${escapeHtml(iata)})</option>`),
    ].join("");
    elements.destination.value = state.destination;
  }

  function populateControls() {
    const countries = [...new Set(offers.map((offer) => offer.country))].sort((a, b) => a.localeCompare(b, "sk"));
    elements.country.insertAdjacentHTML("beforeend", countries.map((country) => `<option>${escapeHtml(country)}</option>`).join(""));
    populateDestinations();
    elements.weekdays.innerHTML = weekdays.map((day) => `<button type="button" data-weekday="${day}" aria-pressed="false">${day}</button>`).join("");
    elements.price.max = maxPrice;
    elements.price.value = maxPrice;
    elements.duration.max = maxDuration;
    elements.duration.value = maxDuration;
    elements.dateFrom.max = lastScanDay;
    elements.dateFrom.value = state.firstVisibleDay;
    elements.dateTo.max = lastScanDay;
    elements.dateTo.value = state.lastVisibleDay;
    updateRangeLabels();
  }

  function renderAirlineSummary() {
    const groups = Object.groupBy ? Object.groupBy(offers, (offer) => offer.airline) : offers.reduce((result, offer) => {
      (result[offer.airline] ||= []).push(offer);
      return result;
    }, {});
    document.querySelector("#airline-summary").innerHTML = Object.entries(groups).map(([airline, airlineOffers]) => {
      const best = Math.min(...airlineOffers.map((offer) => offer.price));
      const countries = new Set(airlineOffers.map((offer) => offer.country)).size;
      return `
        <article class="airline-card">
          <div class="airline-logo">${airlineLogo(airline)}</div>
          <div class="airline-meta">
            <span>Trasy<strong>${airlineOffers.length}</strong></span>
            <span>Krajiny<strong>${countries}</strong></span>
            <span>Priemer<strong>${euro(airlineOffers.reduce((sum, item) => sum + item.price, 0) / airlineOffers.length)}</strong></span>
          </div>
          <div class="airline-best"><span>od</span><strong>${euro(best)}</strong></div>
        </article>`;
    }).join("");
  }

  function updateRangeLabels() {
    elements.priceOutput.value = `${euro(state.maxPrice)}`;
    elements.durationOutput.value = duration(state.maxDuration);
    elements.dateFromOutput.value = rangeDateLabel(addDays(payload.start_date, state.firstVisibleDay));
    elements.dateToOutput.value = rangeDateLabel(addDays(payload.start_date, state.lastVisibleDay));
    const scale = Math.max(1, lastScanDay);
    elements.dateRange.style.setProperty("--range-from", `${(state.firstVisibleDay / scale) * 100}%`);
    elements.dateRange.style.setProperty("--range-to", `${(state.lastVisibleDay / scale) * 100}%`);
  }

  function filteredAndSortedOffers() {
    const firstVisibleDate = addDays(payload.start_date, state.firstVisibleDay);
    const lastVisibleDate = addDays(payload.start_date, state.lastVisibleDay);
    const filtered = flights.filter((offer) => {
      const departureDate = isoDate(offer.departure_local);
      return (!state.country || offer.country === state.country)
        && (!state.destination || offer.destination_iata === state.destination)
        && (!state.selectedWeekdays.size || state.selectedWeekdays.has(weekdayFor(offer.departure_local)))
        && (!firstVisibleDate || !lastVisibleDate || (departureDate && departureDate >= firstVisibleDate && departureDate <= lastVisibleDate))
        && offer.price <= state.maxPrice
        && (offer.duration_minutes || Infinity) <= state.maxDuration;
    });

    const direction = state.sortDirection === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      const valueA = a[state.sortKey] ?? "";
      const valueB = b[state.sortKey] ?? "";
      if (typeof valueA === "number" && typeof valueB === "number") return (valueA - valueB) * direction;
      return String(valueA).localeCompare(String(valueB), "sk", { numeric: true }) * direction;
    });
  }

  function renderStats(items) {
    document.querySelector("#stat-routes").textContent = new Set(items.map((item) => item.destination_iata)).size;
    document.querySelector("#stat-routes-total").textContent = `z ${totalDestinations} destinácií`;
    document.querySelector("#stat-countries").textContent = new Set(items.map((item) => item.country)).size;
  }

  function renderTable(items) {
    elements.resultCount.textContent = items.length;
    elements.empty.hidden = items.length !== 0;
    elements.rows.innerHTML = items.map((offer) => {
      const [date, time] = shortDate(offer.departure_local);
      const selected = state.selectedOffer === offer ? "selected" : "";
      return `
        <tr class="${selected}" data-offer-id="${escapeHtml(`${offer.airline}|${offer.destination_iata}|${offer.departure_local}`)}" tabindex="0">
          <td><span class="airline-cell"><i class="airline-dot ${airlineClass(offer.airline)}"></i><span class="airline-code">${escapeHtml(offer.airline)}</span></span></td>
          <td><span class="destination-cell"><strong>${escapeHtml(offer.destination_name)}</strong><small>BTS → ${escapeHtml(offer.destination_iata)}</small></span></td>
          <td><span class="country-cell">${flag(offer.country_code)}${escapeHtml(offer.country)}</span></td>
          <td><strong>${escapeHtml(offer.flight_number || "—")}</strong></td>
          <td><span class="date-cell"><strong>${date}</strong><small>${time} → ${escapeHtml((offer.arrival_local || "").split("T")[1] || "—")} miestny čas</small></span></td>
          <td><strong>${duration(offer.duration_minutes)}</strong></td>
          <td>${offer.distance_km ? `${integer(offer.distance_km)} km` : "—"}</td>
          <td class="price-cell">${euro(offer.price)}<small>${offer.price_per_hour ? `${euro(offer.price_per_hour)}/h` : ""}</small></td>
          <td><span class="detail-chevron">›</span></td>
        </tr>`;
    }).join("");

    elements.rows.querySelectorAll("tr").forEach((row, index) => {
      const activate = () => showOffer(items[index]);
      row.addEventListener("click", activate);
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      });
    });
  }

  function renderSortHeaders() {
    document.querySelectorAll("th button[data-sort]").forEach((button) => {
      const active = button.dataset.sort === state.sortKey;
      button.classList.toggle("active", active);
      button.classList.toggle("desc", active && state.sortDirection === "desc");
    });
  }

  function renderReturnOffers(offer) {
    const windowDays = Number(payload.return_window_days) || 10;
    const firstDay = addDays(offer.departure_local, 1);
    const lastDay = addDays(offer.departure_local, windowDays);
    const period = firstDay && lastDay ? `${calendarDate(firstDay)} – ${calendarDate(lastDay)}` : "nasledujúcich 10 dní";
    let content = "";

    if (!Array.isArray(offer.return_offers)) {
      content = '<div class="return-empty">Spiatočné lety ešte nie sú v dátach. Spusti scanner znova.</div>';
    } else if (offer.return_search_error) {
      content = '<div class="return-empty">Spiatočné lety sa pri poslednom skene nepodarilo načítať.</div>';
    } else {
      const availableReturns = offer.return_offers.filter((item) => {
        const departure = isoDate(item.departure_local);
        return departure && firstDay && lastDay && departure >= firstDay && departure <= lastDay;
      });
      if (!availableReturns.length) {
        content = '<div class="return-empty">V tomto období sa nenašiel žiadny priamy let späť do Bratislavy.</div>';
      } else {
        const lowestReturnPrice = Math.min(...availableReturns.map((item) => item.price));
        content = `<div class="return-list">${availableReturns.map((item) => {
          const time = String(item.departure_local || "").split("T")[1] || "—";
          const cheapest = item.price === lowestReturnPrice;
          return `
            <article class="return-option${cheapest ? " cheapest" : ""}">
              <div class="return-when">
                <strong>${returnDate(item.departure_local)}</strong>
                <span>${escapeHtml(item.origin_iata)} → BTS · ${escapeHtml(time)}</span>
              </div>
              <span class="return-badge">${cheapest ? "Najlacnejší návrat" : ""}</span>
              <div class="return-price"><span>Cesta späť</span><strong>${euro(item.price)}</strong></div>
              <div class="return-total"><span>Spolu tam + späť</span><strong>${euro(offer.price + item.price)}</strong></div>
            </article>`;
        }).join("")}</div>`;
      }
    }

    return `
      <section class="return-section">
        <div class="return-heading">
          <div><span class="eyebrow">Cesta späť</span><h3>Spiatočné lety do Bratislavy</h3></div>
          <small>${period} · ceny za 1 dospelého</small>
        </div>
        ${content}
      </section>`;
  }

  function showOffer(offer) {
    state.selectedOffer = offer;
    const schedule = (offer.operating_schedule || []).map((item) => `<span class="schedule-chip">${escapeHtml(item)}</span>`).join("");
    const cssClass = airlineClass(offer.airline);
    elements.detail.innerHTML = `
      <div class="detail-hero ${cssClass}">
        <div class="detail-airline">${airlineLogo(offer.airline)}</div>
        <div class="detail-route">
          <div><b>BTS</b><small>Bratislava</small></div>
          <span class="detail-plane">✈</span>
          <div><b>${escapeHtml(offer.destination_iata)}</b><small>${escapeHtml(offer.destination_name)}, ${escapeHtml(offer.country)}</small></div>
        </div>
      </div>
      <div class="detail-body">
        <div class="detail-price">
          <div><span>Cena vybraného odletu</span><strong>${euro(offer.price)}</strong><small>jednosmerný basic tarif</small></div>
          <div><span>Cena za hodinu</span><strong>${offer.price_per_hour ? euro(offer.price_per_hour) : "—"}</strong></div>
        </div>
        <div class="detail-grid">
          <div class="detail-item"><span>Číslo letu</span><strong>${escapeHtml(offer.flight_number || "—")}</strong></div>
          <div class="detail-item"><span>Dĺžka letu</span><strong>${duration(offer.duration_minutes)}</strong></div>
          <div class="detail-item"><span>Vzdialenosť</span><strong>${offer.distance_km ? `${integer(offer.distance_km)} km` : "—"}</strong></div>
          <div class="detail-item"><span>Krajina</span><strong>${flag(offer.country_code)} ${escapeHtml(offer.country)}</strong></div>
          <div class="detail-item"><span>Odlet</span><strong>${localDate(offer.departure_local, true)}</strong></div>
          <div class="detail-item"><span>Prílet</span><strong>${localDate(offer.arrival_local, true)}</strong></div>
          <div class="detail-item"><span>Typ ceny</span><strong>Basic · jednosmerná</strong></div>
          <div class="detail-item"><span>Časy</span><strong>Miestne časy letísk</strong></div>
        </div>
        <h3 class="schedule-title">Všetky dni a časy odletov v mesiaci</h3>
        <div class="schedule-list">${schedule || "Časy nie sú dostupné"}</div>
        ${renderReturnOffers(offer)}
        <a class="booking-link ${cssClass}" href="${airlineSites[offer.airline] || "#"}" target="_blank" rel="noopener">Otvoriť stránku ${escapeHtml(offer.airline)} ↗</a>
      </div>`;
    if (typeof elements.dialog.showModal === "function") elements.dialog.showModal();
    focusRouteOnMap(offer);
    renderTable(visibleOffers);
  }

  function initMap() {
    if (typeof window.L === "undefined") {
      document.querySelector("#map").hidden = true;
      document.querySelector("#map-fallback").hidden = false;
      return;
    }
    map = L.map("map", { zoomControl: true, minZoom: 2 }).setView([48.5, 15], 4);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    routeLayer = L.layerGroup().addTo(map);
    const origin = payload.origin;
    L.circleMarker([origin.latitude, origin.longitude], {
      radius: 8, color: "#fff", weight: 3, fillColor: "#f4ce24", fillOpacity: 1,
    }).bindPopup("<strong>Bratislava (BTS)</strong><br>Všetky lety odlietajú odtiaľto.").addTo(map);
  }

  function renderMap(items) {
    if (!map || !routeLayer) return;
    routeLayer.clearLayers();
    const origin = [payload.origin.latitude, payload.origin.longitude];
    const routes = new Map();
    items.filter((offer) => offer.latitude != null && offer.longitude != null).forEach((offer) => {
      const routeKey = `${offer.airline}|${offer.destination_iata}`;
      const current = routes.get(routeKey);
      if (!current || offer.price < current.price) routes.set(routeKey, offer);
    });
    routes.forEach((offer) => {
      const destination = [offer.latitude, offer.longitude];
      const cssClass = airlineClass(offer.airline);
      const color = cssClass === "wizz" ? "#c01878" : "#174a9d";
      L.polyline([origin, destination], {
        color, weight: 1.35, opacity: .46, dashArray: cssClass === "wizz" ? "4 4" : null,
      }).addTo(routeLayer);
      const marker = L.circleMarker(destination, {
        radius: 4.5, color: "#fff", weight: 1.5, fillColor: color, fillOpacity: .95,
      }).addTo(routeLayer);
      marker.bindPopup(`
        <div class="map-popup">
          <strong>${escapeHtml(offer.destination_name)} (${escapeHtml(offer.destination_iata)})</strong>
          <div class="popup-route">${flag(offer.country_code)} ${escapeHtml(offer.country)} · ${escapeHtml(offer.airline)}</div>
          <div class="popup-line"><span>Cena od</span><b>${euro(offer.price)}</b></div>
          <div class="popup-line"><span>Dĺžka</span><b>${duration(offer.duration_minutes)}</b></div>
          <button type="button" data-map-offer="${escapeHtml(`${offer.airline}|${offer.destination_iata}`)}">Detail letu</button>
        </div>`);
      marker.on("popupopen", (event) => {
        const button = event.popup.getElement()?.querySelector("[data-map-offer]");
        button?.addEventListener("click", () => showOffer(offer), { once: true });
      });
    });
  }

  function fitVisibleMap() {
    if (!map) return;
    const points = [[payload.origin.latitude, payload.origin.longitude], ...visibleOffers
      .filter((offer) => offer.latitude != null && offer.longitude != null)
      .map((offer) => [offer.latitude, offer.longitude])];
    if (points.length > 1) map.fitBounds(points, { padding: [28, 28], maxZoom: 6 });
  }

  function focusRouteOnMap(offer) {
    if (!map || offer.latitude == null) return;
    map.fitBounds([
      [payload.origin.latitude, payload.origin.longitude],
      [offer.latitude, offer.longitude],
    ], { padding: [65, 65], maxZoom: 6 });
  }

  function render() {
    visibleOffers = filteredAndSortedOffers();
    renderStats(visibleOffers);
    renderTable(visibleOffers);
    renderMap(visibleOffers);
    renderSortHeaders();
  }

  function resetFilters() {
    state.country = "";
    state.destination = "";
    state.maxPrice = maxPrice;
    state.maxDuration = maxDuration;
    state.firstVisibleDay = 0;
    state.lastVisibleDay = defaultVisibleDays - 1;
    state.selectedWeekdays.clear();
    elements.country.value = "";
    populateDestinations();
    elements.price.value = maxPrice;
    elements.duration.value = maxDuration;
    elements.dateFrom.value = state.firstVisibleDay;
    elements.dateTo.value = state.lastVisibleDay;
    elements.weekdays.querySelectorAll("button").forEach((button) => {
      button.classList.remove("active");
      button.setAttribute("aria-pressed", "false");
    });
    updateRangeLabels();
    render();
    fitVisibleMap();
  }

  function bindEvents() {
    elements.country.addEventListener("change", (event) => {
      state.country = event.target.value;
      state.destination = "";
      populateDestinations();
      render();
    });
    elements.destination.addEventListener("change", (event) => { state.destination = event.target.value; render(); });
    elements.price.addEventListener("input", (event) => { state.maxPrice = Number(event.target.value); updateRangeLabels(); render(); });
    elements.duration.addEventListener("input", (event) => { state.maxDuration = Number(event.target.value); updateRangeLabels(); render(); });
    elements.dateFrom.addEventListener("input", (event) => {
      state.firstVisibleDay = Number(event.target.value);
      if (state.firstVisibleDay > state.lastVisibleDay) {
        state.lastVisibleDay = state.firstVisibleDay;
        elements.dateTo.value = state.lastVisibleDay;
      }
      updateRangeLabels();
      render();
      fitVisibleMap();
    });
    elements.dateTo.addEventListener("input", (event) => {
      state.lastVisibleDay = Number(event.target.value);
      if (state.lastVisibleDay < state.firstVisibleDay) {
        state.firstVisibleDay = state.lastVisibleDay;
        elements.dateFrom.value = state.firstVisibleDay;
      }
      updateRangeLabels();
      render();
      fitVisibleMap();
    });
    elements.weekdays.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-weekday]");
      if (!button) return;
      const day = button.dataset.weekday;
      if (state.selectedWeekdays.has(day)) state.selectedWeekdays.delete(day);
      else state.selectedWeekdays.add(day);
      button.classList.toggle("active");
      button.setAttribute("aria-pressed", String(button.classList.contains("active")));
      render();
    });
    document.querySelectorAll("th button[data-sort]").forEach((button) => button.addEventListener("click", () => {
      if (state.sortKey === button.dataset.sort) state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
      else {
        state.sortKey = button.dataset.sort;
        state.sortDirection = "asc";
      }
      render();
    }));
    document.querySelector("#reset-filters").addEventListener("click", resetFilters);
    document.querySelector("#fit-map").addEventListener("click", fitVisibleMap);
    document.querySelector("#close-detail").addEventListener("click", () => elements.dialog.close());
    elements.dialog.addEventListener("click", (event) => {
      if (event.target === elements.dialog) elements.dialog.close();
    });
  }

  function initHeader() {
    const start = isoDate(payload.start_date);
    const end = isoDate(payload.end_date);
    const rangeLabel = start && end && start.getUTCFullYear() !== end.getUTCFullYear()
      ? `${calendarDate(start)} ${start.getUTCFullYear()} – ${calendarDate(end)} ${end.getUTCFullYear()}`
      : start && end
        ? `${calendarDate(start)} – ${calendarDate(end)} ${end.getUTCFullYear()}`
        : null;
    document.querySelector("#period-label").textContent = start && end
      ? rangeLabel
      : `${monthNames[payload.month - 1]} ${payload.year}`;
    const scanned = new Date(payload.scanned_at_utc);
    document.querySelector("#scan-time").textContent = `Dáta aktualizované ${scanned.toLocaleString("sk-SK", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" })} UTC`;
  }

  populateControls();
  renderAirlineSummary();
  initHeader();
  initMap();
  bindEvents();
  render();
  fitVisibleMap();
})();
