// Post-capture deadline check: would the gate still find this evidence CURRENT at --evaluated-at?
// Offline and read-only. Re-states the gate's own time rules (web/lib/buyLowSellHigh/currentProcessEvidence.server.ts
// :129, :201-214, :256) over the actual files, conservatively (one global earliest time, not per group):
//   - evaluation >= request.asOfUTC                                   (evaluation_precedes_source_request)
//   - every native retrieval, frame observation and feed capture <= evaluation   (evidence_after_evaluation)
//   - each frame: date <= completedBy date; completedBy <= frame observation and <= every native retrieval
//                                                                     (evidence_chronology_unqualified)
//   - evaluation - earliest(native, frame, calendar/wgo/individual/onIce captures) <= maxCaptureAgeHours, inclusive
//                                                                     (capture_age_exceeded)
//   - evaluation UTC date - native date <= maxEventAgeDays, inclusive (event_age_exceeded)
// Candidate-independent: it reads every time from the files. For the 11-17 slot (v5) the 24 h rule binds (about
// 2026-11-18T14:05Z); for the parked 11-18 fallback (v5-1118, same source date 2026-11-11) the date rule binds
// (2026-11-18T23:59:59.999Z), so any 2026-11-19 evaluation is refused with event_age_exceeded.
// It also prints deadlineUTC, the last instant at which all of these still hold. The installed gate's evaluation (not the
// review) must happen by then, so the reviewer's turnaround sits inside this window.
// Usage: node deadline-check.mjs --request <request.json> --conversion <conversion dir> --frames <frames dir> --evaluated-at <ISO UTC>
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BridgeRefusal, need, parseJson, readBound, stamp, MIB } from "../lib.mjs";

const HOUR = 3600_000, DAY = 24 * HOUR;
const iso = ms => new Date(ms).toISOString();

export function deadlineCheck({ requestPath, conversionDir, framesDir, evaluatedAtUTC }) {
  need([requestPath, conversionDir, framesDir, evaluatedAtUTC].every(v => typeof v === "string"), "usage_request_conversion_frames_evaluated_at_required");
  const request = parseJson(readBound(requestPath, 32 * MIB), "request_invalid");
  const conversion = parseJson(readBound(join(conversionDir, "CONVERSION.json"), MIB), "conversion_invalid");
  const policy = request.freshnessPolicy;
  need(Number.isFinite(policy?.maxCaptureAgeHours) && Number.isFinite(policy?.maxEventAgeDays), "freshness_policy_missing");
  const evalAt = stamp(evaluatedAtUTC, "evaluated_at_invalid");
  const native = ["individual", "onIce"].map(g => stamp(parseJson(readBound(join(conversionDir, `receipt-${g}.json`), MIB)).retrievedAtUTC));
  const feeds = ["calendar", "wgo", "individual", "onIce"].map(name => { need(request[name]?.capture, "current_use_capture_unavailable"); return stamp(request[name].capture.retrievedAtUTC); });
  const index = parseJson(readBound(join(framesDir, "FRAMES.json"), 4 * MIB), "frames_invalid");
  need(index.mode === "production" && index.date === conversion.date, "frames_not_production_or_wrong_date");
  const frames = index.frames.map(f => parseJson(readBound(join(framesDir, `frame-${f.gameId}-${f.playerId}.json`), MIB)));
  need(frames.length > 0, "no_frames");
  const observed = frames.map(f => stamp(f.observedAtUTC)), completed = frames.map(f => stamp(f.completedByUTC));
  const earliestNative = Math.min(...native);
  need(frames.every((f, k) => f.date <= iso(completed[k]).slice(0, 10) && completed[k] <= observed[k] && completed[k] <= earliestNative), "evidence_chronology_unqualified");
  const all = [...native, ...observed, ...feeds], earliest = Math.min(...all);
  const captureDeadline = earliest + policy.maxCaptureAgeHours * HOUR;
  const eventDeadline = Date.parse(`${conversion.date}T00:00:00Z`) + (policy.maxEventAgeDays + 1) * DAY - 1; // last ms of the last allowed day
  const deadline = Math.min(captureDeadline, eventDeadline);
  const report = { evaluatedAtUTC: iso(evalAt), nativeDate: conversion.date, requestAsOfUTC: request.asOfUTC, earliestEvidenceUTC: iso(earliest),
    latestEvidenceUTC: iso(Math.max(...all)), captureAgeDeadlineUTC: iso(captureDeadline), eventAgeDeadlineUTC: iso(eventDeadline), deadlineUTC: iso(deadline),
    bindingRule: captureDeadline <= eventDeadline ? "capture_age" : "event_age" };
  const check = (ok, code) => { if (!ok) throw Object.assign(new BridgeRefusal(code), { report }); };
  check(evalAt >= stamp(request.asOfUTC), "evaluation_precedes_source_request");
  check(all.every(t => t <= evalAt), "evidence_after_evaluation");
  check(evalAt <= captureDeadline, "capture_age_exceeded");
  check(evalAt <= eventDeadline, "event_age_exceeded");
  return { ok: true, ...report, marginMinutes: Math.floor((deadline - evalAt) / 60_000) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = n => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
  try {
    process.stdout.write(`${JSON.stringify(deadlineCheck({ requestPath: arg("request"), conversionDir: arg("conversion"), framesDir: arg("frames"), evaluatedAtUTC: arg("evaluated-at") }))}\n`);
  } catch (e) {
    process.stdout.write(`${JSON.stringify({ ok: false, refusal: e instanceof BridgeRefusal ? e.code : "deadline_check_error", ...(e?.report ?? {}) })}\n`); process.exitCode = 2;
  }
}
