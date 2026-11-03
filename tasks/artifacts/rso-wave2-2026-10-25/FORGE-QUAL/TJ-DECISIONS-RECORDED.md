# TJ decisions recorded (direct pop-ups, 2026-10-26 ~00:10 UTC)

- **First target (D2):** skater SHOTS_ON_GOAL, unconditional expected value, h1, from released captured_live FORGE game revisions. The claim covers Start Chart display plus RSO totals and comparison. RSO assignment and conditionalTieBreak stay denied.
- **Protocol (D1, D3, D4, D5): adopted as written** in DECISIONS-FOR-TJ.md.
  - D1: the Release C Oct 23–30 block is fully sealed.
  - D3: configurationHash = sha256 of the run's modelEnvironment; artifactHash = sha256 of {codeVersion, configurationHash}.
  - D4: predeclared hashed scope.json; 14 slates with ≥500 skater-games; bias ≤5%; calibration slope 0.85–1.15; MAE non-inferior to the season-rate baseline (upper 95% bound of ΔMAE < +0.02); 100% readback integrity; two looks, where slate 7 can only stop for harm.
  - D5: no review is added to rsoUsePolicy until prospective evidence exists; RsoTargetUseReview is first extended with prospectiveEvidenceRef and ownerApprovalRef.
- **Native v2 (D6):** let it stop after 2026-10-27T04:00Z (fails closed). The RSO data endpoint served the legacy source on 10-25 19:50 EDT ("native_not_activated"). Start Chart's source still needs the single R4 confirmation before the cutoff.
- **RSO local workspace (E2E D2):** scope it per account, plus one anonymous manual workspace. A league/context switch must not carry the previous context's plan (E2E D1).

- **D6 confirmation (R4), done:** one read-only production GET of /api/v1/start-chart at 2026-10-26T00:15:44Z returned 200 for slate 2026-10-25 with forecastSource {kind: legacy, reason: native_not_activated}. Production is not serving native, so letting native v2 stop after 10-27T04:00Z changes nothing for users.
