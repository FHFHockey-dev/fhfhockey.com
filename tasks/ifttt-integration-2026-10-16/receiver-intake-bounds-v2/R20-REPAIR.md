# R20 before/after evidence

The independent v1 trigger inserted two admissions during attempts UPDATE into a policy with maxReceipts=1. Exact retry returned200 with2 admissions; variant refusal returned500 yet committed2 admissions. Both cases consumed1 attempt. Raw/archive rows stayed unchanged. This invalidated the admission cap even though all104 owner checks passed.

The unchanged two assertion bodies now produce500 with0 admissions and0 attempts: the unexpected quota-trigger write is detected outside the inner retention savepoint and rolls back the complete faulty statement. No automatic fallback or second mutation is attempted. The nearby under-cap injection also rolls back the exact pre-attempt state and recovers after fault removal. Normal later storage/cap refusals still charge attempts; existing ordinary-failure tests remain unchanged and pass.

Exact source/evidence hashes and measured values are in R20-before-after.json. The initial rejection and all219 independent v1 artifacts are preserved. Second independent correction review is pending; this note is not its verdict. Select replacement SQL7 only, never both alternatives. No hosted or production action occurred.
