(() => {
  "use strict";

  // Po prijatí do Booking.com affiliate programu sem stačí doplniť pridelené AID.
  // AID nie je heslo ani API secret; používa sa v odkaze na priradenie rezervácie.
  window.BOOKING_COM_CONFIG = {
    affiliateId: "",
    label: "flightscanner-return-stay",
  };
})();
