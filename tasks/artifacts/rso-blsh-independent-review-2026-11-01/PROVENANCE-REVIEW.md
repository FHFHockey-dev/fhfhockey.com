# Independent baseline and Player Cards provenance review — 2026-11-01

**No correctness finding identified in this bounded review.** The new evidence supports calendar/appearance/overlapping-count qualification for the exact 150 fixed historical rows and provenance of the exact stale Player Cards research handoff. It does not establish fully independent FP derivation, advanced observed-metric admission, all 729 historical references, current recommendations or predictive validity.

Reviewed the actual `qualify_baselines.py`, `card_provenance.cjs`, adjacent tests, pinned `currentInput.ts`, relevant window/scorer definitions, saved outputs and underlying evidence. All INPUT-PINS, SOURCE-PINS and FINAL-RECEIPT hashes match actual files. Original application/scorer/snapshot/replay inputs were not changed by this review.

## Historical baseline findings

Independently rehashed and decoded **834 final official boxscores, 11,133,962 uncompressed bytes**, and checked their receipts' body/receipt hashes, successful TLS/status, exact URL, season/type/date, home/away team IDs, finality and unique skater IDs. Their game set exactly matches the released 2022–23 calendar census for the **99 target dates**. No missing scheduled date game was found.

Independently mapped every original row by player/date across that complete census. All **150** have exactly one official appearance and matching supplied non-null original game/team/calendar fields. Derived game/team IDs match the sidecar; original nullable fields and row hashes are preserved. GP=1, positive exact TOI, goals, assists, shots, hits and blocks match for all 150. All original baseline members, means and sample SDs remain unchanged.

This closes the **133 formerly unknown calendar links for these exact three fixed 50-row cases**: Tanev 37, Connor 50, Kaprizov 46. It does not qualify every development-reference row used by the broader BLSH snapshot.

PPP can be independently checked against official PP goals in **101 zero-assist rows**. The remaining **49** rely on WGO PPP because the box does not supply PP assists. The checkpoint accurately preserves this limitation, along with unknown historical publication time and unvalidated stable-ability/predictive interpretations.

The qualifier separates identity mapping from statistical/exposure qualification. A complete date census is required when deriving an unspecified game; an explicit original game can still bind if an unrelated game lacks a box. Ambiguous appearances are not resolved by selecting the healthier/more convenient row. Conflicting inputs remain visible rather than being rewritten.

## Current Player Cards provenance

Verified the exact **6,566,654-byte sidecar**, SHA256 `0b98ebc0fa2bbf0554b781d6c7548b820c37768b4868d11784ca837dad070d57`, and its unchanged **9,559,567-byte snapshot**, SHA256 `2f380c2539390f6931ec92ab1d0b1d8cced2b55f5f4cefb8c6e88a694909f2c8`. Qualifier/assembler/score/explanation/mapper identities match the handoff; the stated FP, raw-points and repository GameScore definitions match the source.

Independently authenticated the four raw-feed files against the request and their recorded capture hashes/identities. For all **729 profiles / 3,407 unique window rows**, recomputed the final five-or-fewer recorded WGO slots sorted by `(date,id)`, with no GP/shot/healthy-row filter. Saved profile/window/source IDs/dates and display scores match. Every window row maps to its exact captured regular-season game/date/season; the source player/team and exposure values are preserved.

Independently reconstructed the stated NST match/exposure/value predicates against the raw records: **3,362 individual** and **3,345 on-ice** window rows qualify. The **138 unavailable GameScore rows** and **19 zero-shot windows** reconcile. All **7,271** old qualification rows cover the captured WGO IDs. All **1,463** overlay patches already match the captured fields; no new values are needed or attributed to this sidecar.

**657 window finality assertions** match the pinned goal-evidence bundle, its original manifest/artifact hashes, and the original qualified proposal/receipt metadata. This is inherited, explicitly scoped finality evidence. I did not re-interpret every original current-season report/HTTP body; unlike the historical baseline boxes, that was not a fresh raw-body audit here. Universal finality remains unestablished.

The source/cutoff/strength boundaries are correct:

- Current season is 2026–27, events through October 28, capture-as-of October 29 at 18:41:12.798646 UTC. `issuedAtUTC` remains null. Capture age at build is approximately **69.851 hours**, beyond its 24-hour policy. Saved profile `fresh` is relative to the saved event cutoff and production availability, not present-day freshness.
- NST game association is a unique player/season/game-date join with GP=1 and exact positive total TOI. NST has no native game ID in this capture.
- AS/all-strength, game-date meaning and seconds are explicit feed declarations. Original NST model/version/publication and per-row native strength receipts remain unavailable. WGO ES is not asserted to be NST 5v5.
- Current calendar records contain only game ID, season, date and type. **Current team labels are carried from WGO; they are not independently verified against home/away calendar fields.** This is a provenance boundary, not a mismatch found in the saved handoff. Historical baseline team matches did have official home/away identity evidence.
- No current streak or absence-memory series is supplied by this snapshot. The new historical links do not authorize attaching the three historical memory examples as current player streaks.

## Actual tests and negative cases

Newly executed **52 passing tests**:

- 10 Python baseline-link tests: incomplete census, explicit-ID exception, absent/ambiguous player, supplied game/team/calendar conflicts, GP/TOI conflicts, missing versus observed zero and PP-assist unknowns.
- 7 Node provenance tests: exact/fewer recorded slots, no healthy/shot filtering, display-window drift, missing/foreign qualification and raw-feed/request drift.
- 35 existing `currentInput.test.ts` tests: cutoff/staleness, source and proof chronology, nonfinal/incomplete proof, altered healthy fields, ambiguous keys, missing operands, observed zero, strength/date/unit declarations, exposure mismatch and reserved-season rejection using fixtures.

Evidence: `provenance-review/baseline-tests.log`, `card-tests.log`, `current-input-tests.log`, `RESULTS.json`, `overlay-check.json` and `verify.py`. Independent checks reconstructed baseline mappings and current-window/gate totals rather than relying only on the checkpoint summary. Implementer test/baseline/card/visual process receipts each record exit 0 and lock release. Shared heavy locks used by this review were acquired atomically and released.

The first independent age check was overly strict about submillisecond precision: Python preserved timestamp microseconds while JavaScript Date.parse uses milliseconds. Corrected the verifier tolerance to one millisecond and reran artifact checks, reusing the passing tests. The measured difference is under one millisecond and cannot affect the stale classification. This was a review-harness issue, not a source defect. Arrow emitted nonfatal sandbox sysctl warnings; the corrected artifact check exited 0.

The visual renderer was source-reviewed and its output pins/receipt checked; I did not rerender or independently inspect the image in this focused provenance review. No browser, integrated Player Cards or production acceptance is claimed.

## Disposition and boundaries

The exact sidecar/snapshot may be handed to the Player Cards owner as independently reviewed **dated, stale, provisional research material**, with the field-level limits above retained. Consumer wiring and UI acceptance remain separate. Native advanced-metric admission and present-day recommendations need additional evidence. H/alpha choice, stronger signed cohorts and chronological predictive evaluation remain unresolved research work; no such validation follows from the new links.

No source, score, baseline row or original artifact was edited. Only review artifacts and the required diary were written. No network/provider/API/NST/database/production request, reserved-season data read, dependency change, deployment or Git index/ref mutation. No denied/pending action or uncertain mutation; no blocker to this scoped provenance handoff.
