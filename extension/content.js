// Sworn content script — manifest v3.
// Walks the visible text on the page and replaces every `sworn://r/<chatId>`
// reference with an inline verify badge that links to the public verifier.
// No network access in this script; everything routes to the verifier page.
(function () {
  "use strict";

  var VERIFIER_BASE = "https://yonkoo11.github.io/sworn/r/";
  // chatId charset: word chars, hyphen, dot, tilde. Bounded length 8-64.
  var SWORN_RE = /sworn:\/\/r\/([A-Za-z0-9._~-]{8,64})/g;
  var PROCESSED = "data-sworn-processed";

  function makeBadge(chatId) {
    var a = document.createElement("a");
    a.href = VERIFIER_BASE + encodeURIComponent(chatId);
    a.target = "_blank";
    a.rel = "noreferrer";
    a.className = "sworn-receipt-badge";
    a.title = "Verify Sworn receipt for " + chatId;
    a.setAttribute("aria-label", "Verify Sworn receipt for " + chatId);
    a.innerHTML =
      '<span class="sworn-receipt-badge__lock">🔒</span>' +
      '<span class="sworn-receipt-badge__label">receipt</span>' +
      '<span class="sworn-receipt-badge__id">' + chatId.slice(0, 8) + '…</span>' +
      '<span class="sworn-receipt-badge__arrow">→</span>';
    return a;
  }

  function shouldSkip(node) {
    if (!node) return true;
    if (node.nodeType === Node.ELEMENT_NODE) {
      var tag = node.tagName ? node.tagName.toUpperCase() : "";
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA" ||
          tag === "INPUT" || tag === "CODE" || tag === "PRE") return true;
      if (node.classList && node.classList.contains("sworn-receipt-badge")) return true;
    }
    return false;
  }

  function processTextNode(textNode) {
    var text = textNode.nodeValue;
    if (!text || text.indexOf("sworn://r/") === -1) return;
    SWORN_RE.lastIndex = 0;
    var parent = textNode.parentNode;
    if (!parent || shouldSkip(parent)) return;

    var frag = document.createDocumentFragment();
    var last = 0;
    var m;
    while ((m = SWORN_RE.exec(text)) !== null) {
      var before = text.slice(last, m.index);
      if (before) frag.appendChild(document.createTextNode(before));
      frag.appendChild(makeBadge(m[1]));
      last = m.index + m[0].length;
    }
    if (last === 0) return;
    var tail = text.slice(last);
    if (tail) frag.appendChild(document.createTextNode(tail));
    parent.replaceChild(frag, textNode);
  }

  function walk(root) {
    if (shouldSkip(root)) return;
    if (root.hasAttribute && root.hasAttribute(PROCESSED)) return;

    var treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (shouldSkip(node.parentNode)) return NodeFilter.FILTER_REJECT;
        if (node.nodeValue && node.nodeValue.indexOf("sworn://r/") !== -1) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      },
    });
    var nodes = [];
    var n;
    while ((n = treeWalker.nextNode())) nodes.push(n);
    nodes.forEach(processTextNode);
    if (root.setAttribute) root.setAttribute(PROCESSED, "1");
  }

  // Initial sweep.
  walk(document.body);

  // Re-scan when the DOM changes (SPAs, chat UIs).
  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var ms = mutations[i].addedNodes;
      for (var j = 0; j < ms.length; j++) {
        var added = ms[j];
        if (added.nodeType === Node.ELEMENT_NODE) walk(added);
        else if (added.nodeType === Node.TEXT_NODE) processTextNode(added);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
