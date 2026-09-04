(() => {
  "use strict";

  const builders = new Map();

  function escapeAttribute(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
    })[character]);
  }

  function normalizedTrip(trip) {
    const normalized = {
      originIata: String(trip.originIata || "").toUpperCase(),
      destinationIata: String(trip.destinationIata || "").toUpperCase(),
      outboundDate: String(trip.outboundDate || "").slice(0, 10),
      returnDate: String(trip.returnDate || "").slice(0, 10),
      adults: Math.max(1, Number(trip.adults) || 1),
    };
    if (!/^[A-Z]{3}$/.test(normalized.originIata)
      || !/^[A-Z]{3}$/.test(normalized.destinationIata)
      || !/^\d{4}-\d{2}-\d{2}$/.test(normalized.outboundDate)
      || !/^\d{4}-\d{2}-\d{2}$/.test(normalized.returnDate)) {
      return null;
    }
    return normalized;
  }

  function register(airline, builder) {
    if (typeof builder !== "function") throw new TypeError("Booking builder musí byť funkcia.");
    builders.set(String(airline), builder);
  }

  function buildUrl(airline, trip) {
    const builder = builders.get(String(airline));
    const normalized = normalizedTrip(trip || {});
    return builder && normalized ? builder(normalized) : null;
  }

  function createReturnButton({ airline, trip, className = "", label, content }) {
    const href = buildUrl(airline, trip);
    if (!href) return `<div class="${escapeAttribute(className)}">${content}</div>`;
    return `<a class="${escapeAttribute(className)}" href="${escapeAttribute(href)}" target="_blank" rel="noopener" data-stat-click="airline_booking" data-stat-provider="${escapeAttribute(airline)}" aria-label="${escapeAttribute(label)}" title="${escapeAttribute(label)}">${content}</a>`;
  }

  window.FlightBookingButtons = { register, buildUrl, createReturnButton };
})();
