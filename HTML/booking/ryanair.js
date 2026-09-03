(() => {
  "use strict";

  window.FlightBookingButtons.register("RYANAIR", (trip) => {
    const url = new URL("https://www.ryanair.com/sk/sk/trip/flights/select");
    url.search = new URLSearchParams({
      adults: String(trip.adults),
      teens: "0",
      children: "0",
      infants: "0",
      dateOut: trip.outboundDate,
      dateIn: trip.returnDate,
      isConnectedFlight: "false",
      discount: "0",
      promoCode: "",
      isReturn: "true",
      originIata: trip.originIata,
      destinationIata: trip.destinationIata,
      tpAdults: String(trip.adults),
      tpTeens: "0",
      tpChildren: "0",
      tpInfants: "0",
    }).toString();
    return url.toString();
  });
})();
