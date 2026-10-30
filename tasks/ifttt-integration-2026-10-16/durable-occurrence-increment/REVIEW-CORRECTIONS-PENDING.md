# Corrections queued while source pins are held

Independent review owns only `review-durable-occurrence-v1/`. All 56 source/test/SQL pins remain frozen until explicit release. No live source correction has been applied during the hold.

- **R14 (reviewer reproduced):** corrected CR051 positive fixture has stale explicit `interpretation.scope.date=2026-10-15`, contradicting its full source clauses/applicability/effective date 2026-10-16. The pure projection reconstructs date from effectiveAt and hides this contradictory supplied field. On release: correct the supplied dates, add an explicit supplied-scope/applicability/Eastern-effective date agreement assertion, and reject such supplied mismatches in the fixture projection rather than normalizing them away. Retain original fixtures and reviewer failure evidence.
- **Legacy registry suite setup (author identified, reviewer acknowledged):** `tweetClaimRegistry.test.ts` still installs two migrations although the current runtime requires occurrence protocol from migration three. On release: install the exact third locally staged migration in that disposable setup, run the suite and correct any actual changed-boundary expectations without weakening downstream/immutability assertions. No production application.

The three new exact CR039/CR040/CR052 actual-storage DSL tests are outside these 56 pins, author-only and not part of the current reviewer scope. Their results must not be substituted for independent acceptance or the six deferred parent/evidence/consumer contracts.
