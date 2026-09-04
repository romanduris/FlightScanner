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
  const visibleWindowDays = Math.min(30, scanDays);
  const initialVisibleDay = defaultVisibleDay();
  const totalDestinations = new Set(offers.map((offer) => offer.destination_iata)).size;
  const maxPrice = Math.ceil(Math.max(...flights.map((offer) => offer.price)) / 5) * 5;
  const maxDuration = Math.ceil(Math.max(...flights.map((offer) => offer.duration_minutes || 0)) / 15) * 15;
  const state = {
    country: "",
    destination: "",
    maxPrice,
    maxDuration,
    travellers: 1,
    firstVisibleDay: initialVisibleDay,
    lastVisibleDay: Math.min(lastScanDay, initialVisibleDay + visibleWindowDays - 1),
    selectedWeekdays: new Set(),
    sortKey: "departure_local",
    sortDirection: "asc",
    selectedOffer: null,
  };
  let map = null;
  let routeLayer = null;
  let visibleOffers = [...flights];
  let calendarCursor = startOfMonth(addDays(payload.start_date, initialVisibleDay));

  const elements = {
    country: document.querySelector("#country-filter"),
    destination: document.querySelector("#destination-filter"),
    price: document.querySelector("#price-filter"),
    priceOutput: document.querySelector("#price-output"),
    duration: document.querySelector("#duration-filter"),
    durationOutput: document.querySelector("#duration-output"),
    dateTo: document.querySelector("#date-to-filter"),
    dateFromOutput: document.querySelector("#date-from-output"),
    dateToOutput: document.querySelector("#date-to-output"),
    dateRange: document.querySelector("#date-range"),
    travellerMinus: document.querySelector("#traveller-minus"),
    travellerCount: document.querySelector("#traveller-count"),
    travellerPlus: document.querySelector("#traveller-plus"),
    calendarMonths: document.querySelector("#calendar-months"),
    calendarSelectedDate: document.querySelector("#calendar-selected-date"),
    calendarPrevious: document.querySelector("#calendar-prev"),
    calendarNext: document.querySelector("#calendar-next"),
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
    const result = isoDate(value);
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
    return i18n.destinationName(offer.destination_iata, offer.destination_name);
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
    const matchingOffers = state.country
      ? offers.filter((offer) => offer.country_code === state.country)
      : offers;
    const destinations = new Map();
    matchingOffers.forEach((offer) => destinations.set(offer.destination_iata, displayDestination(offer)));
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
    state.travellers = Math.max(1, Math.min(9, Number(value) || 1));
    syncPriceControl();
    updateTravellerControl();
    renderAirlineSummary();
    updateRangeLabels();
    render();
  }

  function populateControls() {
    const countries = new Map();
    offers.forEach((offer) => countries.set(offer.country_code, displayCountry(offer)));
    const sortedCountries = [...countries.entries()].sort(([, nameA], [, nameB]) => nameA.localeCompare(nameB, i18n.locale));
    elements.country.innerHTML = [
      `<option value="">${t("filters.allCountries")}</option>`,
      ...sortedCountries.map(([code, name]) => `<option value="${escapeHtml(code)}">${escapeHtml(name)}</option>`),
    ].join("");
    populateDestinations();
    elements.weekdays.innerHTML = weekdays.map((day) => `<button type="button" data-weekday="${day}" aria-pressed="false">${day}</button>`).join("");
    syncPriceControl();
    updateTravellerControl();
    elements.duration.max = maxDuration;
    elements.duration.value = maxDuration;
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
    elements.dateFromOutput.value = rangeDateLabel(addDays(payload.start_date, state.firstVisibleDay));
    elements.dateToOutput.value = rangeDateLabel(addDays(payload.start_date, state.lastVisibleDay));
    const windowEndDay = Math.min(lastScanDay, state.firstVisibleDay + visibleWindowDays - 1);
    const scale = Math.max(1, windowEndDay - state.firstVisibleDay);
    elements.dateRange.style.setProperty("--range-to", `${((state.lastVisibleDay - state.firstVisibleDay) / scale) * 100}%`);
  }

  function syncDateRange() {
    const windowEndDay = Math.min(lastScanDay, state.firstVisibleDay + visibleWindowDays - 1);
    state.lastVisibleDay = Math.max(state.firstVisibleDay, Math.min(state.lastVisibleDay, windowEndDay));
    elements.dateTo.min = state.firstVisibleDay;
    elements.dateTo.max = windowEndDay;
    elements.dateTo.value = state.lastVisibleDay;
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
      const classes = [
        offset === state.firstVisibleDay ? "selected" : "",
        offset === todayOffset ? "today" : "",
        date.getUTCDay() === 0 || date.getUTCDay() === 6 ? "weekend" : "",
      ].filter(Boolean).join(" ");
      cells.push(`<button type="button" class="${classes}" data-calendar-day="${offset}" ${unavailable ? "disabled" : ""} aria-label="${escapeHtml(t("calendar.selectDay", { date: calendarDayLabel(date) }))}" aria-pressed="${offset === state.firstVisibleDay}">${day}</button>`);
    }
    return `<section class="calendar-month"><h3>${escapeHtml(calendarMonthTitle(monthStart))}</h3><div class="calendar-weekdays">${weekdays.map((day) => `<span>${escapeHtml(day)}</span>`).join("")}</div><div class="calendar-days">${cells.join("")}</div></section>`;
  }

  function renderCalendar() {
    const firstMonth = startOfMonth(payload.start_date);
    const lastMonth = startOfMonth(addDays(payload.start_date, lastScanDay));
    const latestCursor = lastMonth > firstMonth ? addMonths(lastMonth, -1) : firstMonth;
    if (calendarCursor < firstMonth) calendarCursor = firstMonth;
    if (calendarCursor > latestCursor) calendarCursor = latestCursor;
    elements.calendarSelectedDate.textContent = rangeDateLabel(addDays(payload.start_date, state.firstVisibleDay));
    elements.calendarMonths.innerHTML = [calendarCursor, addMonths(calendarCursor, 1)].map(renderCalendarMonth).join("");
    elements.calendarPrevious.disabled = calendarCursor <= firstMonth;
    elements.calendarNext.disabled = calendarCursor >= latestCursor;
  }

  function selectCalendarDay(requestedDay) {
    state.firstVisibleDay = clampVisibleDay(requestedDay);
    state.lastVisibleDay = Math.min(lastScanDay, state.firstVisibleDay + visibleWindowDays - 1);
    syncDateRange();
    renderCalendar();
    updateRangeLabels();
    render();
    fitVisibleMap();
  }

  function filteredAndSortedOffers() {
    const firstVisibleDate = addDays(payload.start_date, state.firstVisibleDay);
    const lastVisibleDate = addDays(payload.start_date, state.lastVisibleDay);
    const filtered = flights.filter((offer) => {
      const departureDate = isoDate(offer.departure_local);
      return (!state.country || offer.country_code === state.country)
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
      return String(valueA).localeCompare(String(valueB), i18n.locale, { numeric: true }) * direction;
    });
  }

  function renderStats(items) {
    document.querySelector("#stat-routes").textContent = new Set(items.map((item) => item.destination_iata)).size;
    document.querySelector("#stat-routes-total").textContent = t("overview.destinationCount", { count: totalDestinations });
    document.querySelector("#stat-countries").textContent = new Set(items.map((item) => item.country_code)).size;
    document.querySelector("#stat-flights").textContent = integer(items.length);
  }

  function availableReturnOffers(offer) {
    if (!Array.isArray(offer.return_offers) || offer.return_search_error) return [];
    const windowDays = Number(payload.return_window_days) || 10;
    const firstDay = addDays(offer.departure_local, 1);
    const lastDay = addDays(offer.departure_local, windowDays);
    return offer.return_offers.filter((item) => {
      const departure = isoDate(item.departure_local);
      return departure && firstDay && lastDay
        && departure >= firstDay
        && departure <= lastDay
        && Number.isFinite(Number(item.price));
    });
  }

  function cheapestReturnPrice(offer) {
    const availableReturns = availableReturnOffers(offer);
    return availableReturns.length ? Math.min(...availableReturns.map((item) => Number(item.price))) : null;
  }

  function renderTable(items) {
    elements.resultCount.textContent = items.length;
    elements.empty.hidden = items.length !== 0;
    elements.rows.innerHTML = items.map((offer) => {
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
          <td class="column-price price-cell">${euro(groupPrice(offer.price))}<small>${returnPrice == null ? t("results.totalUnavailable") : `${euro(groupPrice(offer.price + returnPrice))}*`}</small></td>
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
          const optionContent = `
              ${roundAirlineLogo(offer.airline)}
              <div class="return-when">
                <strong>${returnDate(item.departure_local)}</strong>
                <span>${escapeHtml(item.origin_iata)} → BTS · ${escapeHtml(time)}</span>
              </div>
              <span class="return-badge">${cheapest ? t("return.cheapest") : ""}</span>
              <div class="return-price"><span>${t("return.journey")}</span><strong>${euro(groupPrice(item.price))}</strong></div>
              <div class="return-total"><span>${t("return.total")}</span><strong>${euro(groupPrice(offer.price + item.price))}</strong></div>`;
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
          <small>${t("return.period", { period })}</small>
        </div>
        ${content}
      </section>`;
  }

  function showOffer(offer) {
    state.selectedOffer = offer;
    const schedule = (offer.operating_schedule || []).map((item) => `<span class="schedule-chip">${escapeHtml(translatedSchedule(item))}</span>`).join("");
    const cssClass = airlineClass(offer.airline);
    const returnPrice = cheapestReturnPrice(offer);
    const roundTripPrice = returnPrice == null ? null : Number(offer.price) + returnPrice;
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
        <div class="detail-price">
          <div><span>${t("detail.selectedPrice")}</span><strong>${euro(groupPrice(offer.price))}</strong><small>${t("detail.oneWayFare")}</small></div>
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
    }).bindPopup(`<strong>Bratislava (BTS)</strong><br>${t("map.originPopup")}`).addTo(map);
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
          <strong>${escapeHtml(displayDestination(offer))} (${escapeHtml(offer.destination_iata)})</strong>
          <div class="popup-route">${flag(offer.country_code)} ${escapeHtml(displayCountry(offer))} · ${escapeHtml(offer.airline)}</div>
          <div class="popup-line"><span>${t("map.priceFrom")}</span><b>${euro(groupPrice(offer.price))}</b></div>
          <div class="popup-line"><span>${t("map.duration")}</span><b>${duration(offer.duration_minutes)}</b></div>
          <button type="button" data-map-offer="${escapeHtml(`${offer.airline}|${offer.destination_iata}`)}">${t("map.flightDetail")}</button>
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
    state.travellers = 1;
    state.firstVisibleDay = defaultVisibleDay();
    state.lastVisibleDay = Math.min(lastScanDay, state.firstVisibleDay + visibleWindowDays - 1);
    calendarCursor = startOfMonth(addDays(payload.start_date, state.firstVisibleDay));
    state.selectedWeekdays.clear();
    elements.country.value = "";
    populateDestinations();
    syncPriceControl();
    updateTravellerControl();
    elements.duration.value = maxDuration;
    syncDateRange();
    elements.weekdays.querySelectorAll("button").forEach((button) => {
      button.classList.remove("active");
      button.setAttribute("aria-pressed", "false");
    });
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
    elements.country.addEventListener("change", (event) => {
      state.country = event.target.value;
      state.destination = "";
      populateDestinations();
      render();
    });
    elements.destination.addEventListener("change", (event) => { state.destination = event.target.value; render(); });
    elements.price.addEventListener("input", (event) => { state.maxPrice = Number(event.target.value) / state.travellers; updateRangeLabels(); render(); });
    elements.duration.addEventListener("input", (event) => { state.maxDuration = Number(event.target.value); updateRangeLabels(); render(); });
    elements.travellerMinus.addEventListener("click", () => setTravellers(state.travellers - 1));
    elements.travellerPlus.addEventListener("click", () => setTravellers(state.travellers + 1));
    elements.dateTo.addEventListener("input", (event) => {
      state.lastVisibleDay = Number(event.target.value);
      updateRangeLabels();
      render();
      fitVisibleMap();
    });
    elements.calendarMonths.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-calendar-day]");
      if (!button || button.disabled) return;
      selectCalendarDay(Number(button.dataset.calendarDay));
    });
    elements.calendarPrevious.addEventListener("click", () => {
      calendarCursor = addMonths(calendarCursor, -1);
      renderCalendar();
    });
    elements.calendarNext.addEventListener("click", () => {
      calendarCursor = addMonths(calendarCursor, 1);
      renderCalendar();
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

  populateControls();
  renderAirlineSummary();
  initHeader();
  initMap();
  bindEvents();
  render();
  fitVisibleMap();
})();
