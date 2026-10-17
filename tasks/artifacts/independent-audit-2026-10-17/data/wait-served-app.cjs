// Wait (max 120 s) until the dev server's served _app chunk does / does not contain "notistack".
// Usage: node wait-served-app.cjs <expect: has|lacks>
const expectHas = process.argv[2] === "has";
const url = "http://127.0.0.1:3107/_next/static/chunks/pages/_app.js";
const deadline = Date.now() + 120_000;
(async function poll() {
  try {
    // Requesting a page triggers on-demand recompilation in next dev.
    await fetch("http://127.0.0.1:3107/db/upsert-projections").then((r) => r.text());
    const body = await fetch(url).then((r) => r.text());
    if (body.includes("SnackbarProvider") === expectHas) {
      console.log(`served _app ${expectHas ? "has" : "lacks"} SnackbarProvider`);
      return;
    }
  } catch {}
  if (Date.now() > deadline) {
    console.log("timeout waiting for served _app state");
    process.exit(1);
  }
  setTimeout(poll, 1500);
})();
