// Proposal 2 — chat panel + verifier helpers.
// DOM-safe construction.

function el(tag, opts) {
  var node = document.createElement(tag);
  if (!opts) return node;
  if (opts.className) node.className = opts.className;
  if (opts.text != null) node.textContent = opts.text;
  if (opts.attrs) {
    Object.keys(opts.attrs).forEach(function (k) { node.setAttribute(k, opts.attrs[k]); });
  }
  return node;
}

function randId() {
  var hex = "0123456789abcdef";
  var s = "";
  for (var i = 0; i < 8; i++) s += hex[Math.floor(Math.random() * 16)];
  return s + "…" + hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)];
}

function appendUser(thread, text) {
  var msg = el("article", { className: "msg msg-user" });
  var meta = el("header", { className: "msg-meta" });
  meta.appendChild(el("span", { className: "role", text: "you" }));
  meta.appendChild(el("time", { text: "now" }));
  msg.appendChild(meta);
  msg.appendChild(el("div", { className: "bubble", text: text }));
  thread.appendChild(msg);
}

function appendBot(thread, text) {
  var msg = el("article", { className: "msg msg-bot" });
  var meta = el("header", { className: "msg-meta" });
  meta.appendChild(el("span", { className: "role", text: "assistant" }));
  meta.appendChild(el("time", { text: "now" }));
  msg.appendChild(meta);
  msg.appendChild(el("div", { className: "bubble", text: text }));

  var foot = el("footer", { className: "foot" });
  var pill = el("a", { className: "receipt-pill", attrs: { href: "verifier.html", "aria-label": "Open receipt" } });
  var lock = el("span", { className: "lockicon", text: "S" });
  pill.appendChild(lock);
  pill.appendChild(el("span", { text: "receipt" }));
  pill.appendChild(el("span", { className: "pill-id", text: randId() }));
  pill.appendChild(el("span", { className: "pill-arrow", text: "→" }));
  foot.appendChild(pill);
  foot.appendChild(el("span", { className: "micro", text: "anchored just now · 0G chain" }));
  msg.appendChild(foot);

  thread.appendChild(msg);
}

function fakeSend() {
  var input = document.getElementById("composer");
  var thread = document.getElementById("thread");
  var typing = document.getElementById("typing");
  if (!input || !thread) return;
  var text = (input.value || "").trim();
  if (!text) return;
  appendUser(thread, text);
  input.value = "";
  if (typing) {
    typing.hidden = false;
    thread.appendChild(typing);
  }
  thread.scrollTop = thread.scrollHeight;
  window.setTimeout(function () {
    if (typing) typing.hidden = true;
    appendBot(
      thread,
      "If your question falls outside the published refund policy I defer to a human agent — the receipt below records that deferral, so this answer can be entered into evidence later."
    );
    thread.scrollTop = thread.scrollHeight;
  }, 1100);
}

function toggleChain() {
  var c = document.getElementById("chainShow");
  if (!c) return;
  c.hidden = !c.hidden;
}

window.fakeSend = fakeSend;
window.toggleChain = toggleChain;
