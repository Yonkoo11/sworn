import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sworn — Evidence for what your AI agent said",
  description:
    "When a chatbot speaks, it speaks for the company. Sworn issues a notarised, TEE-signed receipt under every AI reply, anchored on 0G Chain and persisted on 0G Storage.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
