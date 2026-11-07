import base from "/Users/tim/Code/fhfhockey.com/web/vitest.config.mts";
import { readFileSync } from "node:fs";
const root = "/Users/tim/Code/fhfhockey.com/";
const frozen = '/Users/tim/Code/fhfhockey.com/tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/nst-goalie-writer-20261101/checkpoint-adapter/caller-qualification/candidate/';
const paths = ["web/lib/nst/jobLifecycle.server.ts", "web/pages/api/v1/db/update-nst-goalies.ts", "web/pages/api/v1/db/update-nst-gamelog.ts"];
export default { ...base, plugins: [...base.plugins, { name: "independent-frozen-source", enforce: "pre", load(id) {
  if (process.env.NST_REVIEW_VARIANT === "old" && paths.some(path => id === root+path)) return readFileSync(frozen+id.slice(root.length), "utf8");
}}] };
