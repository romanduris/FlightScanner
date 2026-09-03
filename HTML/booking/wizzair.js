(() => {
  "use strict";

  window.FlightBookingButtons.register("Wizz Air", (trip) => {
    const route = [
      trip.originIata,
      trip.destinationIata,
      trip.outboundDate,
      trip.returnDate,
      trip.adults,
      0,
      0,
      "null",
    ].map(encodeURIComponent).join("/");
    return `https://www.wizzair.com/en-gb/booking/select-flight/${route}`;
  });
})();
