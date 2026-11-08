// @vitest-environment node
import { it, vi } from "vitest";
import { config } from "dotenv";
import { writeFileSync } from "node:fs";
config({ path: ".env.local", override: true });
const out = "/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/799e2b6c-f303-4317-8af1-8a92ac6bcb75/scratchpad/real36";
const posts: [string, string, Record<string,string>][] = [["off-night-next", "off-night-edge", {"period": "matchup", "week": "6"}], ["off-night-w4", "off-night-edge", {"period": "matchup", "week": "4"}], ["risky-next", "risky-starts", {"period": "matchup", "week": "6"}]];
it("real", async () => {
  const realFetch = globalThis.fetch; let log: {host:string;path:string;status:number;range:string|null}[] = [];
  const counted: typeof fetch = async (input, init) => { const u = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url); let r: Response; try { r = await realFetch(input as RequestInfo, init); } catch (e) { log.push({ host: u.host, path: u.pathname, status: 0, range: null }); throw e; } log.push({ host: u.host.split(".").slice(-2).join("."), path: u.pathname.replace("/rest/v1/",""), status: r.status, range: r.headers.get("content-range") }); return r; };
  vi.stubGlobal("fetch", counted);
  const [{ loadPostSnapshot }, { default: client }] = await Promise.all([import("lib/socialShare/modules/server"), import("lib/supabase/public-client")]);
  const summary: unknown[] = [];
  for (const [name, post, query] of posts) {
    log = []; const t = Date.now(); let snap: any = null, err: string | null = null;
    try { snap = await loadPostSnapshot(post, query, client as never); writeFileSync(out + "/" + name + ".json", JSON.stringify(snap)); } catch (e) { err = String(e); }
    const rows: Record<string, number> = {}; for (const l of log) { const m = l.range?.match(/^(\d+)-(\d+)/); rows[l.path] = (rows[l.path] ?? 0) + (m ? Number(m[2]) - Number(m[1]) + 1 : 0); }
    summary.push({ name, post, query, ms: Date.now() - t, requests: log.length, errors: log.filter(l => l.status >= 400 || l.status === 0).map(l => l.path + ":" + l.status), rows, state: snap?.state, reasons: snap?.reasons, sample: snap?.evidence?.sample, cohort: snap?.evidence?.cohort, err });
    writeFileSync(out + "/summary.json", JSON.stringify(summary, null, 1));
  }
}, 590000);
