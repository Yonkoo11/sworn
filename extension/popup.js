// Sworn popup. Parses the input into a chatId and opens the verifier in a
// new tab. The popup itself never performs verification (keeps the extension
// surface minimal); the verifier page does all the work.

(function () {
  "use strict";

  const VERIFIER_BASE = "https://yonkoo11.github.io/sworn/r/";

  function chatIdFromInput(input) {
    const t = input.trim();
    if (!t) return "";
    const prefix = "sworn://r/";
    if (t.startsWith(prefix)) return t.slice(prefix.length);
    const m = t.match(/\/r\/([^/?#]+)/);
    if (m) return m[1];
    return t;
  }

  function submit(e) {
    e.preventDefault();
    const value = document.getElementById("pin").value;
    const id = chatIdFromInput(value);
    if (!id) return;
    // Preserve `?k=` if it was on the URL.
    let query = "";
    const sep = value.indexOf("?");
    if (sep !== -1) query = value.slice(sep);
    const url = VERIFIER_BASE + encodeURIComponent(id) + query;
    if (typeof browser !== "undefined" && browser.tabs?.create) {
      browser.tabs.create({ url });
    } else if (typeof chrome !== "undefined" && chrome.tabs?.create) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("pf").addEventListener("submit", submit);
    document.getElementById("pin").focus();
  });
})();
