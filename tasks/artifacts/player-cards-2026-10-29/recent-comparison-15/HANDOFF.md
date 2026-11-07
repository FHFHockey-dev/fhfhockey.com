# Checkpoint15 — verified current-observation comparison

## Use
http://127.0.0.1:3125/player-cards/recent?checkpoint=15&playerId=8476453&season=20262027&count=5&cardFormat=recent-previous
Click **Load NHL results**. Name search, manual ID, both existing formats, artwork treatments and adjustable contour stack remain. This local page replays the newly fetched Kucherov observation; other catalog names are not captured statistical responses. Existing14 is preserved at /player-cards/current-14 with its own frozen provider/capture. No automatic source refresh or deployment is implied.

## Implemented
Nine exact owned paths, eight application/test paths plus append-only plan. Recent vs Previous is a functional third category: immediately preceding equal-N own appearances, same season/strength/capture, no overlap. Raw rates, previous values and signed changes; shooting changes in percentage points. Same validated pooled counts/exposure for both periods. Short/invalid prior data withholds the baseline without hiding valid recent data. Exact baseline inputs and comparison definitions appear only in comparison manifests. Ordinary two-format manifests retain selected-only inputs. No new visual-design system or unqualified dots/ranks.

## Current source evidence
3 sequential public NHL GETs succeeded with TLS: landing8476453,20262027regular-season game log,TBLseason schedule.208934bytes/386ms,5s512KiBeach/15s1.5MiB caps,no retries/redirects/privateDB/auth/profile writes. Captured2026-10-29T17:43:32.793Z.11GP season total matches11 game-log rows and88schedule rows. Still the same statistical values as the earlier capture; three unselected venue UTC offsets differ. Fresh request is an observation time, not a guarantee of upstream freshness or actual game-end timestamps. Raw bytes/hashes and receipt are in current-snapshot-15/.

L5:3G3A6P22SOG,6120sec; prior5:0G7A7P8SOG,6401sec. Shots/60=12.94vs4.50(+8.44); points/60=3.53vs3.94(−0.41); actual shooting%=13.6vs0.0(+13.6percentagepoints). No quality/forecast implication. L10comparison correctly says20appearances needed,11captured, while currentL10values remain available.

## Verification
37focusedtests/4files pass. TS2775 in an owned test was corrected by a static assertion import;18affected domain tests rerun pass. Final scoped TypeScript, ESLint0warnings and esbuild preview pass. Firstfailure receipts preserved.

Actual served Chromium3groups pass: native name→ID→one local API→real provider replay→own matching Kucherov hero→two sequential-treatment1200×1020PNGs; independent raw-input arithmetic and manifest values match. Original player600,4,600,337.5,logoX840 and3×5pxcontours verified. Native share bytes match the exportedPNG. L10missing-baseline PNG has explicit explanation; ordinary format manifests omit baseline; transitions clear prepared images and reuse snapshot.390/320reflow/native44pxtargets and other-name clearing pass. Zero external browser attempts/errors. One local APIcall per finalrun; two total across first harnessfailure and successful rerun,6localJSONlookups/0extraNHLcalls. Initial share harness lacked an asynchronous wait; corrected, no app change.

Manual actual PNG and phone pixels inspected. Main values and missing-baseline explanation are readable; fine provenance text at phone-fit scale requires zoom.11protected prior source pins match. Source patch/pins, raw capture, browser receipts and exports are retained for independent review. Scoped passes are not full repository or parent acceptance.

## Runtime / resource release
Only verified owned95367 replaced by84959 at127.0.0.1:3125. NewHTML and historical14 readbacks matched exact bytes. KEEP-RUNTIME.json pins all old+new dependencies. Detached process, no autorestart/system-start changes. Every own heavy token released in finally; static server holds none. No foreign lock/process manipulated. First blocked waits retained in pending packet; this handoff supersedes pending status.

## Remaining
General multi-player live service smoke/activation, all-NHL same-definition populations, qualified NST chance/on-ice/PP/PK inputs, complete historical end/cutoff evidence and career/milestone baselines remain. No position-relative cohort silently adopted from research. Current anonymous Next page/provider source exists but global app/auth hydration and deployment remain unexecuted. Thursday stays after card qualification. BLSH/Claude Tuesday untouched; no Git changes, deletion, dependencies or hosted changes. Parent independent review next, no new slice started.
