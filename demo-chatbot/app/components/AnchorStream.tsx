"use client";

import { useEffect, useState } from "react";
import type { AnchorRow } from "../../lib/mock-anchors";
import { buildFreshAnchorRow } from "../../lib/mock-anchors";

export function AnchorStream({ initial }: { initial: AnchorRow[] }) {
  const [rows, setRows] = useState<AnchorRow[]>(initial);
  const [freshKey, setFreshKey] = useState<number>(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    let counter = 1;
    const id = window.setInterval(() => {
      const next = buildFreshAnchorRow(Date.now() ^ counter, Date.now());
      counter += 1;
      setRows((prev) => [next, ...prev.slice(0, prev.length - 1)]);
      setFreshKey((k) => k + 1);
    }, 2400);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="stream" aria-label="Recent anchors on 0G Chain">
      <header className="stream-head">
        <span className="lbl">Recent anchors</span>
        <span className="count">{rows.length} of 1,247,893</span>
      </header>
      <div className="stream-body">
        {rows.map((row, i) => (
          <div
            key={`${row.chatId}-${i}-${i === 0 ? freshKey : 0}`}
            className={`stream-row ${i === 0 ? "fresh" : ""}`}
          >
            <span className="ts">{row.ts}</span>
            <span className="chatid">{row.chatId}</span>
            <span className="badge">verified</span>
          </div>
        ))}
      </div>
    </section>
  );
}
