# TJ approvals (recorded by Chef from TJ's pop-up answers)

Recorded at 2026-11-16T01:33:25Z. Each approval is limited to exactly the scope below, as written on APPROVAL-SHEET.md.

| ID | Scope | TJ answer | approvalReference |
| --- | --- | --- | --- |
| A0 | One read-only admission query (ADMISSION-CONTROL §4) on 2026-11-16 | Approve A0 + A1 for 11-16 | `tj.20261116.A0.admission-recheck` |
| A1 | Day-before checks per operator RUNBOOK T−1: probe v2 `246bf6b4…` (corrected: Chef's relay named the superseded `bf39d6ae`; TJ approved `246bf6b4` and egress tool `c61c7fe7` directly in the operator session: "Approve both"), runtime snapshot, interpreter check, `.env.local` re-stat, G3 `--loaded`, and the connect-only TLS check to 3 hosts with no HTTP bytes | Approve A0 + A1 for 11-16 | `tj.20261116.A1.day-before` |
| A2 | Five-call capture via launcher `31c370c3…`, 2026-11-17 14:05:00–14:06:00Z, bootstrap `dbf69c47…`, output `…native-20261117T140500Z`, at most 5 attempts, at most 2 admission transactions, 0 retries. **Conditional** on A0 and A1 passing and a clean T−0 | Approve A2–A4 in advance | `tj.20261117.A2.blsh-native-capture` |
| A3 | One bounded read-only request read at about 14:10Z on 2026-11-17, reader scope `d84a9547…`, owner role (custody stated), after conversion | Approve A2–A4 in advance | `tj.20261117.A3.request-read` |
| A4 | 6 boxscore GETs (tool `aa8a9cb7…`, games 2026020293–298) after an approved conversion, evaluated by 2026-11-18 | Approve A2–A4 in advance | `tj.20261117.A4.boxscores` |
| V6-PA | v6 deployment check part A, read-only: Vercel project and deployment settings (Fluid, system env, function isolation) and a storage-policy listing. No route call | Approve part A now | `tj.20261116.v6-probe-A` |

**Still not approved:**
- the 11-18 fallback;
- v6 probe part B (route calls);
- the v6 kill switch, schedule, or any call to `blsh_request_context_v1`;
- pushing the bookkeeping commit `9ed2e8b24`, which ships with the next release;
- the policy install;
- the public trade page.

On 11-17, TJ messages Chef at about 13:45Z to start. Any stop rule ends the day.

## Results

- **A0: PASS**, 11-16. `admission/ADMISSION-READ-20261116.json`, sha256 `565ad253…`. admissionReceipt `blsh-admission-20261116.565ad253fc30`.
- **A1: PASS**, 11-16, all six checks. Evidence is in the operator's `evidence/`: PREAPPROVAL-RUNTIME-EVIDENCE `991b4aea…`, snapshot `3b081f39…`, G3 T−1 `d432a6bb…`, egress `9b81df3a…` (3 hosts ok, 0 HTTP bytes). runtimeReceipt `blsh-preapproval-runtime-20261116.991b4aea48b6.3b081f39bccf`.
