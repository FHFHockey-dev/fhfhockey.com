# Kucherov historical dry run — no write capability

**Status: reviewable partial projection; `commitAllowed=false`.** This is preparation using only the previously approved captured rows. It does not authorize or perform the proposed 64-row/60-second production operation.

Run from the repository root:

`node tasks/artifacts/wigo-player-card-investigation-2026-10-24/dry-run-only/calculate.cjs`

[calculate.cjs](calculate.cjs) ran successfully once (exit 0). It reads only fixed captured JSON and the frozen accepted builder in `local-fix/candidate/`, plus the already installed TypeScript compiler. It has **no database client/writer, HTTP call, credential/environment-file loading, endpoint/handler invocation or apply mode**. Application files and original diagnostic artifacts remain unchanged.

The runner compiles exact **pure statement ranges** of builder SHA-256 `f438eb129e1f70dd0691151916e78a8ea2225412ec63847ce93e334bc9ee9fa6`: arithmetic helpers, appearance validation, season/date mapping, and recent calculations/coverage gates. Source version, line ranges, fragment/compiler hashes and captured-input hashes are recorded in [dry-run.json](dry-run.json). No separate metric engine is copied or maintained, and no shared-app extraction/edit was needed. The VM cannot import modules or access network/process APIs and has a one-second calculation limit.

## Exact partial change set

Target, **if later separately approved with fresh evidence**: the existing `public.wigo_recent` row for `player_id=8476453` in project `fyhftlxokyjtpndbkfse`. This historical patch fills only 14 L5 fields whose required columns are fully captured. Every before-value below is null. JSON contains exact full-precision numbers.

| Field | Proposed captured-input value |
| --- | ---: |
| `l5_atoi` | 21.043333333333333 minutes (1262.6 seconds) |
| `l5_ixg` | 1.82 |
| `l5_ipp` | 0.625 fraction (62.5%) |
| `l5_oi_sh_pct` | 0.13793103448275862 fraction |
| `l5_icf` | 35 |
| `l5_g_per_60` | 1.7107555837161412 |
| `l5_a_per_60` | 1.1405037224774275 |
| `l5_pts_per_60` | 2.8512593061935685 |
| `l5_pts1_per_60` | 2.281007444954855 |
| `l5_sog_per_60` | 11.975289086012989 |
| `l5_ixg_per_60` | 1.037858387454459 |
| `l5_icf_per_60` | 19.95881514335498 |
| `l5_ihdcf_per_60` | 1.7107555837161412 |
| `l5_iscf_per_60` | 6.272770473625851 |

No populated field, L10/L20 field, uncaptured metric or timestamp is in this patch mask. `last_updated` is deliberately not fabricated: a future authorized, current-input operation must supply its own fixed operation timestamp. The historical complete prior row is retained in [historical-preimage.json](historical-preimage.json); it is not an apply-time currentness guarantee.

## Nulls and exact missing-input boundary

The projection asserts that L10/L20 **ATOI, ixG, iCF, IPP, oiSH%, and total-TOI rates** stay null while October 5 is absent. NHL counts/independently supported PP data are not replaced with zeros or wiped. Captured NST matching is 5/5, 9/10 and 13/20 respectively in both source tables.

For L20, six older NST dates were below the earlier independent top-20 capture limit: **2026-04-07, 04-06, 04-04, 04-02, 03-31, 03-26**. Their existence remains unknown; they are not labeled proven ingestion failures. October 5 is the proven absence within the captured current-season date range. No newly fetched or invented rows fill either category.

A full replacement row is blocked because the capture did not include NHL **hits, blocks, PIM, PP goals, PP assists, PP share**, or NST on-ice **zone starts**. Those outputs are excluded from the projection/patch, not assumed missing in production. The target preimage and source inputs were also captured in separate read-only transactions at 16:25/16:26 UTC; atomic coherence and present freshness are unproven.

## Guards before any later commit

The machine-readable artifact carries these requirements; none is satisfied merely by running this dry run:

- Separately authorized and independently reviewed bounded executor; this runner remains dry-run-only.
- Confirm production project and accepted calculation/executor versions. Hosted release is separate; a data update does not deploy local code or prevent an old scheduled builder overwriting it.
- Fresh complete frame/source snapshot, complete target preimage, explicit cutoff, retained hashes and a newly reviewed exact candidate/mask.
- One-row conditional mutation only when both complete preimage and exact input/frame version still match at the write snapshot. Abort on change or any row count other than one.
- Fixed operation identity/timestamp; five-second statement timeout, one-second lock timeout, sixty-second total budget; retained prior/postimage and inspection before any uncertain retry.
- Any compensating restore requires its own approved scope and an unchanged exact postimage. No other player/table writes or October 5 ingestion repair are included.

No SQL mutation is generated, no apply entry point is present, and no production action is pending. The stopping point is this partial artifact plus the precise missing-input/freshness blockers.
