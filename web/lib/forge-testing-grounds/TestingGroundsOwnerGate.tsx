import { lazy, Suspense, useEffect, useState } from "react";

const Preview = lazy(() => import("./preview/TestingGroundsPreview"));
type GateState = "locked" | "checking" | "granted" | "denied" | "unavailable";

export default function TestingGroundsOwnerGate() {
  const [state, setState] = useState<GateState>("locked");
  useEffect(() => {
    let alive = true;
    let generation = 0;
    let pageHidden = false;
    let request: AbortController | undefined;
    let unsubscribe: (() => void) | undefined;
    let refreshSession: (() => void) | undefined;

    // Auth events cannot release lifecycle withdrawal. A pagehide can occur
    // while visibility still says visible, so it needs its own pageshow latch.
    const foreground = () => alive && !pageHidden && document.visibilityState === "visible";
    const currentForeground = (current: number) => foreground() && current === generation;

    const withdraw = () => {
      generation++;
      request?.abort();
      if (alive) setState("locked");
    };
    const verify = async (token: string | undefined, current: number) => {
      if (!currentForeground(current)) return;
      if (!token) { setState("locked"); return; }
      setState("checking");
      request = new AbortController();
      try {
        const response = await fetch("/api/v1/forge/testing-grounds/access", {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "omit", cache: "no-store", signal: request.signal,
        });
        const body: unknown = response.ok ? await response.json() : null;
        if (!currentForeground(current)) return;
        const granted = response.ok && typeof body === "object" && body !== null
          && "access" in body && body.access === "owner"
          && "workspace" in body && body.workspace === "synthetic_preview"
          && "execution" in body && body.execution === "disabled";
        setState(granted ? "granted" : response.status === 401 || response.status === 403 ? "denied" : "unavailable");
      } catch {
        if (currentForeground(current)) setState("unavailable");
      }
    };

    // Existing browser session is only token transport. It grants no role/owner
    // authority; the dedicated endpoint verifies the user on every handshake.
    void import("../supabase/client").then(({ default: client }) => {
      if (!alive) return;
      const subscription = client.auth.onAuthStateChange((_event, session) => {
        withdraw();
        const current = generation;
        // Do not await Supabase work inside its auth callback/lock.
        queueMicrotask(() => { void verify(session?.access_token, current); });
      });
      unsubscribe = () => subscription.data.subscription.unsubscribe();
      refreshSession = () => {
        withdraw();
        if (!foreground()) return;
        const current = generation;
        void client.auth.getSession().then(({ data, error }) => {
          if (!currentForeground(current)) return;
          if (error) { setState("unavailable"); return; }
          void verify(data.session?.access_token, current);
        }).catch(() => {
          if (currentForeground(current)) setState("unavailable");
        });
      };
      refreshSession();
    }).catch(() => { if (foreground()) setState("unavailable"); });

    const visibility = () => {
      if (!foreground()) withdraw();
      else refreshSession?.();
    };
    const pageHide = () => { pageHidden = true; withdraw(); };
    const pageShow = () => {
      if (!pageHidden) return;
      pageHidden = false;
      if (foreground()) refreshSession?.();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", pageHide);
    window.addEventListener("pageshow", pageShow);
    return () => {
      alive = false; withdraw(); unsubscribe?.();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", pageHide);
      window.removeEventListener("pageshow", pageShow);
    };
  }, []);

  if (state === "granted") return <Suspense fallback={<p role="status">Opening sample workspace…</p>}><Preview /></Suspense>;
  return <section aria-labelledby="testing-grounds-access" style={{ maxWidth: 960, margin: "3rem auto", padding: "0 1.5rem" }}>
    <h1 id="testing-grounds-access">Testing Grounds</h1>
    <p role="status">{state === "checking" ? "Checking owner access…"
      : state === "denied" ? "This workspace is restricted to its configured owner."
      : state === "unavailable" ? "Owner access is unavailable. The workspace remains locked."
      : "Owner sign-in is required. The workspace is locked."}</p>
    <p>The local sample workspace has no connected runner. Launch is disabled.</p>
  </section>;
}
