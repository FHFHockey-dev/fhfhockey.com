# Chromium verification of the standalone Trending candidate

On the pinned 750-skater fixture, the median time to see six comparison opportunity signals fell **20.5%**. Selecting Trending from WAR and waiting for 25 named players fell **33.1%**. The browser showed identical ordered results on the release candidate and its parent.

| Interaction | Cache at action | Parent median (range), ms | Candidate median (range), ms | API requests, each version |
| --- | --- | ---: | ---: | ---: |
| Mount Rankings, open comparison drawer | Cold client and server | 1,343.4 (1,334.4–1,357.6) | 1,067.9 (1,043.2–1,084.0) | 5 |
| Mount Rankings, open comparison drawer | Fresh client, warm server | 160.5 (159.4–168.4) | 159.8 (152.7–185.7) | 5 |
| Return to Rankings from Trending | Warm client | 31.8 (31.0–32.1) | 31.8 (31.1–32.1) | 0 |
| Select Trending from WAR | Cold client and server | 855.8 (846.7–889.1) | 572.6 (564.7–590.6) | 1 |
| Select Trending from WAR | Fresh client, warm server | 89.8 (89.2–98.2) | 89.8 (82.0–90.8) | 1 |
| Select Trending from settled Rankings | Warm client | 23.6 (22.0–23.7) | 23.1 (23.0–23.9) | 0 |

## Evidence

- Chromium 148.0.7778.96 ran the same page JavaScript and CSS in a 1440 × 960 viewport. Each revision had one discarded run and five measured runs per scenario. The parent was `83750b4abd672399113659b96c279a1ddaeb425b`. Tag `rankings-trending-rc-20261118` was `50dea27b84a34b05a1aa6e67dc24d2774e5d3f24`. Browser bundle SHA-256 was `c7262521512f8684356a30a70066917d570e450709bdccf5718b3daa96a0d1c1` for both. [Raw samples and hashes](browser-samples.json)
- The URL-resolved requests exercised the actual matrix, comparison, Trending, metadata and WAR handlers over local HTTP. Both used the same projected database fixture, with four complete Rankings windows and a complete season composite marker at November 17. The season lookup returned 20262027. The matrix identified the durable Rankings source, reported 750 ranked skaters, and returned matching dated v3 MCM values for the ten displayed rows and six comparison subjects. [Fixture](fixture.mjs)
- On every interaction the runner compared all 25 ordered Trending API rows, plus the applicable visible output, against the saved expected values. The checks covered all six evidence strings and subject IDs, all 25 player names and ordered IDs, every table cell and signal title. The parity SHA-256 was `245acd199f8edc9d5f5027ddf5d4e3c4040e64d811a6c213d6997391e1224d98` on both revisions. [Expected rows and evidence](before-rows.json)
- The entry clock starts immediately before mounting the React page. The tab clock starts inside the Chromium click event. The ending condition requires laid-out, visible, nonempty content, then crosses two animation frames. It includes local HTTP, React commits and a browser paint opportunity. The entry clock excludes downloading the page bundle. The runner uses the application’s page component, compiled Rankings Sass, local images, React Query and SWR. A local router provider supplies the Next router state. Google Fonts imports are omitted and browser traffic is restricted to the loopback server. The fixture’s database delays are synthetic. These are local browser measurements. [Runner](browser.mjs)

Run from the repository root with `node tasks/artifacts/rankings-current-season-2026-11-18/trending/browser.mjs` using the repository's existing web dependencies and Playwright Chromium installation. The runner verifies the complete output and rewrites the sample receipt after both revisions pass.

## Comparison evidence for three sample states

An untimed Chromium check rendered the comparison drawer and the 25-row Trending table on both Git revisions above. Two synthetic players’ rolling and window-support inputs changed in disposable fixture copies. The real handlers derived their membership and opportunity signals. All six comparison subjects kept their order, all 25 Trending rows matched in full, and the browser displayed the same player order as the handler returned. [Fixture differences](browser-comparison-inputs.patch) · [Results for both revisions, including all IDs](browser-comparison-results.json)

| Comparison subject | Trending result on both revisions | Visible Opportunity Evidence on both revisions |
| --- | --- | --- |
| Skater 0 · 8470000 | Rank 1, positive TOI signal | TOI Up: TOI/G up +93s from last 20 to last 5. |
| Skater 1 · 8470001 | Rank 9, zero opportunity signals | Trending sample found, but no material opportunity-change signal. |
| Skater 2 · 8470002 | Outside the returned 25 | No live opportunity-change signal in the current trending sample. |

Both views displayed **Nov 17, 2026**. The matrix, all six joined composites, comparison source, latest Trending date and each of the four Trending windows reported **2026-11-17**. Full ordered Trending rows hashed to `c17505390fd8a3a80ce4cffeb7c799a0b7697011cfb73cc78d32f329110e2394` on each revision. The check waited for the positive and present-with-zero-signals states before accepting the outside-sample copy, which can also appear during loading. [Browser assertions](browser-comparison-states.mjs)

Repeat from the repository root with `node tasks/artifacts/rankings-current-season-2026-11-18/trending/browser.mjs --comparison-states`. This mode writes its own verification results. The original timing run and its samples remain the basis for the medians above.
