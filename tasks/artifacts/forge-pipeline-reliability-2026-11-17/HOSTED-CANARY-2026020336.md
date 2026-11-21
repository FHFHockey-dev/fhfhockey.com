# FORGE hosted capture acceptance, November 17, 2026

Supabase Cron and the production Next.js endpoint captured Columbus at the New York Islanders, game `2026020336`, under policy `pregame-native-v1`. The game was scheduled for November 18 at 00:00 UTC. One dispatch produced one claim, one committed packet and one qualified witness. A separate database session read the packet back and verified it before the 23:00 UTC deadline.

| Event | UTC on November 17 |
| --- | --- |
| Cron dispatched | 22:44:00.239994 |
| Endpoint began | 22:44:01.275804 |
| Database input cutoff | 22:44:01.746467 |
| Verifier's final committed read | 22:44:18.670456 |
| Dispatch finished, HTTP 200 | 22:44:18.843278 |
| Chef's independent database read | 22:44:32.065021 |
| Conservative upper bound from the stored DigiCert token | 22:45:19 |

The conservative acknowledgement preceded the deadline by 14 minutes 41 seconds. Independent verification decoded the 187,301 stored bytes, recomputed both packet digests, checked the game, policy, candidate, claim and cutoff, and verified the RFC 3161 token with the released trust profile.

| Evidence | Value |
| --- | --- |
| Release commit | `83750b4abd672399113659b96c279a1ddaeb425b`, parent `69317010e987cc65c20f7cae3cd932ac72acd46c` |
| Production deployment | `dpl_DXmDAjTBkTYdJii91Bb6nkGHTkrK`, canonical alias `fhfhockey.com`, Node 22 in `iad1`, effective timeout 420 s |
| Supabase migration and job | `20261117215012`, job 408, request 3112 |
| Claim | `e79f06a3-8f33-4f50-a856-02f880787934` |
| Packet SHA-256 | `3a76caf5e5ad1485d3638ae13b8a2a432dd7578703ea09a188608029ff4d4a9b` |
| Canonical JSON SHA-256 | `bf9041ca164e2cef73ee984237560caab82181892ad2b62e85fa0b34c0822d56` |
| Witness token SHA-256 | `c18690e2e4d7d043c49295081d9caeff8a9da64149db9d427836124d5f96aa51` |

The exact release passed 125 Vitest cases, 44 disposable PostgreSQL assertions, the web typecheck and the producer verifier (239 modules, zero findings). One production web build completed. The CMS, functions and root-project entries were canceled by their build filters.

Chef closed the one-game approval and deactivated job 408 after verification. The endpoint and migration are deployed. Wider unattended coverage requires an approved date range. This receipt qualifies private input capture for this game. Forecast publication and RSO lineup selection have separate evidence.
