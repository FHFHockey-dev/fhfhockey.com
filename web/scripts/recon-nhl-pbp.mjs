import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const webRoot = path.resolve(__dirname, "..");
const artifactsDir = path.join(repoRoot, "tasks", "artifacts");

const TODAY = process.env.RECON_TODAY || "2026-03-30";
const SAMPLE_SIZE = Number(process.env.RECON_SAMPLE_SIZE || 10);
const CANDIDATE_LIMIT = Number(process.env.RECON_CANDIDATE_LIMIT || 220);
const SHOT_LIKE_TYPES = new Set([
  "goal",
  "shot-on-goal",
  "missed-shot",
  "blocked-shot",
  "failed-shot-attempt",
]);

function parseEnvFile(text) {
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

async function loadEnv() {
  const envPaths = [
    path.join(webRoot, ".env.local"),
    path.join(repoRoot, ".env.local"),
  ];
  for (const envPath of envPaths) {
    try {
      const text = await fs.readFile(envPath, "utf8");
      parseEnvFile(text);
    } catch {
      // Ignore missing env files.
    }
  }
}

function parseSituationCode(situationCode) {
  if (!situationCode) return null;
  const s = String(situationCode).trim();
  if (!/^\d{4}$/.test(s)) return null;
  return {
    raw: s,
    awayGoalie: Number(s[0]),
    awaySkaters: Number(s[1]),
    homeSkaters: Number(s[2]),
    homeGoalie: Number(s[3]),
  };
}

function canonicalStrength(parsed, eventOwnerTeamId, homeTeamId, awayTeamId) {
  if (!parsed) {
    return {
      exact: null,
      state: null,
      attackingSkaters: null,
      defendingSkaters: null,
    };
  }

  const isHomeAttacking = eventOwnerTeamId === homeTeamId;
  const isAwayAttacking = eventOwnerTeamId === awayTeamId;
  const attackingSkaters = isHomeAttacking
    ? parsed.homeSkaters
    : isAwayAttacking
      ? parsed.awaySkaters
      : null;
  const defendingSkaters = isHomeAttacking
    ? parsed.awaySkaters
    : isAwayAttacking
      ? parsed.homeSkaters
      : null;
  const exact = `${parsed.awaySkaters}v${parsed.homeSkaters}`;

  let state = "EV";
  if (parsed.awayGoalie === 0 || parsed.homeGoalie === 0) {
    state = "EN";
  } else if (
    attackingSkaters != null &&
    defendingSkaters != null &&
    attackingSkaters !== defendingSkaters
  ) {
    state = attackingSkaters > defendingSkaters ? "PP" : "SH";
  }

  return { exact, state, attackingSkaters, defendingSkaters };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
      Accept: "application/json,text/plain,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }

  return response.json();
}

function createTypeBucket() {
  return {
    count: 0,
    detailKeys: new Map(),
  };
}

function addExample(set, value, max = 3) {
  if (set.size >= max) return;
  const normalized =
    value == null
      ? null
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  set.add(normalized);
}

function summarizeGame(game) {
  const plays = Array.isArray(game.plays) ? game.plays : [];
  const shotLike = plays.filter((play) => SHOT_LIKE_TYPES.has(play.typeDescKey));
  const penalties = plays.filter((play) => play.typeDescKey === "penalty");
  const goals = plays.filter((play) => play.typeDescKey === "goal");
  const emptyNetGoals = goals.filter((play) => {
    const parsed = parseSituationCode(play.situationCode);
    const zeroGoalie = parsed && (parsed.awayGoalie === 0 || parsed.homeGoalie === 0);
    return play.details?.emptyNet === true || (zeroGoalie && play.details?.goalieInNetId == null);
  });
  const delayedPenalties = plays.filter(
    (play) => play.typeDescKey === "delayed-penalty"
  );
  const maxPeriod = plays.reduce(
    (max, play) => Math.max(max, Number(play.periodDescriptor?.number || 0)),
    0
  );
  const hasOt = plays.some(
    (play) =>
      String(play.periodDescriptor?.periodType || "").toUpperCase() === "OT" ||
      Number(play.periodDescriptor?.number || 0) > 3
  );
  const hasShootout = plays.some(
    (play) =>
      String(play.periodDescriptor?.periodType || "").toUpperCase() === "SO" ||
      play.typeDescKey === "shootout-complete"
  );
  const unequalSkaterEvents = plays.filter((play) => {
    const parsed = parseSituationCode(play.situationCode);
    return parsed && parsed.awaySkaters !== parsed.homeSkaters;
  }).length;
  const zeroGoalieEvents = plays.filter((play) => {
    const parsed = parseSituationCode(play.situationCode);
    return parsed && (parsed.awayGoalie === 0 || parsed.homeGoalie === 0);
  }).length;

  return {
    id: game.id,
    gameDate: game.gameDate,
    homeTeam: game.homeTeam?.abbrev,
    awayTeam: game.awayTeam?.abbrev,
    totalEvents: plays.length,
    shotLikeEvents: shotLike.length,
    goals: goals.length,
    penalties: penalties.length,
    delayedPenalties: delayedPenalties.length,
    emptyNetGoals: emptyNetGoals.length,
    unequalSkaterEvents,
    zeroGoalieEvents,
    maxPeriod,
    hasOt,
    hasShootout,
  };
}

function pickDiverseGames(summaries) {
  const chosen = [];
  const used = new Set();

  function takeOne(label, predicate, sorter) {
    const candidate = summaries
      .filter((summary) => !used.has(summary.id) && predicate(summary))
      .sort(sorter)[0];
    if (!candidate) return;
    used.add(candidate.id);
    chosen.push({ label, ...candidate });
  }

  takeOne(
    "overtime",
    (summary) => summary.hasOt,
    (a, b) => b.shotLikeEvents - a.shotLikeEvents
  );
  takeOne(
    "empty-net",
    (summary) => summary.emptyNetGoals > 0,
    (a, b) => b.emptyNetGoals - a.emptyNetGoals || b.zeroGoalieEvents - a.zeroGoalieEvents
  );
  takeOne(
    "heavy-special-teams",
    (summary) => summary.penalties >= 8 || summary.unequalSkaterEvents >= 20,
    (a, b) => b.penalties - a.penalties || b.unequalSkaterEvents - a.unequalSkaterEvents
  );
  takeOne(
    "low-event",
    (summary) => !summary.hasOt,
    (a, b) => a.shotLikeEvents - b.shotLikeEvents
  );
  takeOne(
    "high-event",
    (summary) => true,
    (a, b) => b.shotLikeEvents - a.shotLikeEvents
  );
  takeOne(
    "regulation-control",
    (summary) => !summary.hasOt && summary.emptyNetGoals === 0,
    (a, b) => a.penalties - b.penalties || b.shotLikeEvents - a.shotLikeEvents
  );
  takeOne(
    "goalie-pulled",
    (summary) => summary.zeroGoalieEvents > 0,
    (a, b) => b.zeroGoalieEvents - a.zeroGoalieEvents
  );

  for (const summary of summaries) {
    if (chosen.length >= SAMPLE_SIZE) break;
    if (used.has(summary.id)) continue;
    used.add(summary.id);
    chosen.push({ label: `fill-${chosen.length + 1}`, ...summary });
  }

  return chosen.slice(0, SAMPLE_SIZE);
}

function buildEventDictionary(games) {
  const buckets = new Map();
  const situationExamples = [];

  for (const game of games) {
    for (const play of game.plays || []) {
      const bucketKey = `${play.typeCode}|${play.typeDescKey}`;
      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, {
          typeCode: play.typeCode,
          typeDescKey: play.typeDescKey,
          count: 0,
          detailKeys: new Map(),
        });
      }

      const bucket = buckets.get(bucketKey);
      bucket.count += 1;

      const details = play.details || {};
      for (const [detailKey, detailValue] of Object.entries(details)) {
        if (!bucket.detailKeys.has(detailKey)) {
          bucket.detailKeys.set(detailKey, {
            present: 0,
            examples: new Set(),
          });
        }
        const detailBucket = bucket.detailKeys.get(detailKey);
        detailBucket.present += 1;
        addExample(detailBucket.examples, detailValue);
      }

      const parsed = parseSituationCode(play.situationCode);
      if (
        situationExamples.length < 16 &&
        parsed &&
        (play.details?.emptyNet === true ||
          play.typeDescKey === "goal" ||
          play.typeDescKey === "shot-on-goal" ||
          play.typeDescKey === "penalty" ||
          play.typeDescKey === "delayed-penalty")
      ) {
        const strength = canonicalStrength(
          parsed,
          play.details?.eventOwnerTeamId ?? null,
          game.homeTeam.id,
          game.awayTeam.id
        );
        situationExamples.push({
          gameId: game.id,
          typeCode: play.typeCode,
          typeDescKey: play.typeDescKey,
          situationCode: parsed.raw,
          eventOwnerTeamId: play.details?.eventOwnerTeamId ?? null,
          emptyNet: play.details?.emptyNet ?? null,
          homeTeam: game.homeTeam.abbrev,
          awayTeam: game.awayTeam.abbrev,
          exactStrength: strength.exact,
          state: strength.state,
        });
      }
    }
  }

  return {
    eventTypes: [...buckets.values()]
      .map((bucket) => ({
        typeCode: bucket.typeCode,
        typeDescKey: bucket.typeDescKey,
        count: bucket.count,
        detailKeys: [...bucket.detailKeys.entries()]
          .map(([detailKey, info]) => ({
            detailKey,
            presencePct: Number(((info.present / bucket.count) * 100).toFixed(1)),
            examples: [...info.examples],
          }))
          .sort((a, b) => a.detailKey.localeCompare(b.detailKey)),
      }))
      .sort((a, b) => a.typeCode - b.typeCode),
    situationExamples,
  };
}

function inferSituationMapping(games) {
  const emptyNetExamples = [];
  const threeOnThreeExamples = [];
  const sixOnFiveExamples = [];

  for (const game of games) {
    for (const play of game.plays || []) {
      const parsed = parseSituationCode(play.situationCode);
      if (!parsed) continue;
      const ownerTeamId = play.details?.eventOwnerTeamId ?? null;
      const strength = canonicalStrength(
        parsed,
        ownerTeamId,
        game.homeTeam.id,
        game.awayTeam.id
      );
      const base = {
        gameId: game.id,
        typeDescKey: play.typeDescKey,
        situationCode: parsed.raw,
        eventOwnerTeamId: ownerTeamId,
        homeTeam: game.homeTeam.abbrev,
        awayTeam: game.awayTeam.abbrev,
        exactStrength: strength.exact,
        state: strength.state,
        emptyNet: play.details?.emptyNet ?? null,
      };

      if (
        play.typeDescKey === "goal" &&
        (play.details?.emptyNet === true ||
          ((parsed.awayGoalie === 0 || parsed.homeGoalie === 0) &&
            play.details?.goalieInNetId == null)) &&
        emptyNetExamples.length < 6
      ) {
        emptyNetExamples.push(base);
      }

      if (
        String(play.periodDescriptor?.periodType || "").toUpperCase() === "OT" &&
        parsed.awaySkaters === 3 &&
        parsed.homeSkaters === 3 &&
        threeOnThreeExamples.length < 4
      ) {
        threeOnThreeExamples.push(base);
      }

      if (
        (parsed.awayGoalie === 0 || parsed.homeGoalie === 0) &&
        ((parsed.awaySkaters === 6 && parsed.homeSkaters === 5) ||
          (parsed.awaySkaters === 5 && parsed.homeSkaters === 6)) &&
        sixOnFiveExamples.length < 6
      ) {
        sixOnFiveExamples.push(base);
      }
    }
  }

  return {
    inferredOrdering:
      "Empirical samples are consistent with situationCode = awayGoalie, awaySkaters, homeSkaters, homeGoalie.",
    examples: {
      emptyNetExamples,
      threeOnThreeExamples,
      sixOnFiveExamples,
    },
  };
}

function toMarkdown(data) {
  const lines = [];
  lines.push("# NHL PbP Recon");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Recon date anchor: ${TODAY}`);
  lines.push("");
  lines.push("## Sample Games");
  lines.push("");
  lines.push(
    "| label | gameId | date | matchup | OT | EN goals | penalties | shot-like | zero-goalie events |"
  );
  lines.push("| --- | ---: | --- | --- | --- | ---: | ---: | ---: | ---: |");
  for (const game of data.sampleGames) {
    lines.push(
      `| ${game.label} | ${game.id} | ${game.gameDate} | ${game.awayTeam} @ ${game.homeTeam} | ${game.hasOt ? "yes" : "no"} | ${game.emptyNetGoals} | ${game.penalties} | ${game.shotLikeEvents} | ${game.zeroGoalieEvents} |`
    );
  }
  lines.push("");
  lines.push("## Event Dictionary");
  lines.push("");
  for (const type of data.eventDictionary.eventTypes) {
    lines.push(
      `### ${type.typeCode} ${type.typeDescKey} (${type.count} events)`
    );
    if (type.detailKeys.length === 0) {
      lines.push("");
      lines.push("No `details` keys observed.");
      lines.push("");
      continue;
    }
    lines.push("");
    lines.push("| detail key | presence % | examples |");
    lines.push("| --- | ---: | --- |");
    for (const detailKey of type.detailKeys) {
      const examples = detailKey.examples.join(", ");
      lines.push(
        `| ${detailKey.detailKey} | ${detailKey.presencePct} | ${examples || "-"} |`
      );
    }
    lines.push("");
  }
  lines.push("## Situation Code Inference");
  lines.push("");
  lines.push(data.situationMapping.inferredOrdering);
  lines.push("");
  for (const [section, examples] of Object.entries(data.situationMapping.examples)) {
    lines.push(`### ${section}`);
    lines.push("");
    if (!examples.length) {
      lines.push("No examples captured.");
      lines.push("");
      continue;
    }
    lines.push(
      "| gameId | matchup | type | situationCode | exact | state | emptyNet | ownerTeamId |"
    );
    lines.push("| ---: | --- | --- | --- | --- | --- | --- | ---: |");
    for (const example of examples) {
      lines.push(
        `| ${example.gameId} | ${example.awayTeam} @ ${example.homeTeam} | ${example.typeDescKey} | ${example.situationCode} | ${example.exactStrength} | ${example.state} | ${example.emptyNet} | ${example.eventOwnerTeamId ?? ""} |`
      );
    }
    lines.push("");
  }
  lines.push("## Endpoint Notes");
  lines.push("");
  lines.push("- `https://api-web.nhle.com/v1/gamecenter/{gameId}/play-by-play` for raw event stream.");
  lines.push("- `https://api-web.nhle.com/v1/gamecenter/{gameId}/boxscore` for game rosters and goalie context.");
  lines.push("- `https://api-web.nhle.com/v1/gamecenter/{gameId}/landing` for additional game summary metadata.");
  lines.push("- `https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId={gameId}` for shifts and on-ice attribution.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function main() {
  await loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase credentials in environment.");
  }

  const supabase = createClient(url, key);
  const { data: gameRows, error } = await supabase
    .from("games")
    .select("id,date,seasonId,type")
    .eq("type", 2)
    .lte("date", TODAY)
    .order("date", { ascending: false })
    .limit(CANDIDATE_LIMIT);

  if (error) throw error;

  const pbpGames = [];
  for (const row of gameRows || []) {
    const pbp = await fetchJson(
      `https://api-web.nhle.com/v1/gamecenter/${row.id}/play-by-play`
    );
    pbpGames.push(pbp);
  }

  const summaries = pbpGames
    .map((game) => summarizeGame(game))
    .filter((summary) => summary.totalEvents > 0)
    .sort((a, b) => new Date(b.gameDate) - new Date(a.gameDate));

  const sampleGames = pickDiverseGames(summaries);
  const sampledIds = new Set(sampleGames.map((game) => game.id));
  const sampledGames = pbpGames.filter((game) => sampledIds.has(game.id));
  const eventDictionary = buildEventDictionary(sampledGames);
  const situationMapping = inferSituationMapping(sampledGames);

  const payload = {
    generatedAt: new Date().toISOString(),
    reconDate: TODAY,
    sampleGames,
    eventDictionary,
    situationMapping,
    candidateCount: pbpGames.length,
  };

  await fs.mkdir(artifactsDir, { recursive: true });
  const stem = `nhl-pbp-recon-${TODAY}`;
  await fs.writeFile(
    path.join(artifactsDir, `${stem}.json`),
    JSON.stringify(payload, null, 2),
    "utf8"
  );
  await fs.writeFile(
    path.join(artifactsDir, `${stem}.md`),
    toMarkdown(payload),
    "utf8"
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        candidateCount: pbpGames.length,
        sampledGameIds: sampleGames.map((game) => game.id),
        markdownReport: path.join(artifactsDir, `${stem}.md`),
        jsonReport: path.join(artifactsDir, `${stem}.json`),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
