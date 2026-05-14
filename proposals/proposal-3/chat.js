// Proposal 3 — chat + verifier helpers.
function el(tag, opts) {
  var n = document.createElement(tag);
  if (!opts) return n;
  if (opts.className) n.className = opts.className;
  if (opts.text != null) n.textContent = opts.text;
  if (opts.attrs) {
    Object.keys(opts.attrs).forEach(function (k) { n.setAttribute(k, opts.attrs[k]); });
  }
  return n;
}
function randId() {
  var hex = "0123456789abcdef";
  var s = "";
  for (var i = 0; i < 8; i++) s += hex[Math.floor(Math.random() * 16)];
  var t = "";
  for (var j = 0; j < 4; j++) t += hex[Math.floor(Math.random() * 16)];
  return s + "…" + t;
}
function appendUser(thread, text) {
  var m = el("article", { className: "msg msg-user" });
  var b = el("header", { className: "msg-byline" });
  b.appendChild(el("span", { className: "who", text: "You" }));
  b.appendChild(el("time", { text: "now" }));
  m.appendChild(b);
  m.appendChild(el("p", { className: "bubble", text: text }));
  thread.appendChild(m);
}
function appendBot(thread, text) {
  var m = el("article", { className: "msg msg-bot" });
  var b = el("header", { className: "msg-byline" });
  b.appendChild(el("span", { className: "who", text: "AcmeRefunds Bot" }));
  b.appendChild(el("time", { text: "now" }));
  m.appendChild(b);
  m.appendChild(el("p", { className: "bubble", text: text }));

  var f = el("footer", { className: "foot" });
  var p = el("a", { className: "receipt-pill", attrs: { href: "verifier.html" } });
  p.appendChild(el("span", { className: "pill-icon", text: "S" }));
  p.appendChild(el("span", { className: "pill-label", text: "Receipt" }));
  p.appendChild(el("span", { className: "pill-id", text: randId() }));
  p.appendChild(el("span", { className: "pill-arrow", text: "→" }));
  f.appendChild(p);
  f.appendChild(el("span", { className: "micro", text: "Filed just now · 0G Chain · block 1,247,894" }));
  m.appendChild(f);

  thread.appendChild(m);
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
      "For questions outside the published refund policy I defer to a human agent. The receipt under this reply records exactly that deferral, so the exchange can be entered into evidence later."
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
