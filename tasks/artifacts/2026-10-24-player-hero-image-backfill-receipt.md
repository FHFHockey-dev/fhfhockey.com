# Player hero image backfill receipt

Completed 2026-10-24. Scope: the one-time current-NHL-roster backfill of `public.players.hero_image` in Supabase project `fyhftlxokyjtpndbkfse` (`fhfhockey.com`). Recurring import mapping and player-card consumption are separate future work.

## Parent-reported database completion

- Migration: `add_players_hero_image`; additive nullable `text` column `public.players.hero_image`.
- Application: nine null-only UPDATE batches; batches 1–8 each updated 100 rows and batch 9 updated 5 rows, totaling 805.
- Full-scope readback: 805 rows, 805 populated `hero_image` values, and 805 exact captured-source URL matches.
- Other-column digest: `17763aa36f985339279f797014055d5e`, unchanged from the preimage; `image_url` and unrelated player fields preserved.
- Global readback: 4436 rows, 805 populated values, zero populated outside the reviewed 805-ID scope.
- No retries or uncertain mutations. Parent informed the user of completion.

Database migration, application and readback above were performed and verified by the parent through its connected Supabase tools. This worker did not repeat those operations or independently query the database.

## Worker-captured public source evidence

- All 32 current team roster endpoints captured, including UTA/68: 805 entries, 805 unique IDs, no duplicates. Parent verified all 805 IDs already existed in `public.players`.
- Exactly one landing fetch per matched ID: 805 requests, 805 valid `heroImage` URLs, zero missing fields, invalid values or read errors. No landing retries or redirects.
- Observed URL dimensions: `1296x729` for all 805. Lossless grouping of exact returned URLs was verified against every explicit ID/URL record; all nine generated SQL batch checksums passed.
- Scope SHA-256: `a69762648f5a99ce008f486482ff3b31255efdd161abbe30edab81664a2ca8ca`.
- Canonical compact ID-array SHA-256: `3ab2a3ced39ad0035391e234e8b08b9ce2c2e0b1996db5adebb513e831f0866b`.
- Explicit updates artifact SHA-256: `11a9dfe0dd14b9b01be17df2d65c02793f0eefabc56e31acdb4f1952cfa11fb5`.
- Full grouped-source artifact SHA-256: `d1787ae4ba67f1cc49a475f9b90ac2b83f18133fdf3bf8b3f05c754e1958ad11`.

Local evidence is under `/tmp/fhfh-hero-image-scan-20261024/live/`: `scope.json`, `discovery-summary.json`, `scan-summary.json`, `results.json`, `updates.json`, `grouped-source-records.json`, 32 roster captures, 805 landing records and nine SQL batches. The temporary directory is not durable storage; hashes above identify the captured artifacts.

The worker made no database, Vercel/application, Git, credential or image-binary requests. Image loading, export/CORS behavior and image reuse rights were outside this backfill and remain unverified. No runtime importer or card changes were made. No remaining blocker for the completed one-time backfill.
