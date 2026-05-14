"use client";

import { useCallback, useRef, useState } from "react";

interface ReceiptSummary {
  url: string;
  chatId: string;
  rootHash?: string;
  txHash?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  receipt?: ReceiptSummary;
  degraded?: boolean;
  filedAt?: number;
}

const VERIFIER_URL = process.env.NEXT_PUBLIC_VERIFIER_URL ?? "http://localhost:5173";

function shortChatId(id: string): string {
  if (!id) return "—";
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function ts(date: Date): string {
  return date.toTimeString().slice(0, 5);
}

function relTime(thenMs: number): string {
  const d = Math.max(1, Math.round((Date.now() - thenMs) / 1000));
  if (d < 60) return `Filed ${d} sec ago`;
  if (d < 3600) return `Filed ${Math.round(d / 60)} min ago`;
  return `Filed ${Math.round(d / 3600)} hr ago`;
}

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "seed-user",
      role: "user",
      content: "What is your refund policy for damaged goods?",
    },
    {
      id: "seed-bot",
      role: "assistant",
      content:
        "If a product arrives damaged, you may return it within 30 days for a full refund or a free replacement at our cost. Send a photo of the damaged item to support@acmerefunds.example within 7 days of delivery, and we will issue a prepaid return label and refund the original payment method within 5 business days of receipt.",
      receipt: {
        url: "sworn://r/9a4f8d2b-1c3e-4f5a-b6d7-8e9f0a1b2c3d",
        chatId: "9a4f8d2b-1c3e-4f5a-b6d7-8e9f0a1b2c3d",
      },
      filedAt: Date.now() - 2000,
    },
  ]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = draft.trim();
      if (!text || pending) return;

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: text,
      };
      setMessages((prev) => [...prev, userMsg]);
      setDraft("");
      setPending(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: text }),
        });
        const json = (await res.json()) as {
          content: string;
          receipt?: ReceiptSummary;
          degraded?: boolean;
        };
        const botMsg: ChatMessage = {
          id: `b-${Date.now()}`,
          role: "assistant",
          content: json.content,
          receipt: json.receipt,
          degraded: json.degraded,
          filedAt: Date.now(),
        };
        setMessages((prev) => [...prev, botMsg]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: `b-${Date.now()}`,
            role: "assistant",
            content:
              "The receipt pipeline is offline. Start a local anchor with `anvil` and a deployed registry to see live anchors.",
            degraded: true,
            filedAt: Date.now(),
          },
        ]);
      } finally {
        setPending(false);
        requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
      }
    },
    [draft, pending]
  );

  return (
    <div className="thread-frame" role="region" aria-label="AcmeRefunds Bot demo">
      <header className="thread-tab">
        <span className="name">AcmeRefunds Bot · v3</span>
        <span>TeeML · gemma-3-27b-it · sealed</span>
      </header>
      <div className="thread" id="thread">
        {messages.map((m) => (
          <article
            key={m.id}
            className={m.role === "user" ? "msg msg-user" : "msg msg-bot"}
          >
            <header className="msg-byline">
              <span className="who">{m.role === "user" ? "You" : "AcmeRefunds Bot"}</span>
              <time>{ts(new Date())}</time>
            </header>
            <p className="bubble">{m.content}</p>
            {m.role === "assistant" && (m.receipt || m.degraded) && (
              <footer className="foot">
                {m.receipt ? (
                  <a
                    className="receipt-pill"
                    href={`${VERIFIER_URL}/r/${m.receipt.chatId}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open receipt for ${shortChatId(m.receipt.chatId)} in the public verifier`}
                  >
                    <span className="pill-icon" aria-hidden="true">S</span>
                    <span className="pill-label">Receipt</span>
                    <span className="pill-id">{shortChatId(m.receipt.chatId)}</span>
                    <span className="pill-arrow" aria-hidden="true">→</span>
                  </a>
                ) : null}
                {m.degraded ? (
                  <span className="micro">Mock-only · no live anchor</span>
                ) : (
                  <span className="micro">
                    {m.filedAt ? relTime(m.filedAt) : "Filed"} · 0G Chain · block 1,247,893
                  </span>
                )}
              </footer>
            )}
          </article>
        ))}
        {pending && (
          <article className="msg msg-typing">
            <header className="msg-byline">
              <span className="who">AcmeRefunds Bot</span>
              <time>now</time>
            </header>
            <p className="bubble">
              <span className="typing-dots" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
              </span>
              drafting under sealed inference…
            </p>
          </article>
        )}
      </div>
      <form className="composer" onSubmit={onSubmit}>
        <label htmlFor="composer" className="visually-hidden">
          Ask the bot
        </label>
        <input
          id="composer"
          ref={inputRef}
          type="text"
          autoComplete="off"
          placeholder="Ask the bot a question and watch a receipt appear…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={pending}
        />
        <button className="btn-send" type="submit" disabled={pending || !draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
