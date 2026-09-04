(() => {
  "use strict";
  if (!crypto?.randomUUID || !navigator.sendBeacon) return;

  const session = crypto.randomUUID();
  let visibleSince = document.visibilityState === "visible" ? performance.now() : null;
  let unsentSeconds = 0;

  function collect() {
    if (visibleSince == null) return;
    unsentSeconds += Math.max(0, (performance.now() - visibleSince) / 1000);
    visibleSince = null;
  }

  function flush() {
    collect();
    const seconds = Math.min(120, Math.round(unsentSeconds));
    if (seconds < 2) return;
    navigator.sendBeacon(
      "/api/statistics/engagement",
      new Blob([JSON.stringify({ session, seconds, path: location.pathname })], { type: "application/json" }),
    );
    unsentSeconds = Math.max(0, unsentSeconds - seconds);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") visibleSince = performance.now();
    else flush();
  });
  addEventListener("pagehide", flush);
  setInterval(() => {
    flush();
    if (document.visibilityState === "visible") visibleSince = performance.now();
  }, 30_000);
})();
