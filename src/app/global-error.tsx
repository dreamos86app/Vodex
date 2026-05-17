"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[DreamOS86] Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <title>DreamOS86 — Something went wrong</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; }
          body {
            margin: 0;
            min-height: 100vh;
            background: #0a0c10;
            color: #f0f0f0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
          }
          .container {
            max-width: 440px;
            width: 100%;
            text-align: center;
          }
          .orb {
            position: fixed;
            inset: 0;
            background: radial-gradient(circle at 60% 20%, rgba(99,102,241,0.06) 0%, transparent 60%);
            pointer-events: none;
          }
          .icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 60px;
            height: 60px;
            border-radius: 16px;
            background: rgba(239,68,68,0.12);
            border: 1px solid rgba(239,68,68,0.25);
            margin-bottom: 1.5rem;
            font-size: 26px;
          }
          h1 {
            font-size: 20px;
            font-weight: 600;
            letter-spacing: -0.03em;
            margin: 0 0 0.5rem;
          }
          p {
            font-size: 13.5px;
            color: #94a3b8;
            line-height: 1.6;
            margin: 0 0 1.75rem;
          }
          .actions {
            display: flex;
            gap: 0.625rem;
            justify-content: center;
            flex-wrap: wrap;
          }
          button, a {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 0.625rem 1.25rem;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            transition: opacity 0.15s;
          }
          button:hover, a:hover { opacity: 0.85; }
          .primary {
            background: #6366f1;
            color: #fff;
            border: none;
          }
          .secondary {
            background: transparent;
            color: #94a3b8;
            border: 1px solid #1e293b;
          }
          .digest {
            margin-top: 1.5rem;
            padding: 0.5rem 0.75rem;
            border-radius: 8px;
            background: rgba(255,255,255,0.04);
            border: 1px solid #1e293b;
            font-family: monospace;
            font-size: 11px;
            color: #475569;
            word-break: break-all;
          }
        `}</style>
      </head>
      <body>
        <div className="orb" />
        <div className="container">
          <div className="icon">⚠️</div>
          <h1>DreamOS86 crashed</h1>
          <p>
            A critical runtime error prevented the platform from loading.
            This has been logged. Retry to recover, or return home.
          </p>
          <div className="actions">
            <button className="primary" onClick={() => unstable_retry()}>
              ↻ &nbsp;Retry
            </button>
            <a className="secondary" href="/">
              ← &nbsp;Return home
            </a>
          </div>
          {error.digest && (
            <div className="digest">Error ID: {error.digest}</div>
          )}
        </div>
      </body>
    </html>
  );
}
