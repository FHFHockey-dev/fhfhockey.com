# SS1 ticket 22 receipt: Targeted Matchups (renamed card, tilt-team player mini-cards)

- Lane: SS1, canonical checkout. Offline fixtures only, no live reads, no Git, no commit. Isolated :3110, released at 2026-10-25T19:02:45Z (after the steer runs).
- **Note:** ticket 21 (chip contrast) is still **uncommitted** in the same tree. `SocialShare.module.scss` carries both tickets, and `SocialShare.chipContrast.test.ts` is ticket 21's. Commit them together, or 21 first.

## TJ steer after the TOR WIP (applied)

**Fieldset mini-cards**
- Each mini-card is now a real `<fieldset>`. The role ("SCORER", "SHOOTER + SCORER") is a centered `<legend>` notched into the top border.
- The native notch renders the same in the PNG export: I inspected the exported `monday-streaming-matchups.png`.

**Nothing clipped**
- The body is now line 1 the **full name** (wraps, never truncated), line 2 the **position** (left) and the **full value and unit** (right, never wrapped or cut).
- Before, "0.38 G/G…" was clipped and "0.15 G/GP" spilled past the border.
- The e2e now asserts, for every mini-card:
  - it is a FIELDSET;
  - its legend, name, position and value text equal `targetPicks()` exactly;
  - every part's box is inside the card;
  - no part is clipped (`scrollWidth ≤ clientWidth`).
- A **long-name stress case** ("Jean-Gabriel Ekman-Larsson" on every night's first pick) wraps inside its card, passes the same checks, and the tiles still fit the square.

**How picks are filtered (TJ's TOR question: Roslovic, McCabe at 1.2 SOG/GP, Sissons)**
- Picks come from the player layer. That layer holds **only Yahoo players under 50% rostered** (`yahoo_players` is read with `percent_ownership < 50`), who also have ≥ 5 season GP and current season totals.
- So the TOR picks are the **best available low-rostered TOR skaters** for each tilt, **not** the team's top shooters overall: those are over 50% rostered and are excluded on purpose.
- Within that pool the ranking is correct: the season rate for the tilt role, descending.
- **The card now says so:** a footer legend item **"Picks = rostered <50% (Yahoo), season rates"**, asserted in the e2e.
- If TJ wants top-of-team shooters regardless of rostered %, that needs a separate, wider player read. That's a product choice for TJ, not a bug.

## TJ's pop-up answers (this ticket)

| Question | Answer |
| --- | --- |
| Hits tilt (no team-hits source today) | **No hits tilt for now** |
| Shots-against tilt | **Derive it** from the team rates already read: the tilt team's SA/GP and the opponent's SF/GP both league top third → **SA STORM** → blockers |

## What changed

**1. Title and copy**
- **TARGETED MATCHUPS** (was STREAMING MATCHUPS). The "{Day} · Cherry-picked games" kicker is kept.
- "Most signals first · one night per team" was already removed in SS1-17. The e2e now asserts it's absent.

**2. Mini-cards:** under each tile's stat rows, up to **3 player mini-cards** across the tile, from the **TILT team only**. Each shows:
- the role label (Scorer / Shooter / Blocker; a dual pick shows "Shooter + Scorer");
- the one justifying stat (`0.44 G/GP`, `3.8 SOG/GP`, `1.7 BLK/GP`);
- name · positions.

**3. Pick rules** (`lib/socialShare/targets.ts`)
- **By tilt:** goal storm → scorers (season G/GP); shot storm → shooters (SOG/GP); SA storm → blockers (BLK/GP).
- **2+ tilts:** picks **alternate** across them, best remaining first. A player who is also the best remaining fit for another tilt **covers both**, which frees a slot.
- **No storm** (tired, soft defense or off-night only): uses the strongest primary pairing, i.e. the lowest combined league-rank share across goals, shots and SA.
- **Who's eligible:** skaters on the tilt team; no goalies; no unknown stat for that role. Fewer than 3 qualifying players means fewer cards, never filler.
- **Ownership:** picks come from the player layer, which holds **under-50% rostered** players only, so these are realistic targets.
- The SA tilt only drives picks and its own chip. It does **not** change which nights are chosen or their order (`selectionFlags` excludes it).

**4. Data, bounded and fail-closed**
- **No new tables or reads:** one existing column, `goals`, was added to the bounded `wgo_skater_stats_totals` read. It is kept in the schema and not in the dropped-columns list.
- **Server trim:**
  - The ranking pool gains each night's top 3 candidates per tilt role (`RANK_POOL_MAX` 186).
  - The trim keeps only the picks: `TRIMMED_PLAYERS_MAX` 84, i.e. +6 nights × 3.
  - It **records** each night's picks and roles on the trimmed layer (`players.targets`, key `TEAM:gameId`).
- **Why record them:** the e2e caught that re-deriving the dual-cover roles from the smaller trimmed set changed them (same players, different roles). The client now shows the server's record on live editions. An older edition without it shows no picks, never a guess.
- **Season rates only.** I didn't add L5 "recent form" to the scorer rule. It would need an L5 read for every tilt-team candidate. That's an easy follow-up if TJ wants recent form weighed in.

**5. Layout:** stream tiles go from 252 to 270px rows with an 8px gap and slightly tighter evidence rows, so a tile whose tags wrap to two rows still fits its mini-cards. All tiles were checked for overflow (the BUF/STL tiles were the tight cases), and geometry stays inside the square.

## Tests

- **`targets.test.ts` (new, 8):**
  - goal storm → top 3 scorers with the `0.50 G/GP` stat;
  - shot storm → shooters, SA storm → blockers (`3.0 BLK/GP`);
  - **2-tilt spread:** scorer, shooter, scorer;
  - **dual coverage:** the best scorer and shooter covers both, then shooter, then scorer;
  - no-storm fallback to the strongest pairing, both ways;
  - unknown data, other teams, goalies, untrusted or stale give no or fewer cards;
  - the server pool holds the top 3 per role;
  - the recorded picks on a trimmed layer reproduce the full result, and a legacy trimmed layer gives none.
- **`schedule.test.ts`:** the server's kept set equals pickups + specialists + both tier modes + **target picks**, ≤ 84 players, with no hidden player names.
- **E2E** (behind the real gate; fictional `.invalid` editor; deny preload): **30/30** in run A, run B and the final pinned run. The stream test now asserts:
  - the TARGETED MATCHUPS title, the kicker, and no "STREAMING MATCHUPS" or "Most signals first";
  - every tile's mini-cards (`data-target`, `data-roles`) equal `targetPicks()`, all from the tilt team;
  - geometry;
  - the **live-trimmed** edition shows the same picks and roles.
- **Vitest** `lib/socialShare/` + `components/SocialShare/`: **191/191** (after the steer). ESLint on the social lib, components and spec: exit 0. Scoped tsc: no social-share errors. **CSS pure check:** PURE OK.

## PNG pins (22 asserted; identical across runs)

- **Changed (2):** Monday stream `f83f1493…` and Wednesday stream `238b4874…`, from the rename, the fieldset mini-cards and the picks note.
- **Unchanged (20):** all other cards, versus ticket 21.
- Values are in `t22/pinned-env.txt`.

## Files (sha256 in `HASHES-22.txt`; ticket 21's files included because they are still uncommitted)

| | File | sha256 (12) |
| --- | --- | --- |
| M | web/components/SocialShare/SocialShare.module.scss (t21 + t22) | d3974eed3ae7 |
| M | web/components/SocialShare/SocialShare.tsx | 33e0c88f0bd1 |
| M | web/e2e/social-share.spec.ts | cbb4d738ac42 |
| M | web/lib/socialShare/matchups.ts | d09dada38f7e |
| M | web/lib/socialShare/pickupsFixture.ts | 644e3a17de7e |
| M | web/lib/socialShare/playerSources.ts | a93ce1a4f5d8 |
| M | web/lib/socialShare/players.ts | 89c4c1317fe2 |
| M | web/lib/socialShare/schedule.test.ts | cc25c365284f |
| M | web/lib/socialShare/tiers.ts | 75e2e5027bce |
| M | web/lib/socialShare/types.ts | ce1d3163033f |
| A | web/lib/socialShare/targets.ts | 5f7d6f1f4a1c |
| A | web/lib/socialShare/targets.test.ts | 2a005361aee9 |
| A (t21) | web/components/SocialShare/SocialShare.chipContrast.test.ts | e0479401de72 |

**Evidence:** `handoffs/SS1/t22/` (logs, runs A and B, evidence PNGs, pins, runner). The stream PNG was inspected after each layout pass.

## Open

- Recent form in the scorer rule (above).
- A hits tilt once a team-hits source exists.
