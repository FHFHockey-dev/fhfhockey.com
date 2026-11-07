// @vitest-environment node
// One bounded read of this season's matchup calendar through the studio's own loader, saved as the exact body the route returns.
import { it, vi } from "vitest";
import { config } from "dotenv";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
config({ path: ".env.local", override: true });
const S = "/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/799e2b6c-f303-4317-8af1-8a92ac6bcb75/scratchpad/real30";
const O = process.env.CAP_OUT ?? "/Users/tim/Code/fhfhockey.com/tasks/artifacts/social-share-expansion-2026-10-31/pager-review-20261101/recapture-e152ce5bc";
it("calendar", async () => {
  const realFetch = globalThis.fetch; const log: unknown[] = [];
  vi.stubGlobal("fetch", (async (input, init) => {
    const u = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const r = await realFetch(input as RequestInfo, init);
    log.push({ host: u.host.split(".").slice(-2).join("."), path: u.pathname.replace("/rest/v1/", ""), query: u.search, status: r.status, range: r.headers.get("content-range") });
    return r;
  }) as typeof fetch);
  const [{ loadMatchupWeeks }, { seasonScope }, { default: client }] = await Promise.all([import("lib/socialShare/modules/shared/periodWindow.sources"), import("lib/socialShare/modules/creaseShift"), import("lib/supabase/public-client")]);
  const readAt = new Date().toISOString();
  const live = await loadMatchupWeeks(client as never, readAt);
  const body = JSON.stringify(live);
  const summary: { name: string }[] = JSON.parse(readFileSync(S + "/summary.json", "utf8"));
  const editions = summary.map(({ name }) => { const { generatedAt } = JSON.parse(readFileSync(`${S}/${name}.json`, "utf8")); return { name, generatedAt, cutoff: seasonScope(generatedAt).through }; });
  writeFileSync(O + "/calendar-response.json", body);
  writeFileSync(O + "/calendar-provenance.json", JSON.stringify({ pin: process.env.PIN, loader: "loadMatchupWeeks(public client, readAt), the matchup-weeks route's own call", readAt, sha256: createHash("sha256").update(body).digest("hex"), requests: log, rows: live.rows.length, liveCutoff: live.cutoff, editions }, null, 1));
}, 60000);
