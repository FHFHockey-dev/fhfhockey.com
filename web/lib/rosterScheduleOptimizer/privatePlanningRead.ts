/** A transferred runtime port is separate from saved/request JSON. Only the
 * window's generation-bound broker owns authentication and the actual fetch. */
export function readPrivatePlanning(port: MessagePort, nonce: string, signal: AbortSignal): Promise<{ ok: boolean; body: any }> {
  return new Promise((resolve, reject) => {
    const finish = () => { signal.removeEventListener("abort", abort); port.onmessage = null; port.close(); };
    const abort = () => { port.postMessage({ nonce, cancel: true }); finish(); reject(new DOMException("Obsolete planning generation", "AbortError")); };
    if (signal.aborted) { abort(); return; }
    signal.addEventListener("abort", abort, { once: true });
    port.onmessage = event => {
      if (event.data?.nonce !== nonce) return; // unsolicited or previous generation
      finish();
      if (event.data.error) reject(new Error("Current Yahoo read unavailable."));
      else resolve({ ok: event.data.ok === true, body: event.data.body });
    };
    port.postMessage({ nonce });
  });
}
