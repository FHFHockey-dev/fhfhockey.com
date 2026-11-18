# Trending production release · November 18, 2026

**Shipped and verified.** Production master fast-forwarded from `83750b4abd672399113659b96c279a1ddaeb425b` to the approved standalone release `50dea27b84a34b05a1aa6e67dc24d2774e5d3f24`. The change touches two query source files and their regression test. The website project built once. The CMS, functions and repository-root projects each canceled their deployment entry. The production alias switched at 16:09:11 UTC. The Rankings publisher was absent from this release. [Released commit](https://github.com/FHFHockey-dev/fhfhockey.com/commit/50dea27b84a34b05a1aa6e67dc24d2774e5d3f24) · [Vercel deployment](https://vercel.com/fhfhockeydevs-projects/fhfhockey/dpl_Ar31rHkggarnGjwv6Xb4SGZrbnBr)

The canonical website served five sequential HTTP 200 responses. Chromium hydrated the served HTML and the 12 immutable Next.js assets (1,204,985 bytes) fetched from that deployment. The responses for season, matrix, Trending and comparison came from production. Static metadata came from the exact release locally. Fonts, images, analytics and unrelated prefetches were excluded. The browser replay made zero additional production application requests. [HTTP and Chromium evidence](production-smoke.json)

| Consumer | Observed result |
| --- | --- |
| Trending tab | Clicking Trending displayed all 25 returned player IDs in order with matching teams and all 40 opportunity badges and explanations. All four windows showed Nov 17. |
| Default comparison | The matrix reported 775 ranked skaters at Nov 14. All six default comparison IDs matched the live comparison response. Each was outside the returned top 25 and displayed the corresponding outside-sample message. The three possible comparison states were also exercised locally against both revisions. |

The single production Trending response took 10.033 seconds. The comparison response took 6.283 seconds and the matrix response took 8.503 seconds. These are sequential response times from one smoke check. Cold and warm interaction improvements were measured separately in the [matched browser receipt](browser-receipt.md).
