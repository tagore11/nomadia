"use client";

import { useEffect, useState } from "react";

/**
 * TEMPORARY debug aid — remove once the Telegram wallet-connect issue is
 * confirmed fixed. Telegram's in-app WebView gives no devtools access, so
 * there's no other way to see a JS error that happens inside it; this
 * surfaces the last error directly in the UI so it can just be read off
 * the screen and reported back.
 */
export function DebugErrorOverlay() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    function onError(event: ErrorEvent) {
      setMessage(`${event.message} (${event.filename}:${event.lineno})`);
    }
    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      setMessage(`Unhandled promise rejection: ${reason?.message || String(reason)}`);
    }
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  if (!message) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[9999] rounded-md border border-danger bg-surface p-3 font-mono text-xs text-danger shadow-lg">
      <div className="mb-1 font-bold">DEBUG ERROR</div>
      <div className="break-all">{message}</div>
      <button onClick={() => setMessage(null)} className="mt-2 underline">
        dismiss
      </button>
    </div>
  );
}
