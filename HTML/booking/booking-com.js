(() => {
  "use strict";

  const citySearchByAirport = {
    BSL: "Basel",
    CIA: "Rome",
    CRL: "Brussels",
    FCO: "Rome",
    LBA: "Leeds",
    LTN: "London",
    MXP: "Milan",
    PMI: "Palma de Mallorca",
    STN: "London",
    WAW: "Warsaw",
    WMI: "Warsaw",
  };

  function escapeAttribute(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
    })[character]);
  }

  function dateOnly(value) {
    const date = String(value || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  }

  function searchDestination(stay) {
    const iata = String(stay.destinationIata || "").toUpperCase();
    return citySearchByAirport[iata]
      || window.FLIGHT_TRANSLATIONS?.en?.destinations?.[iata]
      || stay.destinationName
      || iata;
  }

  function buildUrl(stay) {
    const checkin = dateOnly(stay.checkinDate);
    const checkout = dateOnly(stay.checkoutDate);
    const destination = searchDestination(stay);
    if (!destination || !checkin || !checkout || checkout <= checkin) return null;

    const config = window.BOOKING_COM_CONFIG || {};
    const url = new URL("https://www.booking.com/searchresults.html");
    url.search = new URLSearchParams({
      ss: destination,
      checkin,
      checkout,
      group_adults: String(Math.max(1, Number(stay.adults) || 1)),
      no_rooms: "1",
      group_children: "0",
      currency: "EUR",
      selected_currency: "EUR",
      changed_currency: "1",
    }).toString();

    const affiliateId = String(config.affiliateId || "").trim();
    if (affiliateId) {
      url.searchParams.set("aid", affiliateId);
      const label = String(config.label || "").trim();
      if (label) url.searchParams.set("label", label);
    }
    return url.toString();
  }

  function createButton({ stay, label }) {
    const href = buildUrl(stay);
    if (!href) return "";
    return `<a class="hotel-booking-link" href="${escapeAttribute(href)}" target="_blank" rel="noopener sponsored" data-stat-click="booking_com" data-stat-provider="Booking.com" aria-label="${escapeAttribute(label)}" title="${escapeAttribute(label)}"><strong><span>Booking</span><span>.com</span></strong></a>`;
  }

  window.BookingComLinks = { buildUrl, createButton };
})();
