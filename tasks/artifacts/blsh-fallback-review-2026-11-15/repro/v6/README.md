# V6 review reproducers

`review-tail.test.ts.part` is appended to the first 108 lines of `web/lib/blsh/nativeCaptureV6/core.test.ts` (the harness: mocks, fake store, fetch stub), in a SCRATCH export only:

```bash
X=<scratch export with web/ + v6 files + web/node_modules symlink>
head -108 $X/web/lib/blsh/nativeCaptureV6/core.test.ts > $X/web/lib/blsh/nativeCaptureV6/review.repro.test.ts
cat review-tail.test.ts.part >> $X/web/lib/blsh/nativeCaptureV6/review.repro.test.ts
cd $X/web && env -i PATH=/usr/local/bin:/usr/bin:/bin HOME=<scratch> ./node_modules/.bin/vitest run lib/blsh/nativeCaptureV6/review.repro.test.ts
```

Output of the reviewed run: `review-repro.out` (5/5: V-R1, V-R2, V-R3, V-R4 x2).

## Recheck (V6-RECHECK.md)

`recheck-tail.test.ts.part` is appended the same way to the harness lines of the CURRENT `core.test.ts` (lines 1-109, before the first `describe`). Output: `recheck-repro.out` (7/7: R-L1a, R-L1b, R-L2a, R-L2b, R-L3, R-M1 x2).
