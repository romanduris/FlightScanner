(() => {
  "use strict";

  const i18n = window.FlightI18n;
  const { t } = i18n;
  const payload = window.FLIGHT_DATA;
  if (!payload || !Array.isArray(payload.offers)) {
    document.body.innerHTML = `<main class="empty-state"><strong>${t("data.missingTitle")}</strong><span>${t("data.missingBody")}</span></main>`;
    return;
  }

  const offers = payload.offers;
  const weekdays = i18n.weekdays;
  const monthNames = i18n.months;
  const logoUrls = {
    "RYANAIR": "https://commons.wikimedia.org/wiki/Special:FilePath/Ryanair_logo.svg?width=260",
    "Wizz Air": "https://commons.wikimedia.org/wiki/Special:FilePath/Wizz_Air_logo_2015.svg?width=260",
  };
  const roundLogoUrls = {
    "RYANAIR": "https://assets.ryanair.com/resources/ui/ryanair3.0/favicons/apple-touch-icon-152x152.png",
    "Wizz Air": "https://commons.wikimedia.org/wiki/Special:FilePath/Wizz_Air_logo_2015.svg?width=120",
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
  const lastScanDay = scanDays - 1;
  const initialVisibleDay = defaultVisibleDay();
  const totalDestinations = new Set(offers.map((offer) => offer.destination_iata)).size;
  const maxPrice = Math.ceil(Math.max(...flights.map((offer) => offer.price)) / 5) * 5;
  const maxDuration = Math.ceil(Math.max(...flights.map((offer) => offer.duration_minutes || 0)) / 15) * 15;
  const state = {
    destination: "",
    maxPrice,
    maxDuration,
    travellers: 1,
    firstVisibleDay: initialVisibleDay,
    sortKey: "departure_local",
    sortDirection: "asc",
    selectedOffer: null,
    stay: "",
    weekend: false,
  };
  let visibleLimit = 30;
  const sortCollator = new Intl.Collator(i18n.locale, { numeric: true });
  const returnIndexes = new WeakMap();
  const returnResults = new WeakMap();
  let mappedRoutes = new Map();
  let mapMarkers = [];
  const initialQuery = new URLSearchParams(window.location?.search || "");
  let map = null;
  let detailMap = null;
  let routeLayer = null;
  let publicHolidays = new Set();
  let schoolHolidays = new Set();
  let schoolHolidaysByRegion = {};
  let schoolRegion = "west";
  let visibleOffers = [...flights];
  let calendarCursor = startOfMonth(addDays(payload.start_date, initialVisibleDay));

  const elements = {
    destination: document.querySelector("#destination-filter"),
    departure: document.querySelector("#departure-filter"),
    stay: document.querySelector("#stay-filter"),
    weekend: document.querySelector("#weekend-filter"),
    sort: document.querySelector("#sort-filter"),
    price: document.querySelector("#price-filter"),
    priceOutput: document.querySelector("#price-output"),
    duration: document.querySelector("#duration-filter"),
    durationOutput: document.querySelector("#duration-output"),
    travellerMinus: document.querySelector("#traveller-minus"),
    travellerCount: document.querySelector("#traveller-count"),
    travellerPlus: document.querySelector("#traveller-plus"),
    calendarSchoolLegend: document.querySelector("#calendar-school-legend"),
    calendarRegion: document.querySelector("#calendar-region"),
    calendarMonths: document.querySelector("#calendar-months"),
    calendarSelectedDate: document.querySelector("#calendar-selected-date"),
    calendarPrevious: document.querySelector("#calendar-prev"),
    calendarNext: document.querySelector("#calendar-next"),
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
    return new Intl.NumberFormat(i18n.locale, { style: "currency", currency: "EUR" }).format(value);
  }

  function groupPrice(value) {
    return Number(value) * state.travellers;
  }

  function integer(value) {
    return new Intl.NumberFormat(i18n.locale).format(value);
  }

  function duration(minutes) {
    if (!minutes) return "—";
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return t("duration.value", { hours, minutes: String(rest).padStart(2, "0") });
  }

  function flag(countryCode) {
    const code = String(countryCode || "").toLowerCase();
    if (!/^[a-z]{2}$/.test(code)) return '<span class="flag-fallback">🌐</span>';
    return `<img class="flag" src="https://flagcdn.com/24x18/${code}.png" srcset="https://flagcdn.com/48x36/${code}.png 2x" width="20" height="15" alt="${escapeHtml(code.toUpperCase())}" loading="lazy">`;
  }

  function numericDateWithWeekday(value) {
    if (!value) return "—";
    const parsed = isoDate(value);
    if (!parsed) return "—";
    const day = String(parsed.getUTCDate()).padStart(2, "0");
    const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
    const weekday = weekdays[(parsed.getUTCDay() + 6) % 7];
    return `${day}.${month}.${parsed.getUTCFullYear()} (${weekday})`;
  }

  function numericDate(value) {
    const parsed = isoDate(value);
    if (!parsed) return "—";
    const day = String(parsed.getUTCDate()).padStart(2, "0");
    const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
    return `${day}.${month}.${parsed.getUTCFullYear()}`;
  }

  function detailDateTime(value) {
    const formatted = numericDateWithWeekday(value);
    const time = String(value || "").split("T")[1];
    return `${formatted}${time ? ` · ${time}` : ""}`;
  }

  function shortDate(value) {
    if (!value) return ["—", "—"];
    const [date, time] = value.split("T");
    const [year, month, day] = date.split("-");
    const formatted = i18n.language === "en" ? `${day}/${month}/${year}` : `${day}.${month}.${year}`;
    return [formatted, time || "—"];
  }

  function isoDate(value) {
    const [year, month, day] = String(value || "").split("T")[0].split("-").map(Number);
    return year && month && day ? new Date(Date.UTC(year, month - 1, day)) : null;
  }

  function addDays(value, days) {
    const result = value instanceof Date ? new Date(value.getTime()) : isoDate(value);
    if (!result) return null;
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }

  function startOfMonth(value) {
    const parsed = value instanceof Date ? new Date(value.getTime()) : isoDate(value);
    return parsed ? new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1)) : null;
  }

  function addMonths(value, months) {
    const parsed = value instanceof Date ? value : isoDate(value);
    return parsed ? new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + months, 1)) : null;
  }

  function bratislavaToday() {
    const override = window.FLIGHTSCANNER_TODAY;
    if (override) return isoDate(override);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Bratislava",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
  }

  function dayOffset(value) {
    const parsed = value instanceof Date ? value : isoDate(value);
    const start = isoDate(payload.start_date);
    return parsed && start ? Math.round((parsed.getTime() - start.getTime()) / 86400000) : 0;
  }

  function clampVisibleDay(day) {
    return Math.max(0, Math.min(lastScanDay, Number(day) || 0));
  }

  function defaultVisibleDay() {
    return clampVisibleDay(dayOffset(bratislavaToday()));
  }

  function calendarDate(value) {
    const parsed = value instanceof Date ? value : isoDate(value);
    if (!parsed) return "—";
    return new Intl.DateTimeFormat(i18n.locale, {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(parsed);
  }

  function returnDate(value) {
    return numericDateWithWeekday(value);
  }

  function stayLength(outboundValue, returnValue) {
    const outbound = isoDate(outboundValue);
    const returning = isoDate(returnValue);
    if (!outbound || !returning) return "";
    const days = Math.round((returning.getTime() - outbound.getTime()) / 86400000);
    if (days < 1) return "";
    if (days === 1) return t("return.stayOneDay", { count: days });
    if (days <= 4) return t("return.stayFewDays", { count: days });
    return t("return.stayDays", { count: days });
  }

  function weekdayFor(value) {
    const parsed = isoDate(value);
    return parsed ? weekdays[(parsed.getUTCDay() + 6) % 7] : null;
  }

  function rangeDateLabel(value) {
    const parsed = value instanceof Date ? value : isoDate(value);
    if (!parsed) return "—";
    const formattedDate = new Intl.DateTimeFormat(i18n.locale, {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(parsed);
    const weekday = weekdays[(parsed.getUTCDay() + 6) % 7];
    return `${formattedDate} (${weekday})`;
  }

  function airlineClass(airline) {
    return airline === "Wizz Air" ? "wizz" : "ryanair";
  }

  function airlineLogo(airline) {
    const url = logoUrls[airline];
    if (!url) return `<strong>${escapeHtml(airline)}</strong>`;
    return `<img src="${url}" alt="${escapeHtml(airline)}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('strong'),{textContent:this.alt}))">`;
  }

  function roundAirlineLogo(airline) {
    const url = roundLogoUrls[airline];
    if (!url) return "";
    return `<span class="return-airline-logo ${airlineClass(airline)}" role="img" aria-label="${escapeHtml(airline)}"><img src="${url}" alt="" loading="lazy"></span>`;
  }

  function displayDestination(offer) {
    const name = i18n.destinationName(offer.destination_iata, offer.destination_name);
    return name === name.toLocaleUpperCase(i18n.locale)
      ? name.toLocaleLowerCase(i18n.locale).replace(/(^|[\s/\-])\p{L}/gu, part => part.toLocaleUpperCase(i18n.locale))
      : name;
  }

  function offerKey(offer) {
    return [offer.airline, offer.destination_iata, offer.departure_local, offer.flight_number || ""].join("|");
  }

  function searchUrl(offer = null) {
    const url = new URL(window.location?.href || "https://btsflightscaner.rodulab.com/");
    const params = url.searchParams;
    const values = {
      country: "", destination: state.destination,
      from: addDays(payload.start_date, state.firstVisibleDay).toISOString().slice(0, 10),
      to: "",
      price: state.maxPrice < maxPrice ? state.maxPrice : "",
      duration: state.maxDuration < maxDuration ? state.maxDuration : "",
      travellers: state.travellers > 1 ? state.travellers : "",
      stay: state.stay, weekend: state.weekend ? "1" : "",
      sort: state.sortKey, direction: state.sortDirection, offer: offer ? offerKey(offer) : "",
    };
    Object.entries(values).forEach(([key, value]) => value === "" ? params.delete(key) : params.set(key, String(value)));
    url.hash = "";
    return url;
  }

  function syncUrl() {
    window.history?.replaceState(null, "", searchUrl(state.selectedOffer));
  }

  function restoreSearch() {
    const q = initialQuery;
    state.destination = offers.some(offer => offer.destination_iata === q.get("destination")) ? q.get("destination") : "";
    state.stay = ["2-4", "5-8", "9-10"].includes(q.get("stay")) ? q.get("stay") : "";
    state.weekend = q.get("weekend") === "1";
    for (const [key, field, min, max] of [["price", "maxPrice", 0, maxPrice], ["duration", "maxDuration", 0, maxDuration], ["travellers", "travellers", 1, 9]]) {
      if (q.has(key) && q.get(key).trim() && Number.isFinite(Number(q.get(key)))) state[field] = Math.max(min, Math.min(max, Number(q.get(key))));
    }
    state.travellers = Math.floor(state.travellers);
    const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || "") && isoDate(value)?.toISOString().slice(0, 10) === value;
    if (validDate(q.get("from"))) {
      state.firstVisibleDay = clampVisibleDay(dayOffset(q.get("from")));
    }
    if (["departure_local", "price", "round_trip", "airline", "destination_name", "flight_number", "duration_minutes", "distance_km"].includes(q.get("sort"))) state.sortKey = q.get("sort");
    state.sortDirection = q.get("direction") === "desc" ? "desc" : "asc";
    calendarCursor = startOfMonth(addDays(payload.start_date, state.firstVisibleDay));
  }

  function displayCountry(offer) {
    return i18n.countryName(offer.country_code, offer.country);
  }

  function translatedSchedule(value) {
    const [day, ...rest] = String(value || "").split(" ");
    const index = ["Pon", "Uto", "Str", "Štv", "Pia", "Sob", "Ned"].indexOf(day);
    return `${index >= 0 ? weekdays[index] : day}${rest.length ? ` ${rest.join(" ")}` : ""}`;
  }

  function populateDestinations() {
    const destinations = new Map();
    offers.forEach((offer) => destinations.set(offer.destination_iata, displayDestination(offer)));
    const sortedDestinations = [...destinations.entries()].sort(([, nameA], [, nameB]) => nameA.localeCompare(nameB, i18n.locale));

    if (state.destination && !destinations.has(state.destination)) state.destination = "";
    elements.destination.innerHTML = [
      `<option value="">${t("filters.allDestinations")}</option>`,
      ...sortedDestinations.map(([iata, name]) => `<option value="${escapeHtml(iata)}">${escapeHtml(name)} (${escapeHtml(iata)})</option>`),
    ].join("");
    elements.destination.value = state.destination;
  }

  function syncPriceControl() {
    elements.price.max = maxPrice * state.travellers;
    elements.price.step = 5 * state.travellers;
    elements.price.value = state.maxPrice * state.travellers;
  }

  function updateTravellerControl() {
    elements.travellerCount.value = state.travellers;
    elements.travellerCount.textContent = state.travellers;
    elements.travellerMinus.disabled = state.travellers === 1;
    elements.travellerPlus.disabled = state.travellers === 9;
  }

  function setTravellers(value) {
    const travellers = Math.max(1, Math.min(9, Number(value) || 1));
    if (travellers === state.travellers) return;
    state.travellers = travellers;
    syncPriceControl();
    updateTravellerControl();
    updateRangeLabels();
    renderTable(visibleOffers);
    updateOpenMapPopups();
    syncUrl();
  }

  function populateControls() {
    populateDestinations();
    syncPriceControl();
    updateTravellerControl();
    elements.duration.max = maxDuration;
    elements.duration.value = state.maxDuration;
    elements.departure.min = payload.start_date;
    elements.departure.max = addDays(payload.start_date, lastScanDay).toISOString().slice(0, 10);
    elements.stay.value = state.stay;
    elements.weekend.checked = state.weekend;
    syncDateRange();
    renderCalendar();
    updateRangeLabels();
  }

  function renderAirlineSummary() {
    const groups = Object.groupBy ? Object.groupBy(offers, (offer) => offer.airline) : offers.reduce((result, offer) => {
      (result[offer.airline] ||= []).push(offer);
      return result;
    }, {});
    document.querySelector("#airline-summary").innerHTML = Object.entries(groups).map(([airline, airlineOffers]) => {
      const countries = new Set(airlineOffers.map((offer) => offer.country)).size;
      const dailyFlights = flights.filter((offer) => offer.airline === airline).length / scanDays;
      return `
        <article class="airline-card">
          <div class="airline-logo">${airlineLogo(airline)}</div>
          <div class="airline-meta">
            <span>${t("summary.routes")}<strong>${airlineOffers.length}</strong></span>
            <span>${t("summary.countries")}<strong>${countries}</strong></span>
            <span>${t("summary.flightsPerDay")}<strong>${integer(Math.round(dailyFlights))}</strong></span>
          </div>
          <div class="airline-best"><span>${t("summary.dataUntil")}</span><strong>${numericDate(payload.end_date)}</strong></div>
        </article>`;
    }).join("");
  }

  function updateRangeLabels() {
    elements.priceOutput.value = `${euro(groupPrice(state.maxPrice))}`;
    elements.durationOutput.value = duration(state.maxDuration);
  }

  function syncDateRange() {
    elements.departure.value = addDays(payload.start_date, state.firstVisibleDay).toISOString().slice(0, 10);
    document.querySelector("#departure-picker-value").textContent = numericDate(elements.departure.value);
  }

  function calendarMonthTitle(value) {
    return new Intl.DateTimeFormat(i18n.locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(value);
  }

  function calendarDayLabel(value) {
    return new Intl.DateTimeFormat(i18n.locale, {
      weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
    }).format(value);
  }

  function renderCalendarMonth(monthStart) {
    const year = monthStart.getUTCFullYear();
    const month = monthStart.getUTCMonth();
    const firstWeekday = (monthStart.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const todayOffset = dayOffset(bratislavaToday());
    const cells = Array.from({ length: firstWeekday }, () => '<span class="calendar-blank"></span>');
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(Date.UTC(year, month, day));
      const offset = dayOffset(date);
      const unavailable = offset < 0 || offset > lastScanDay;
      const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
      const dateKey = date.toISOString().slice(0, 10);
      const holiday = publicHolidays.has(dateKey);
      const schoolHoliday = schoolHolidays.has(dateKey);
      const classes = [
        offset === state.firstVisibleDay ? "selected" : "",
        offset === todayOffset ? "today" : "",
        weekend || holiday ? "weekend" : schoolHoliday ? "school-holiday" : "",
      ].filter(Boolean).join(" ");
      cells.push(`<button type="button" class="${classes}" data-calendar-day="${offset}" ${unavailable ? "disabled" : ""} aria-label="${escapeHtml(t("calendar.selectDay", { date: calendarDayLabel(date) }))}" aria-pressed="${offset === state.firstVisibleDay}">${day}</button>`);
    }
    return `<section class="calendar-month"><h3>${escapeHtml(calendarMonthTitle(monthStart))}</h3><div class="calendar-weekdays">${weekdays.map((day) => `<span>${escapeHtml(day)}</span>`).join("")}</div><div class="calendar-days">${cells.join("")}</div></section>`;
  }

  function renderCalendar() {
    elements.calendarSchoolLegend.textContent = t(`calendar.schoolLegend.${schoolRegion}`);
    const firstMonth = startOfMonth(payload.start_date);
    const lastMonth = startOfMonth(addDays(payload.start_date, lastScanDay));
    const latestCursor = lastMonth;
    if (calendarCursor < firstMonth) calendarCursor = firstMonth;
    if (calendarCursor > latestCursor) calendarCursor = latestCursor;
    elements.calendarSelectedDate.textContent = rangeDateLabel(addDays(payload.start_date, state.firstVisibleDay));
    elements.calendarMonths.innerHTML = renderCalendarMonth(calendarCursor);
    elements.calendarPrevious.disabled = calendarCursor <= firstMonth;
    elements.calendarNext.disabled = calendarCursor >= latestCursor;
  }

  function selectCalendarDay(requestedDay) {
    state.firstVisibleDay = clampVisibleDay(requestedDay);
    syncDateRange();
    renderCalendar();
    updateRangeLabels();
    render();
    fitVisibleMap();
  }

  function filteredAndSortedOffers() {
    const firstVisibleDate = addDays(payload.start_date, state.firstVisibleDay);
    const lastVisibleDate = addDays(payload.start_date, lastScanDay);
    const filtered = flights.filter((offer) => {
      const departureDate = isoDate(offer.departure_local);
      return (!state.destination || offer.destination_iata === state.destination)
        && (!firstVisibleDate || !lastVisibleDate || (departureDate && departureDate >= firstVisibleDate && departureDate <= lastVisibleDate))
        && offer.price <= state.maxPrice
        && (offer.duration_minutes || Infinity) <= state.maxDuration
        && (!(state.stay || state.weekend) || availableReturnOffers(offer).length > 0);
    });

    const direction = state.sortDirection === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      if (state.sortKey === "round_trip") {
        const priceA = cheapestReturnPrice(a), priceB = cheapestReturnPrice(b);
        if (priceA == null) return priceB == null ? 0 : 1;
        if (priceB == null) return -1;
        return ((Number(a.price) + priceA) - (Number(b.price) + priceB)) * direction;
      }
      const valueA = a[state.sortKey] ?? "";
      const valueB = b[state.sortKey] ?? "";
      if (typeof valueA === "number" && typeof valueB === "number") return (valueA - valueB) * direction;
      return sortCollator.compare(String(valueA), String(valueB)) * direction;
    });
  }

  function renderStats(items) {
    document.querySelector("#stat-routes").textContent = new Set(items.map((item) => item.destination_iata)).size;
    document.querySelector("#stat-routes-total").textContent = t("overview.destinationCount", { count: totalDestinations });
    document.querySelector("#stat-countries").textContent = new Set(items.map((item) => item.country_code)).size;
    document.querySelector("#stat-flights").textContent = integer(flights.length);
    document.querySelector("#overview-flight-count").textContent = integer(flights.length);
  }

  function matchingReturns(offer) {
    const key = `${state.stay}|${state.weekend}`;
    let results = returnResults.get(offer);
    if (!results) { results = new Map(); returnResults.set(offer, results); }
    if (results.has(key)) return results.get(key);
    const result = { items: [], price: null };
    results.set(key, result);
    if (!Array.isArray(offer.return_offers) || offer.return_search_error) return result;
    const windowDays = Number(payload.return_window_days) || 10;
    const outbound = isoDate(offer.departure_local);
    const arrival = isoDate(offer.arrival_local || offer.departure_local);
    if (!outbound || (state.weekend && ![5, 6].includes(outbound.getUTCDay()))) return result;
    let index = returnIndexes.get(offer.return_offers);
    if (!index) {
      index = new Map();
      offer.return_offers.forEach((item, position) => {
        const date = isoDate(item.departure_local);
        if (!date || item.price == null || !Number.isFinite(Number(item.price))) return;
        const day = date.getTime();
        if (!index.has(day)) index.set(day, []);
        index.get(day).push({ item, position });
      });
      returnIndexes.set(offer.return_offers, index);
    }
    const [minNights, maxNights] = state.stay ? state.stay.split("-").map(Number) : [0, windowDays];
    const candidates = [];
    const lastDay = addDays(offer.departure_local, windowDays).getTime();
    // Return lists are shared by outbound flights. Inspect only the eligible days.
    for (let day = outbound.getTime() + 86400000; day <= lastDay; day += 86400000) {
      const nights = arrival ? (day - arrival.getTime()) / 86400000 : 0;
      if (nights < minNights || nights > maxNights) continue;
      if (state.weekend && (![0, 1].includes(new Date(day).getUTCDay()) || day - outbound.getTime() > 3 * 86400000)) continue;
      candidates.push(...(index.get(day) || []));
    }
    candidates.sort((a, b) => a.position - b.position);
    result.items = candidates.map(({ item }) => item);
    result.items.forEach(item => {
      const price = Number(item.price);
      if (result.price == null || price < result.price) result.price = price;
    });
    return result;
  }

  function availableReturnOffers(offer) {
    return matchingReturns(offer).items;
  }

  function cheapestReturnPrice(offer) {
    return matchingReturns(offer).price;
  }

  function renderTable(items) {
    elements.resultCount.textContent = items.length;
    elements.empty.hidden = items.length !== 0;
    document.querySelector("#more-offers").hidden = items.length <= visibleLimit;
    document.querySelector("#visible-count").textContent = t("results.shown", { shown: integer(Math.min(visibleLimit, items.length)), total: integer(items.length) });
    elements.rows.innerHTML = items.slice(0, visibleLimit).map((offer) => {
      const [date, time] = shortDate(offer.departure_local);
      const departureWeekday = weekdayFor(offer.departure_local);
      const responsiveDuration = offer.duration_minutes
        ? `<span class="responsive-duration"> (${duration(offer.duration_minutes)})</span>`
        : "";
      const returnPrice = cheapestReturnPrice(offer);
      const selected = state.selectedOffer === offer ? "selected" : "";
      return `
        <tr class="${selected}" data-offer-id="${escapeHtml(`${offer.airline}|${offer.destination_iata}|${offer.departure_local}`)}" tabindex="0">
          <td class="column-airline"><span class="airline-cell"><i class="airline-dot ${airlineClass(offer.airline)}"></i><span class="airline-code">${escapeHtml(offer.airline)}</span></span></td>
          <td class="column-destination"><span class="destination-cell">${flag(offer.country_code)}<span class="destination-copy"><strong>${escapeHtml(displayDestination(offer))}</strong><small>BTS → ${escapeHtml(offer.destination_iata)}</small></span></span></td>
          <td class="column-flight"><strong>${escapeHtml(offer.flight_number || "—")}</strong></td>
          <td class="column-departure"><span class="date-cell"><strong>${date} (${escapeHtml(departureWeekday || "—")})</strong><small>${time} → ${escapeHtml((offer.arrival_local || "").split("T")[1] || "—")}${responsiveDuration}</small></span></td>
          <td class="column-duration"><strong>${duration(offer.duration_minutes)}</strong></td>
          <td class="column-distance">${offer.distance_km ? `${integer(offer.distance_km)} km` : "—"}</td>
          <td class="column-price price-cell"><strong>${euro(groupPrice(offer.price))}</strong><small>${returnPrice == null ? t("results.totalUnavailable") : `${t("results.returnFrom")} <b>${euro(groupPrice(Number(offer.price) + returnPrice))}</b>`}</small></td>
          <td class="column-detail"><span class="detail-chevron">›</span></td>
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
    elements.sort.value = state.sortDirection === "asc" && ["departure_local", "price", "round_trip"].includes(state.sortKey) ? state.sortKey : "";
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
    const period = firstDay && lastDay ? `${calendarDate(firstDay)} – ${calendarDate(lastDay)}` : t("return.nextDays");
    let content = "";

    if (!Array.isArray(offer.return_offers)) {
      content = `<div class="return-empty">${t("return.noData")}</div>`;
    } else if (offer.return_search_error) {
      content = `<div class="return-empty">${t("return.error")}</div>`;
    } else {
      const availableReturns = availableReturnOffers(offer);
      if (!availableReturns.length) {
        content = `<div class="return-empty">${t("return.none")}</div>`;
      } else {
        const lowestReturnPrice = Math.min(...availableReturns.map((item) => item.price));
        content = `<div class="return-list">${availableReturns.map((item) => {
          const time = String(item.departure_local || "").split("T")[1] || "—";
          const cheapest = item.price === lowestReturnPrice;
          const stay = stayLength(offer.departure_local, item.departure_local);
          const optionContent = `
              ${roundAirlineLogo(offer.airline)}
              <div class="return-when">
                <strong>${returnDate(item.departure_local)}${stay ? `: ${stay}` : ""}</strong>
                <span>${escapeHtml(item.origin_iata)} → BTS · ${escapeHtml(time)}</span>
              </div>
              <span class="return-badge">${cheapest ? t("return.cheapest") : ""}</span>
              <div class="return-total"><span>${t("return.total")}</span><strong>${euro(groupPrice(Number(offer.price) + Number(item.price)))}</strong></div>`;
          const flightButton = window.FlightBookingButtons.createReturnButton({
            airline: offer.airline,
            trip: {
              originIata: offer.origin_iata || "BTS",
              destinationIata: offer.destination_iata,
              outboundDate: offer.departure_local,
              returnDate: item.departure_local,
              adults: state.travellers,
            },
            className: "return-flight-link",
            label: t("return.bookingLabel", {
              airline: offer.airline,
              origin: offer.origin_iata || "BTS",
              destination: offer.destination_iata,
              outbound: String(offer.departure_local).slice(0, 10),
              returnDate: String(item.departure_local).slice(0, 10),
            }),
            content: optionContent,
          });
          const hotelStay = {
            destinationIata: offer.destination_iata,
            destinationName: window.FLIGHT_TRANSLATIONS.en.destinations[offer.destination_iata] || displayDestination(offer),
            checkinDate: offer.arrival_local || offer.departure_local,
            checkoutDate: item.departure_local,
            adults: state.travellers,
          };
          const hotelButton = window.BookingComLinks.createButton({
            stay: hotelStay,
            label: t("hotel.bookingLabel", {
              destination: displayDestination(offer),
              checkin: String(hotelStay.checkinDate).slice(0, 10),
              checkout: String(hotelStay.checkoutDate).slice(0, 10),
            }),
          });
          return `<article class="return-option${cheapest ? " cheapest" : ""}${hotelButton ? "" : " no-hotel-link"}">${flightButton}${hotelButton}</article>`;
        }).join("")}</div>`;
      }
    }

    return `
      <section class="return-section">
        <div class="return-heading">
          <div><span class="eyebrow">${t("return.eyebrow")}</span><h3>${t("return.title")}</h3></div>
          <small>${t("return.period", { period, travellers: state.travellers })}</small>
        </div>
        ${content}
      </section>`;
  }

  function clearDetailMap() {
    detailMap?.remove();
    detailMap = null;
  }

  function initDetailMap(offer) {
    const container = elements.detail.querySelector("#detail-map");
    if (!container || !window.L) return;
    container.innerHTML = "";
    detailMap = L.map(container, { zoomControl: false, scrollWheelZoom: false, dragging: false, touchZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false }).setView([offer.latitude, offer.longitude], 5);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(detailMap);
    L.circleMarker([offer.latitude, offer.longitude], { radius: 6, color: "#fff", weight: 2, fillColor: "#dc2626", fillOpacity: 1 }).addTo(detailMap);
    detailMap.invalidateSize();
  }

  function showOffer(offer, track = true) {
    clearDetailMap();
    if (track) window.FlightStatistics?.trackClick("offer_open", offer.airline);
    state.selectedOffer = offer;
    const schedule = (offer.operating_schedule || []).map((item) => `<span class="schedule-chip">${escapeHtml(translatedSchedule(item))}</span>`).join("");
    const cssClass = airlineClass(offer.airline);
    const returnPrice = cheapestReturnPrice(offer);
    const roundTripPrice = returnPrice == null ? null : Number(offer.price) + returnPrice;
    const hasCoordinates = Number.isFinite(offer.latitude) && Number.isFinite(offer.longitude) && Math.abs(offer.latitude) <= 90 && Math.abs(offer.longitude) <= 180;
    const mapUrl = hasCoordinates ? `https://www.openstreetmap.org/?mlat=${offer.latitude}&mlon=${offer.longitude}#map=5/${offer.latitude}/${offer.longitude}` : null;
    elements.detail.innerHTML = `
      <div class="detail-hero ${cssClass}">
        <div class="detail-airline">${airlineLogo(offer.airline)}</div>
        <div class="detail-route">
          <div><b>BTS</b><small>Bratislava</small></div>
          <div class="detail-flight">
            <strong>${escapeHtml(offer.flight_number || "—")}</strong>
            <span class="detail-plane">✈</span>
            <small>${duration(offer.duration_minutes)}</small>
          </div>
          <div><b>${escapeHtml(offer.destination_iata)}</b><small>${escapeHtml(displayDestination(offer))}, ${escapeHtml(displayCountry(offer))}</small></div>
        </div>
      </div>
      <div class="detail-body">
        <div class="detail-price${hasCoordinates ? " has-map" : ""}">
          <div><span>${t("detail.selectedPrice")}</span><strong>${euro(groupPrice(offer.price))}</strong><small>${t("detail.oneWayFare")}</small></div>
          ${hasCoordinates ? `<section id="detail-map" class="detail-minimap" aria-label="${escapeHtml(t("detail.mapLabel", { destination: displayDestination(offer) }))}"><a href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener noreferrer">${t("detail.openMap")}</a></section>` : ""}
          <div><span>${t("detail.cheapestRoundTrip")}</span><strong>${roundTripPrice == null ? "—" : euro(groupPrice(roundTripPrice))}</strong><small>${t("detail.roundTrip")}</small></div>
        </div>
        <div class="detail-grid">
          <div class="detail-item"><span>${t("detail.country")}</span><strong>${flag(offer.country_code)} ${escapeHtml(displayCountry(offer))}</strong></div>
          <div class="detail-item"><span>${t("detail.distance")}</span><strong>${offer.distance_km ? `${integer(offer.distance_km)} km` : "—"}</strong></div>
          <div class="detail-item"><span>${t("detail.departure")}</span><strong>${detailDateTime(offer.departure_local)}</strong></div>
          <div class="detail-item"><span>${t("detail.arrival")}</span><strong>${detailDateTime(offer.arrival_local)}</strong></div>
        </div>
        <h3 class="schedule-title">${t("detail.schedule")}</h3>
        <div class="schedule-list">${schedule || t("detail.noSchedule")}</div>
        ${renderReturnOffers(offer)}
      </div>`;
    if (typeof elements.dialog.showModal === "function") elements.dialog.showModal();
    initDetailMap(offer);
    syncUrl();
    focusRouteOnMap(offer);
    renderTable(visibleOffers);
  }

  function initMap() {
    if (typeof window.L === "undefined") {
      document.querySelector("#map").hidden = true;
      document.querySelector("#map-fallback").hidden = false;
      return;
    }
    map = L.map("map", { zoomControl: true, minZoom: 2, zoomSnap: 0.25 }).setView([48.5, 15], 4);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    routeLayer = L.layerGroup().addTo(map);
    const origin = payload.origin;
    L.circleMarker([origin.latitude, origin.longitude], {
      radius: 8, color: "#fff", weight: 3, fillColor: "#f4ce24", fillOpacity: 1,
    }).bindPopup(`<strong>Bratislava (BTS)</strong><br>${t("map.originPopup")}`).addTo(map);
  }

  function renderMap(items) {
    if (!map || !routeLayer) return;
    const origin = [payload.origin.latitude, payload.origin.longitude];
    const routes = new Map();
    items.filter((offer) => offer.latitude != null && offer.longitude != null).forEach((offer) => {
      const routeKey = `${offer.airline}|${offer.destination_iata}`;
      const current = routes.get(routeKey);
      if (!current || offer.price < current.price) routes.set(routeKey, offer);
    });
    if (routes.size === mappedRoutes.size && [...routes].every(([key, offer]) => mappedRoutes.get(key) === offer)) {
      updateOpenMapPopups();
      return;
    }
    mappedRoutes = routes;
    routeLayer.clearLayers();
    mapMarkers = [];
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
      mapMarkers.push({ marker, offer });
      marker.bindPopup(() => renderMapPopup(offer));
      marker.on("popupopen", (event) => {
        bindMapPopup(event.popup, offer);
      });
    });
  }

  function bindMapPopup(popup, offer) {
    const button = popup.getElement()?.querySelector("[data-map-offer]");
    button?.addEventListener("click", () => showOffer(offer), { once: true });
  }

  function updateOpenMapPopups() {
    mapMarkers.forEach(({ marker, offer }) => {
      if (!marker.isPopupOpen()) return;
      marker.setPopupContent(renderMapPopup(offer));
      bindMapPopup(marker.getPopup(), offer);
    });
  }

  function renderMapPopup(offer) {
    return `
        <div class="map-popup">
          <strong>${escapeHtml(displayDestination(offer))} (${escapeHtml(offer.destination_iata)})</strong>
          <div class="popup-route">${flag(offer.country_code)} ${escapeHtml(displayCountry(offer))} · ${escapeHtml(offer.airline)}</div>
          <div class="popup-line"><span>${t("map.priceFrom")}</span><b>${euro(groupPrice(offer.price))}</b></div>
          <div class="popup-line"><span>${t("map.duration")}</span><b>${duration(offer.duration_minutes)}</b></div>
          <button type="button" data-map-offer="${escapeHtml(`${offer.airline}|${offer.destination_iata}`)}">${t("map.flightDetail")}</button>
        </div>`;
  }

  function fitVisibleMap() {
    if (!map) return;
    const points = [[payload.origin.latitude, payload.origin.longitude], ...visibleOffers
      .filter((offer) => offer.latitude != null && offer.longitude != null)
      .map((offer) => [offer.latitude, offer.longitude])];
    if (points.length > 1) map.fitBounds(points, { padding: [16, 16], maxZoom: 6 });
  }

  function focusRouteOnMap(offer) {
    if (!map || offer.latitude == null) return;
    map.fitBounds([
      [payload.origin.latitude, payload.origin.longitude],
      [offer.latitude, offer.longitude],
    ], { padding: [65, 65], maxZoom: 6 });
  }

  function render() {
    visibleLimit = 30;
    visibleOffers = filteredAndSortedOffers();
    renderStats(visibleOffers);
    renderTable(visibleOffers);
    renderMap(visibleOffers);
    renderSortHeaders();
    syncUrl();
  }

  function resetFilters() {
    state.destination = "";
    state.maxPrice = maxPrice;
    state.maxDuration = maxDuration;
    state.travellers = 1;
    state.stay = "";
    state.weekend = false;
    state.sortKey = "departure_local";
    state.sortDirection = "asc";
    state.selectedOffer = null;
    elements.stay.value = "";
    elements.weekend.checked = false;
    state.firstVisibleDay = defaultVisibleDay();
    calendarCursor = startOfMonth(addDays(payload.start_date, state.firstVisibleDay));
    populateDestinations();
    syncPriceControl();
    updateTravellerControl();
    elements.duration.value = maxDuration;
    syncDateRange();
    renderCalendar();
    renderAirlineSummary();
    updateRangeLabels();
    render();
    fitVisibleMap();
  }

  function bindCollapsibleSections() {
    document.querySelectorAll("[data-collapsible]").forEach((section) => {
      const toggle = section.querySelector(".section-toggle");
      if (!toggle) return;
      const contentId = toggle.getAttribute("aria-controls");
      const content = contentId ? document.querySelector(`#${contentId}`) : null;
      if (!content) return;

      toggle.addEventListener("click", () => {
        const collapsed = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", String(!collapsed));
        toggle.setAttribute("aria-label", t(collapsed ? "collapse.show" : "collapse.hide", {
          section: t(toggle.dataset.sectionKey),
        }));
        section.classList.toggle("collapsed", collapsed);
        content.hidden = collapsed;
        if (collapsed && contentId === "filters-content") document.querySelector("#calendar-content").hidePopover?.();

        if (!collapsed && contentId === "map-content" && map) {
          window.setTimeout(() => {
            map.invalidateSize();
            fitVisibleMap();
          }, 0);
        }
      });
    });
  }

  function bindEvents() {
    bindCollapsibleSections();
    const calendarPopover = document.querySelector("#calendar-content");
    const departurePicker = document.querySelector("#departure-picker");
    function positionCalendar() {
      const rect = departurePicker.getBoundingClientRect();
      const width = Math.min(320, window.innerWidth - 24);
      calendarPopover.style.width = `${width}px`;
      calendarPopover.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`;
      calendarPopover.style.top = `${Math.max(12, Math.min(rect.bottom + 6, window.innerHeight - 450))}px`;
    }
    calendarPopover.addEventListener("beforetoggle", (event) => {
      if (event.newState === "open") {
        calendarCursor = startOfMonth(addDays(payload.start_date, state.firstVisibleDay));
        renderCalendar();
        positionCalendar();
      }
      departurePicker.setAttribute("aria-expanded", String(event.newState === "open"));
    });
    window.addEventListener?.("resize", () => { if (calendarPopover.matches(":popover-open")) positionCalendar(); });
    window.matchMedia?.("(max-width: 680px)").addEventListener("change", renderCalendar);
    elements.departure.addEventListener("change", () => {
      if (elements.departure.value) selectCalendarDay(dayOffset(elements.departure.value));
      else syncDateRange();
    });
    elements.stay.addEventListener("change", () => { state.stay = elements.stay.value; render(); });
    elements.weekend.addEventListener("change", () => { state.weekend = elements.weekend.checked; render(); });
    elements.sort.addEventListener("change", () => { state.sortKey = elements.sort.value; state.sortDirection = "asc"; render(); });
    document.querySelector("#more-offers").addEventListener("click", () => { visibleLimit += 30; renderTable(visibleOffers); });
    elements.dialog.addEventListener("close", () => { clearDetailMap(); state.selectedOffer = null; syncUrl(); renderTable(visibleOffers); });
    elements.destination.addEventListener("change", (event) => { state.destination = event.target.value; render(); });
    elements.price.addEventListener("input", (event) => { state.maxPrice = Number(event.target.value) / state.travellers; updateRangeLabels(); render(); });
    elements.duration.addEventListener("input", (event) => { state.maxDuration = Number(event.target.value); updateRangeLabels(); render(); });
    elements.travellerMinus.addEventListener("click", () => setTravellers(state.travellers - 1));
    elements.travellerPlus.addEventListener("click", () => setTravellers(state.travellers + 1));
    elements.calendarMonths.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-calendar-day]");
      if (!button || button.disabled) return;
      selectCalendarDay(Number(button.dataset.calendarDay));
      calendarPopover.hidePopover?.();
      departurePicker.focus?.();
    });
    elements.calendarRegion.addEventListener("change", (event) => {
      schoolRegion = event.target.value;
      schoolHolidays = schoolHolidaysByRegion[schoolRegion] || new Set();
      renderCalendar();
    });
    elements.calendarPrevious.addEventListener("click", () => {
      calendarCursor = addMonths(calendarCursor, -1);
      renderCalendar();
    });
    elements.calendarNext.addEventListener("click", () => {
      calendarCursor = addMonths(calendarCursor, 1);
      renderCalendar();
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
    document.querySelector("#scan-time").innerHTML = `<span class="scan-label">${t("header.updated")}</span><span class="scan-date">${scanned.toLocaleString(i18n.locale, { dateStyle: "short", timeStyle: "short", timeZone: "UTC" })} UTC</span>`;
  }

  restoreSearch();
  populateControls();
  renderAirlineSummary();
  initHeader();
  initMap();
  bindEvents();
  render();
  fitVisibleMap();
  if (initialQuery.has("offer")) {
    const sharedOffer = flights.find(offer => offerKey(offer) === initialQuery.get("offer"));
    if (sharedOffer) showOffer(sharedOffer, false);
    else {
      const status = document.querySelector("#share-status");
      status.textContent = t("share.expired");
      status.hidden = false;
    }
  }
  if (typeof fetch === "function") {
    const readJson = (path) => fetch(path, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(`${path}_unavailable`)));
    const expandPeriods = (periods) => periods.flatMap((period) => {
      const dates = [];
      let current = isoDate(period.start);
      const end = isoDate(period.end);
      while (current && end && current <= end) {
        dates.push(current.toISOString().slice(0, 10));
        current = addDays(current, 1);
      }
      return dates;
    });
    Promise.all([readJson("holidays-sk.json"), readJson("school-holidays-sk.json")])
      .then(([holidayData, schoolHolidayData]) => {
        publicHolidays = new Set((holidayData.holidays || []).map((item) => item.date));
        schoolHolidaysByRegion = Object.fromEntries(
          Object.entries(schoolHolidayData.regions || {}).map(([region, data]) => [
            region, new Set(expandPeriods([...(schoolHolidayData.periods || []), ...(data.periods || [])])),
          ]),
        );
        schoolHolidays = schoolHolidaysByRegion[schoolRegion] || new Set();
        renderCalendar();
      })
      .catch(() => {});
  }
})();
