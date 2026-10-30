# Hero artwork and Social Share — checkpoint 01

Local candidate ready for parent independent review. This is a follow-on to the accepted calculation, missing-data, accessibility and export slices; it is not acceptance of live player statistics or production rollout.

## Visible result

- Current loopback preview: http://127.0.0.1:3125/player-cards
- Previous accepted functional preview: http://127.0.0.1:3125/player-cards/functional
- Previous editorial checkpoint: http://127.0.0.1:3125/player-cards/editorial
- Actual exports: [Matthews landscape](matthews-landscape.png), [Kaprizov social square](kaprizov-social-square.png), [missing-metric export](missing-metric.png).
- Actual screen captures: [desktop](desktop.png), [390px card](phone-card.png), [390px page](phone-page.png).

The two reviewed local NHL action-photo cutouts sit over team colors and stripes from `teamsInfo.ts`. Identity remains prominent; grouped actual values, raw rank/N and percentiles use the existing editorial renderer. The actual-percentage strip remains explicitly separate. Every image prominently says the statistics are illustrative and are not the pictured player's results. There is no generated face, jersey, team, rating or projection. Controls stay outside the artwork.

Landscape output is 1200×1020; social-square output is 1200×1200. The additional height preserves the existing analytics sizing while adding the photo header. At 390px the name, photo and main numeric hierarchy are clear; footer/source fine print still needs image zoom. That remains a design consideration, not an assertion that every line is comfortably readable at phone thumbnail size.

## Source scope and integration

Coordinator lease `CODEX-PLAYER-CARDS-HERO-SHARE-20261025` grants exactly 12 source paths; see [LEASE.json](LEASE.json), [CHANGED-FILES.json](CHANGED-FILES.json) and [source.patch](source.patch).

- `EditorialPlayerCard.tsx`: optional header, height and artwork-description inputs; its default output, formatting and calculations are preserved.
- New `HeroPlayerCard.tsx`: verified photo identity, team palette, landscape/square compositions and provenance.
- New `PlayerCardShareStudio.tsx`, SCSS and tests: two reviewed art choices, format selection, complete/missing/history-unverified fixtures, asset-loading failure/retry, PNG and manifest export, and device sharing.
- New `shareExport.ts` and tests: local reviewed asset path, exact SHA-256 and decoded dimension checks; embedded-photo SVG-to-PNG export from the displayed snapshot; stale-snapshot/artwork guards; user-click device sharing and unsupported-browser download fallback.
- New `reviewedHeroSamples.ts` and two byte-identical alpha PNGs: captured source metadata kept separate from fabricated statistical provenance.
- New `/social-share/player-cards` page: existing `SocialShareAccessGate`, private/no-store response and noindex/nofollow. No auth, entitlement or API implementation changes.
- Existing `SocialShare.tsx`: only a Next Link import and a header link to the player-card page, with prefetch disabled. The new page links back to the schedule studio.

**Integration warning:** the canonical SocialShare file at lease time (`ff809aa…b5c4`) differs from the released file (`7eb85f6…d857`). Replay [social-navigation.patch](social-navigation.patch) onto the released source; never overwrite it with the canonical file. `source-files/` deliberately omits that shared file. Before/after hashes and the original comparison copy are retained. All shared styles, auth, API and existing export logic remain outside this patch.

The suite exporter requires schedule-source evidence and cannot represent a player-card snapshot. The new helper is scoped to this card snapshot; the suite access gate and navigation are reused. The local standalone preview mounts only fixture UI, without the application auth provider or live side effects. The authenticated Next route has been tested with mocked auth; it has not been exercised against a real signed-in application session.

## Assets and provenance

Both selected images are from the owner's accepted local 12-image evaluation in `/Users/tim/Documents/FHFH-local-image-tests/2026-10-24-birefnet-validation`. The dark compositions and alpha pixels were inspected individually on this executor; final browser exports were also viewed.

| Player | Captured photo dimensions | Copied alpha SHA-256 |
| --- | --- | --- |
| Auston Matthews, 8479318 | 1296×729 | `713a4923cf4742cefbbc09a647a249f98c095edea8eb92f7bda028929e0db065` |
| Kirill Kaprizov, 8478864 | 1296×729 | `4199308c2f56a9ac0244697e7162f42283f1a5c247b656fb7c9278597b3ee18c` |

[hero-inputs.json](hero-inputs.json) pins actual recorded URLs, capture dates, player identity and source hashes. Dimensions are taken from captured metadata and checked against decoded pixels. No images were reprocessed, downloaded, uploaded or generated. The roster805 batch is not consumed or asserted to be accepted. Existing five reference identities/pixel evidence remain in the prior visual checkpoint.

Both cards intentionally use the same accepted synthetic fixture player1001 statistical contract. The manifest states `representsPicturedPlayer: false`, `liveActivation: false` and `premiumActivation: false`. No league coverage, current-team truth beyond the captured record, or actual player performance is inferred from these images. Recorded image acceptance is visual acceptance, not an independent publication-rights decision.

## Behavior and verification

The displayed snapshot, selected format and exact embedded photo determine the PNG and manifest. Controls are disabled during export; repeat clicks are guarded. Changing player or format clears a previously prepared share image. Sharing has two steps so the final device share call occurs directly on a user click. Cancellation does not trigger a fallback download or post. Browsers without file sharing download the same prepared PNG for manual posting.

Passed checks, run from `web/` by the bounded `run-check.py` wrapper with Node 22.11.0, existing packages and no `GIT_DIR` override:

| Check | Exact command / evidence | Result |
| --- | --- | --- |
| Focused unit and route tests | `npm test -- --run --config ../tasks/artifacts/player-cards-2026-10-25/hero-share-checkpoint-01/vitest.config.mts` | 15/15: original editorial5, studio4, exporter4, real suite gate/header behavior2 |
| Scoped TypeScript | `npx --no-install tsc --noEmit --project ../tasks/artifacts/player-cards-2026-10-25/hero-share-checkpoint-01/tsconfig.json` | Passed; covers player-card modules and preview entry, not a full app typecheck |
| Scoped ESLint | Exact 8-file command in `lint-command.json` | Passed |
| Minimal suite link lint | `npx --no-install eslint components/SocialShare/SocialShare.tsx` | Passed |
| Offline browser and actual PNGs | `node <artifact-root>/browser-check.mjs` | 5 groups passed; zero HTTP attempts and zero page errors |
| Static server syntax | `node --check <artifact-root>/serve-preview.mjs` | Passed |

Browser evidence covers two identities/formats, nine actual/rank/percentile values reconciled to the manifest, alpha embedding, PNG dimensions, cancelled native-share behavior with a mocked API, byte-equal unsupported-share fallback, prepared-image invalidation, missing-metric explanation in actual PNG, unverified-GP export blocking, 390px overflow and 44px controls. No real social destination was invoked. Native device delivery itself remains device-dependent.

An initial test syntax error was fixed. A focused test then caught DOMException cancellation handling; the implementation now recognizes `AbortError` without relying on `instanceof Error`. The first browser harness run needed to reopen the manifest disclosure after artwork reload; the harness was corrected. Initial test/browser logs that were saved remain alongside final results. No broad suite, production build, real authentication or production calls were performed.

## Preview process and preservation

At 04:52:03 UTC, the guarded handoff reverified the exact old PID98041 command, stopped only that owned server and started PID30284 in a new POSIX session. Three sequential credential-free loopback GETs returned exact pinned bytes:

- Current preview: 3,123,706 bytes, SHA `ecd560310b358ebd0521574967a480cab1521946c9d42d5f33341fcc57a5187a`.
- Prior functional: 318,626 bytes, SHA `6c29f6eb3dc6ffc9a6a8a546423f78ac3e6e5e1e7265129475724422d3aad9b5`.
- Prior editorial: 314,484 bytes, SHA `f65ce654f1e1e7ab226aa01e95617d925608d8d590fbd65d5bbaa85b324e05a5`.

Separate readback after launcher exit confirmed PPID1, PGID30284, no TTY and sole loopback3125 ownership. See `runtime.json` and `lifecycle-readback.json`. The process is independent of the launcher; host/environment shutdown or an explicit stop can end it. No automatic restart or system startup was installed. Survival after this final turn is not yet observed. No other port, cache or server was touched.

All **21 protected existing source pins match**. Of **197 historical artifact pins**, **149 currently readable files match and zero differ**; **48 old `.log` files are absent**. This was discovered during final preservation readback. They were not removed or reconstructed by this slice; their paths and expected hashes are recorded in [preservation-results.json](preservation-results.json). Parent/coordinator should determine whether prior cleanup/archive accounts for them. Original code/probe files, manifests and prior preview bytes remain available and unchanged; absent logs limit a blanket historical-packet preservation claim.

## Remaining gates and next action

1. Parent independent review of this exact 12-path follow-on, including minimal navigation patch replay onto the released suite file. Frozen source copies, patches, commands, results, images and hashes support review.
2. Owner feedback on this stronger photo composition before broader artwork/style propagation. No optional cartoon, poster or pixel treatment was added.
3. Qualify the live source adapter, period coverage and complete same-definition metric populations before replacing fixtures. WiGO source ownership remains elsewhere. Live and premium activation remain off; paid metric/comparison choices remain unresolved.
4. Real application/device integration and image publication rights before rollout. This editor-gated fixture page is not completion of the planned free public player-search product.
5. No Git, release, deployment, dependency changes or external publication authority was used. No output Library IDs were created; the previously blocked Library upload remains blocked and was not retried.

Automatic approval review rejected a direct follow-up to Scout thread `01a16eed-60f6-7096-879f-696c469db015` for lack of explicit trusted authorization to message that specific thread. It was not sent or retried. Coordinator ownership/process messages were separately authorized and succeeded; parent receives the normal final task handoff.
