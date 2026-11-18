import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { DisplayProfile } from "./displayProfile";
import { inspectArmCExport } from "./armCExport.server";

// The lowest IDs with five captured appearances and with one in the November 1 request.
const skaters = [{ playerId: 8470613, name: "Brent Burns" }, { playerId: 8474102, name: "David Perron" }];
const receipt = "b03ce39656537671d5d0d9e3d70e5273556581c105a8209d1a4aeda324d46f19";
const archiveThrough = "2026-10-31";
type DatedProduction = { dates: string[]; seconds: number | null; total: number | null; perAppearance: number | null };
type ArchivedProfile = {
  playerId: number; dates: string[]; seconds: number | null; appearances: number; selectedRecords: number;
  tracks: { fantasyPoints: { allSelectedCountsAndExposureMatched: boolean; matchedSelectedRecords: number;
    capturedMetric: { total: number | null; perAppearance: number | null; coveredRecords: number } } };
};
export type ArmCPreview = {
  evaluatedAtUTC: string; eventThroughDate: string; archiveThrough: string;
  rows: { playerId: number; name: string; archived: DatedProduction | null; profile: DisplayProfile | null; reasons: string[] }[];
};

function readDatedProduction() {
  const path = join(process.cwd(), "../tasks/artifacts/blsh-ppp-later-composition-2026-11-07/candidate-01/PROFILES.json");
  const result = new Map<number, DatedProduction>();
  if (statSync(path).size !== 2_192_467) throw Error("dated_record_size_changed");
  const bytes = Uint8Array.from(readFileSync(path));
  if (createHash("sha256").update(bytes).digest("hex") !== receipt) throw Error("dated_record_digest_changed");
  const archived = JSON.parse(new TextDecoder().decode(bytes)) as ArchivedProfile[];
  for (const { playerId } of skaters) {
    const p = archived.find(row => row.playerId === playerId);
    if (!p || p.dates.length !== p.appearances || p.appearances !== p.selectedRecords) continue;
    const track = p.tracks.fantasyPoints;
    const matched = track.allSelectedCountsAndExposureMatched && track.matchedSelectedRecords === p.appearances
      && track.capturedMetric.coveredRecords === p.appearances;
    result.set(playerId, { dates: p.dates, seconds: matched ? p.seconds : null, total: matched ? track.capturedMetric.total : null,
      perAppearance: matched ? track.capturedMetric.perAppearance : null });
  }
  return result;
}

/** Server-selected local preview. The source directory supplies no reviews or policy configuration. */
export async function readArmCPreview(evaluatedAtUTC: string, directory?: string, eventThroughDate = evaluatedAtUTC.slice(0, 10),
  inspect = inspectArmCExport, selected = skaters): Promise<ArmCPreview> {
  const validCutoff = /^\d{4}-\d{2}-\d{2}$/.test(eventThroughDate) && Number.isFinite(Date.parse(eventThroughDate))
    && new Date(eventThroughDate).toISOString().slice(0, 10) === eventThroughDate && eventThroughDate <= evaluatedAtUTC.slice(0, 10);
  let dated = new Map<number, DatedProduction>();
  try { dated = readDatedProduction(); } catch { /* The other preview sources remain available. */ }
  const rows: ArmCPreview["rows"] = [];
  for (const skater of selected) {
    let profile: DisplayProfile | null = null;
    let reasons = [validCutoff ? "reviewed_window_not_supplied" : "invalid_selected_cutoff"];
    if (directory && validCutoff) {
      try {
        const checked = await inspect(join(directory, eventThroughDate, String(skater.playerId)),
          { playerId: skater.playerId, eventThroughDate }, evaluatedAtUTC, "read");
        if (checked.status === "available") {
          if (checked.profile.playerId === skater.playerId && checked.profile.evidence.window.recordedThroughDate === eventThroughDate) {
            profile = checked.profile;
            reasons = [];
          } else { reasons = ["candidate_target_mismatch"]; }
        } else { reasons = checked.reasons; }
      } catch (error) {
        reasons = [(error as NodeJS.ErrnoException).code === "ENOENT" ? "reviewed_export_incomplete" : "reviewed_export_unreadable"];
      }
    }
    rows.push({ ...skater, archived: dated.get(skater.playerId) ?? null, profile, reasons });
  }
  return { evaluatedAtUTC, eventThroughDate, archiveThrough, rows };
}
