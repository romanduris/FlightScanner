(() => {
  "use strict";
  if (!globalThis.crypto?.randomUUID) return;

  const session = crypto.randomUUID();
  let visibleSince = document.visibilityState === "visible" ? performance.now() : null;
  let unsentSeconds = 0;

  function send(payload) {
    const body = JSON.stringify({ session, path: location.pathname, ...payload });
    if (navigator.sendBeacon) {
      const queued = navigator.sendBeacon(
        "/api/statistics/engagement",
        new Blob([body], { type: "application/json" }),
      );
      if (queued) return;
    }
    fetch("/api/statistics/engagement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  }

  function trackClick(event, provider = "") {
    send({ event, provider });
  }

  window.FlightStatistics = Object.freeze({ trackClick });

  function collect() {
    if (visibleSince == null) return;
    unsentSeconds += Math.max(0, (performance.now() - visibleSince) / 1000);
    visibleSince = null;
  }

  function flush() {
    collect();
    const seconds = Math.min(120, Math.round(unsentSeconds));
    if (seconds < 2) return;
    send({ seconds });
    unsentSeconds = Math.max(0, unsentSeconds - seconds);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") visibleSince = performance.now();
    else flush();
  });
  addEventListener("pagehide", flush);
  document.addEventListener("click", (clickEvent) => {
    const target = clickEvent.target.closest?.("[data-stat-click]");
    if (target) trackClick(target.dataset.statClick, target.dataset.statProvider || "");
  });
  setInterval(() => {
    flush();
    if (document.visibilityState === "visible") visibleSince = performance.now();
  }, 30_000);
})();
