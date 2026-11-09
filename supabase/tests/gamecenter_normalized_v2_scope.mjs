// Builds persist RPC arguments with the real Gamecenter writer, for the local
// PostgreSQL proof in gamecenter_normalized_v2_shift_dedupe.py.
// stdin: {"pbp": {...}, "shiftPayload": {...}, "pbpHash": "...", "shiftHash": "...", "rawScope": bool}
// stdout: {"roster": [...], "events": [...], "shifts": [...]}
import { readFileSync } from "node:fs";
import {
  buildNormalizedGameScope,
  normalizePbpEvents,
  normalizeRosterSpots,
  normalizeShiftRows,
} from "../../web/lib/supabase/Upserts/nhlRawGamecenter.mjs";

const input = JSON.parse(readFileSync(0, "utf8"));
const { pbp, shiftPayload, pbpHash, shiftHash } = input;
// rawScope: one row per raw entry (what v1 requires); otherwise the writer's canonical rows.
const shiftRows = input.rawScope
  ? normalizeShiftRows({ ...pbp, gameState: "LIVE" }, { data: [] }, shiftHash).concat(
      shiftPayload.data.map((shift) =>
        normalizeShiftRows(
          { ...pbp, gameState: "LIVE" },
          { data: [shift] },
          shiftHash,
        )[0],
      ),
    )
  : normalizeShiftRows(pbp, shiftPayload, shiftHash);
const scope = buildNormalizedGameScope({
  gameId: pbp.id,
  seasonId: Number(pbp.season),
  gameDate: pbp.gameDate,
  pbpPayloadHash: pbpHash,
  shiftPayloadHash: shiftHash,
  rosterRows: normalizeRosterSpots(pbp, pbpHash),
  eventRows: normalizePbpEvents(pbp, pbpHash),
  shiftRows,
});
process.stdout.write(
  JSON.stringify({
    roster: scope.rosterRows,
    events: scope.eventRows,
    shifts: scope.shiftRows,
    fingerprint: scope.parserFingerprint,
    parserVersion: scope.parserVersion,
    strengthVersion: scope.strengthVersion,
    materializerVersion: scope.materializerVersion,
  }),
);
