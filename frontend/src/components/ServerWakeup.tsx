"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
// /health lives at the server root, not under /api/v1
const HEALTH_URL = API.replace(/\/api\/v1\/?$/, "") + "/health";

const SLOW_AFTER_MS = 2500; // only show the banner if the server hasn't answered by then
const RETRY_EVERY_MS = 2000;
const REQUEST_TIMEOUT_MS = 8000;

async function ping(): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(HEALTH_URL, {
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) return false;
    const json = await res.json().catch(() => null);
    return json?.status === "ok";
  } catch {
    return false; // network error, CORS failure on Render's boot page, or timeout
  } finally {
    clearTimeout(timer);
  }
}

export function ServerWakeup() {
  const [state, setState] = useState<"idle" | "waking" | "ready">("idle");
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let woke = false;
    const started = Date.now();

    const slowTimer = setTimeout(() => {
      if (!cancelled) setState("waking");
    }, SLOW_AFTER_MS);

    const tick = setInterval(() => {
      if (!cancelled) setSeconds(Math.floor((Date.now() - started) / 1000));
    }, 1000);

    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      while (!cancelled) {
        if (await ping()) break;
        woke = true; // at least one failed ping means the server was asleep
        await new Promise((r) => setTimeout(r, RETRY_EVERY_MS));
      }
      if (cancelled) return;
      clearTimeout(slowTimer);
      clearInterval(tick);
      if (woke || Date.now() - started > SLOW_AFTER_MS) {
        setState("ready");
        hideTimer = setTimeout(() => setState("idle"), 6000);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
      clearInterval(tick);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  if (state === "idle") return null;

  return (
    <div className={`wakeup ${state}`} role="status" aria-live="polite">
      {state === "waking" ? (
        <>
          <strong>The server is waking up.</strong> This app&apos;s backend runs
          on Render&apos;s free tier, which sleeps when nobody has used it for a
          while. Starting it can take up to a minute ({seconds}s so far). Please
          wait before signing in.
        </>
      ) : (
        <>
          <strong>The server is awake.</strong> You can sign in and use the app
          now.
        </>
      )}
    </div>
  );
}
