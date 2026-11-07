# Candidate freeze (SS 13.6), third freeze

Frozen 2026-11-01 for the audit recheck. **Code pin: `7e2623f756f8f3542ecccce44b43c1d040af91cb`** on `octoberBranch`, local only. Adds all audit fixes, the landing page, the posted-week source and IFTTT secret fallback since the second freeze at a398781fd. The branch also carries unrelated unreleased work (forge-v2, WIGO UI pass and others), which is not part of this candidate.

## Tree hashes at the pin

| Path | Git tree |
| --- | --- |
| `web/lib/socialShare` | `90f8948991abfbadd4ef9a1b1b55aa71cf3a58f1` |
| `web/components/SocialShare` | `91e647c0c49660c12c60425074523b96193256d8` |
| `web/pages/social-share` | `1266dd79c9e3d0290f6efd44ead230f4a7fbe331` |
| `web/lib/sources` | `53b18851d535994a9ce0acbdef0727377cdde879` |
| `web/pages/api/v1/sources/ifttt` | `a53bd3fa18737be02d9077fbb1b725ab4373ae7c` |
| `web/pages/api/v1/db/update-power-play-combinations` | `3510255165308628e8b21aa2a79f2c4cb985681c` |

## Checks

Gate at 995dff336 (before the migration rename and 7e2623f75, which touch IFTTT code and readers only): Vitest social share and PP 49 files, 1,084 passed; whole-project tsc exit 0; eslint exit 0; pure check 21 files; Playwright `e2e/social-share*` 101 passed, 1 skipped, `integration/e2e-final3-20261101.txt`; real render of 30 cards `integration/real-gate3-20261101/`, no clipping, phone 375. 7e2623f75, per its lane: 168 affected tests, whole-project tsc and lint with no errors; a final gate reruns on the release tree.

Production so far: table `social_share_x_posts` applied with TJ's approval. Nothing pushed or deployed. Backfill and applet not run.
