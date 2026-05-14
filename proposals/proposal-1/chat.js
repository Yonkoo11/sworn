// Proposal 1 — chat panel demo logic.
// Vanilla DOM construction (no innerHTML for untrusted strings).

function makeEl(tag, opts) {
  var el = document.createElement(tag);
  if (!opts) return el;
  if (opts.className) el.className = opts.className;
  if (opts.text != null) el.textContent = opts.text;
  if (opts.attrs) {
    Object.keys(opts.attrs).forEach(function (k) { el.setAttribute(k, opts.attrs[k]); });
  }
  return el;
}

function fakeRandomId() {
  var hex = "0123456789abcdef";
  var head = "";
  for (var i = 0; i < 8; i++) head += hex[Math.floor(Math.random() * 16)];
  var tail = "";
  for (var j = 0; j < 4; j++) tail += hex[Math.floor(Math.random() * 16)];
  return head + "…" + tail;
}

function appendUserMessage(thread, text) {
  var msg = makeEl("article", { className: "msg msg-user" });
  var hd = makeEl("header", { className: "msg-hd" });
  hd.appendChild(makeEl("span", { className: "who", text: "You" }));
  hd.appendChild(makeEl("time", { text: "now" }));
  msg.appendChild(hd);
  msg.appendChild(makeEl("p", { className: "msg-body", text: text }));
  thread.appendChild(msg);
}

function appendBotMessage(thread, replyText) {
  var msg = makeEl("article", { className: "msg msg-bot" });
  var hd = makeEl("header", { className: "msg-hd" });
  hd.appendChild(makeEl("span", { className: "who", text: "AcmeRefunds Bot" }));
  hd.appendChild(makeEl("time", { text: "now" }));
  msg.appendChild(hd);
  msg.appendChild(makeEl("p", { className: "msg-body", text: replyText }));

  var foot = makeEl("footer", { className: "msg-foot" });
  var pill = makeEl("a", { className: "receipt-pill", attrs: { href: "verifier.html", "aria-label": "Open receipt" } });
  pill.appendChild(makeEl("span", { className: "seal-mini", attrs: { "aria-hidden": "true" } }));
  pill.appendChild(makeEl("span", { className: "pill-label", text: "Receipt" }));
  pill.appendChild(makeEl("span", { className: "pill-id", text: fakeRandomId() }));
  pill.appendChild(makeEl("span", { className: "pill-arrow", attrs: { "aria-hidden": "true" }, text: "→" }));
  foot.appendChild(pill);
  foot.appendChild(makeEl("span", { className: "micro", text: "Anchored just now · 0G Chain" }));
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
  appendUserMessage(thread, text);
  input.value = "";
  if (typing) {
    typing.hidden = false;
    thread.appendChild(typing);
  }
  thread.scrollTop = thread.scrollHeight;
  window.setTimeout(function () {
    if (typing) typing.hidden = true;
    appendBotMessage(
      thread,
      "For questions outside the published refund policy, I'll defer to a human agent. The receipt below records exactly that I deferred, so this answer can be entered into evidence."
    );
    thread.scrollTop = thread.scrollHeight;
  }, 1100);
}

function toggleChain() {
  var el = document.getElementById("chainList");
  if (!el) return;
  el.hidden = !el.hidden;
}

window.fakeSend = fakeSend;
window.toggleChain = toggleChain;
