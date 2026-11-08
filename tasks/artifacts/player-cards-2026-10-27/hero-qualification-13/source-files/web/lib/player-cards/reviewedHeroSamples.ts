import type { HeroSample } from "../../components/player-cards/HeroPlayerCard";

// Dated local artwork qualified for local cards; receipts distinguish TJ acceptance from scoped agent QA.
// No live player-stat, current-roster or publication-rights claim.
export const REVIEWED_HERO_SAMPLES: readonly HeroSample[] = [
  {
    "id": 8479318,
    "name": "Auston Matthews",
    "team": "TOR",
    "position": "C",
    "sweater": 34,
    "sourceUrl": "https://assets.nhle.com/mugs/actionshots/1296x729/8479318.jpg",
    "sourceWidth": 1296,
    "sourceHeight": 729,
    "capturedAt": "2026-10-24T20:23:53.965681+00:00",
    "sourceSha256": "8f91559bcfedf1b96eaa4a273c03b8ffd5357b3bc749dbabb5e0c40bfa706a04",
    "alphaSha256": "713a4923cf4742cefbbc09a647a249f98c095edea8eb92f7bda028929e0db065",
    "acceptance": "accepted",
    "localPath": "/player-cards/hero-samples/8479318.png"
  },
  {
    "id": 8478864,
    "name": "Kirill Kaprizov",
    "team": "MIN",
    "position": "L",
    "sweater": 97,
    "sourceUrl": "https://assets.nhle.com/mugs/actionshots/1296x729/8478864.jpg",
    "sourceWidth": 1296,
    "sourceHeight": 729,
    "capturedAt": "2026-10-24T20:23:46.847896+00:00",
    "sourceSha256": "e06883cc7ce495affd87dadabf39ecfffbb0688691c70b8d833ab20e7f7b2973",
    "alphaSha256": "4199308c2f56a9ac0244697e7162f42283f1a5c247b656fb7c9278597b3ee18c",
    "acceptance": "accepted",
    "localPath": "/player-cards/hero-samples/8478864.png"
  },
  // Scoped local source/visual QA: hero-qualification-13/QUALIFICATION.json; not TJ personal acceptance.
  // Download receipt is dated 2026-10-24; exact download time is not recorded.
  {
    "id": 8476453,
    "name": "Nikita Kucherov",
    "team": "TBL",
    "position": "R",
    "sweater": 86,
    "sourceUrl": "https://assets.nhle.com/mugs/actionshots/1296x729/8476453.jpg",
    "sourceWidth": 1296,
    "sourceHeight": 729,
    "capturedAt": "2026-10-24",
    "sourceSha256": "3036cb4ec324cc902ab2d797f4e69b58347c85909d6ce92daab01b7123f0711b",
    "alphaSha256": "2010d97f1e1c631f7ccf154d991517f3b6923df7739d756e39ed06140aa1f278",
    "acceptance": "accepted",
    "localPath": "/player-cards/hero-samples/8476453.png"
  },
];
