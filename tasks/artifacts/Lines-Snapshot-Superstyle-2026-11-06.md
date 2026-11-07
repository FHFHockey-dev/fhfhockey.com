# Lines snapshot UI · superstyle backlog (Lane B, 2026-11-06)

Scope: the snapshot block (`web/components/LineCombinations/{GameLineSnapshots,ProjectedLineups,SourceFeed}.tsx`, `ProjectedLineups.module.scss`, `reviewReasonCopy.ts`) on `/lines/[team]` and `/lines/line-combo/[gameId]`, at 390 and 1440. Lineup flags are off on :3000, so captures use a synthetic fixture served by Playwright route interception. Lane C owns the page shells and legacy grid; findings there are logged for Chef.

| page | element (file) | finding and suggested fix | severity | pass |
|---|---|---|---|---|
| both | snapshot header gutter (Chef nit c) | Looked flush left in the element-cropped fixture shot. On the real page it lines up with the h1 at 390 and 1440. No change. | Done (no change) | 1 |
| both | goalie unit chip (`GameLineSnapshots.tsx`) | ~~"Confirmed" chip sits beside "the starter isn't confirmed" (Chef nit a).~~ Now "Tandem confirmed" plus a neutral "Starter not confirmed" chip. | Done | 1 |
| both | game picker + carried label (`reviewReasonCopy.ts` gameLabel) | ~~ISO dates (Chef nit b).~~ "Nov 6 · BOS at TBL" everywhere, formatted in UTC. | Done | 1 |
| both | game status line (`GameLineSnapshots.tsx`) | ~~Repeats the picker's game label.~~ "Live · checked Nov 6, 7:40 PM". | Done | 1 |
| both | entry rows (`GameLineSnapshots.tsx`) | ~~Same source repeated on every row.~~ "Source: …" once under the group heading when every row shares it. | Done | 1 |
| both | IGA claim meta (`GameLineSnapshots.tsx`) | ~~Three meta lines, repeated game label.~~ One line ("During the game · This game · Reported"); "Observed in game" chip. | Done | 1 |
| 390 | unit label column (`ProjectedLineups.module.scss`) | ~~72px column squeezes names.~~ 52px on phones; names wrap only between players (non-breaking spaces). | Done | 1 |
| all | source attribution (TJ rule, `reviewReasonCopy.ts`, `SourceFeed.tsx`, `GameLineSnapshots.tsx`) | ~~Relay accounts shown as the source.~~ Source is the quoted original's author; the six relay accounts never shown (FHFHockey allowed, TJ via Chef); links go to the original tweet; "Original source not identified" otherwise. Relay chips removed (TJ). | Done | 1 |
| all | relay attribution in data (`web/lib/lines/authority.ts`, `service.ts:73`) | Engine seed tiers still treat a relay's direct post as its own original ("aggregator"); service falls back to the relay author. Lane A owns; sent to Chef 2026-11-06. | Other lane (A) | 1 |
| both | panels, dividers, accent notes (`ProjectedLineups.module.scss`) | ~~Hand-rolled panel surface, 4 dividers, 5 accent notes with literal 4/6px radii, 0.06em tracking.~~ `panel-shell` flat, `panel-divider`, `accent-note` mixin on radius tokens, letter-spacing token. Visually identical. | Done | 2 |
| /lines/[team] | lineup groups (`GameLineSnapshots.tsx`) | ~~axe landmark-unique: group sections were named regions colliding with the legacy grid ("Forwards", "Goalies").~~ `role="group"` with the same h3. axe 2/1 → 0. | Done | 3 |
| both | picker, tab rail, Show all reports (`ProjectedLineups.module.scss`) | ~~Control edges 2.10:1 (1.4.11).~~ `$border-control` 3.35:1. | Done | 3 |
| both | disclosure toggles (`ProjectedLineups.module.scss`) | ~~21px targets (2.5.8).~~ 24px with blue ▸/▾ marker. | Done | 3 |
