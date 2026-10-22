# Owner-confirmed RNH nickname stored

**Stored in the canonical live alias library**, `public.fhfh_player_identity_aliases` on project `fyhftlxokyjtpndbkfse`, and independently read back after commit.

- Nickname: **RNH**; normalized alias: `rnh`.
- Canonical player: **Ryan Nugent-Hopkins**, NHL ID **8476454**; separate FHFH registry ID **9521**.
- Alias row ID: `49ecf910-d9fd-469d-856a-73b80a0689d8`.
- Source/status: `manual` / `verified`.
- Created: `2026-10-20T23:07:11.812724+00:00`.
- Provenance: TJ's explicit owner confirmation at `2026-10-20T23:03:35Z`, classified as a nickname and global identity-only mapping. The stored provenance explicitly says no historical team membership is asserted and model confidence was not used as verification.

The canonical identity registry describes this table as verified/reviewable alternate names; `fetchRegisteredPlayerIdentities` in `web/lib/sources/playerIdentity.ts` reads its verified aliases into the canonical directory. Its existing alias insert pattern supplies normalized names, verification status and structured source provenance. This is the appropriate persistent identity library for the requested nickname.

The separate `lineup_player_name_aliases` table is used by the lineup occurrence-review route. Calling that route would also update an unresolved occurrence and potentially enqueue replay work, so it was not invoked. No duplicate was placed in that store.

Before the write, a bounded live query found the single verified registry/NHL link and no RNH or punctuation-equivalent R.N.H. aliases in either store. Live trigger inspection found only a timestamp trigger on updates of canonical aliases, with no insert-side replay trigger. The transaction briefly locked the two relevant alias tables with bounded lock/statement timeouts, rechecked the verified canonical link and absence of any equivalent alias, then inserted exactly one row. Any newly appearing alias would have aborted without overwrite. No existing row was changed.

A separate post-commit read returned exactly the inserted verified alias, the expected verified identity link and owner provenance, with zero conflicting/duplicate equivalents and zero lineup-store equivalents. `RECEIPT.json` contains exact SQL, before/write/readback results and trigger inspection; `WRITE-PLAN.json` retains the prewrite scope.

No unresolved occurrence, historical membership, replay job, notification, paid-model request, application source/default, migration, credential/security setting, deployment or publishing operation was changed. Existing dated trial snapshots and seals remain unchanged; today's owner confirmation is not retroactive source-time membership evidence. Whether a particular live ingestion path currently loads the verified registry depends on existing configuration, which was not changed or verified here. No email-volume claim is made.

Verification used the live conflict checks, guarded one-row transaction and independent readback. No application tests were run because no application code changed. There is no remaining persistence blocker for this mapping.
