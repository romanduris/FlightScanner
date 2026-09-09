(() => {
  "use strict";
  const link = document.querySelector("#support-link");
  const dialog = document.querySelector("#support-dialog");
  const frame = document.querySelector("#support-frame");
  const close = document.querySelector("#support-close");
  if (!link || !dialog || !frame || !close || typeof dialog.showModal !== "function") return;

  frame.title = window.FlightI18n.t("support.frameTitle");
  link.addEventListener("click", (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (!frame.getAttribute("src")) {
      frame.src = "https://ko-fi.com/rodulab/?hidefeed=true&widget=true&embed=true&preview=true";
    }
    dialog.showModal();
  });
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => link.focus());
})();
