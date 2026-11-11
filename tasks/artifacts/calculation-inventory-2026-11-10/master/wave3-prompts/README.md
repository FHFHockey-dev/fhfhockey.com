# Wave 3 (7 passes, slim): run order

Each prompt goes in a **new** Fable chat. All use the slim format: `../RULES-DIGEST.md`, `../packets-slim/` and the named upstream sections only, with no sub-agents and a report cap.

- **Batch G (full audits):** w3-1 xG part 2 + WiGO + stats helpers · w3-2 player cards + trade value · w3-3 misc-other
- **Batch H (cross-check mode, shorter):** w3-4 FORGE parts 3–4 · w3-5 season forecasts parts 4–5 · w3-6 sustainability, rolling and rankings part 2. These are Codex-only records. Each one is matched to the upstream audit that already covers it, and only new or contradicting points get audited.
- **w3-7 sKO + VuDu:** only after TJ writes `../OWNER-INTENT-SKO-VUDU.md`.

They can start before the Wave 2 consolidation lands; if `WAVE2-CONSOLIDATED.md` exists, they read only its rules and any new decisions. Run at most 3 at once, because they share one small production database. Each writes `master/audits/<name>.md`, and Astra peer review follows.
