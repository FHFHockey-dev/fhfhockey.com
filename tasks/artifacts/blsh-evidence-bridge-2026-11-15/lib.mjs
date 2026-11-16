// Shared, dependency-free helpers for the offline BLSH evidence bridge.
// No network, no repository imports, no credentials.
import { createHash } from "node:crypto";
import { closeSync, fstatSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, readSync, unlinkSync, writeSync, constants } from "node:fs";
import { join } from "node:path";

export const MIB = 1024 * 1024;
export const SEASON = 20262027;
export const GROUPS = ["individual", "onIce"];
export const TOI_CONTRACT = "minutes_decimal_or_mmss_to_seconds_half_up";
export const GATE_REPRESENTATION = "parser_input_after_redaction";

export class BridgeRefusal extends Error {
  constructor(code) { super(code); this.code = code; }
}
export const need = (ok, code) => { if (!ok) throw new BridgeRefusal(code); };
export const sha = bytes => createHash("sha256").update(bytes).digest("hex");
export const isHash = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

/** Read a regular, non-symlink file with an exact byte bound. */
export function readBound(path, maximum) {
  const info = lstatSync(path);
  need(info.isFile() && !info.isSymbolicLink(), "input_not_regular_file");
  need(info.size > 0 && info.size <= maximum, "input_byte_bound");
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const size = fstatSync(fd).size;
    need(size === info.size, "input_changed_while_reading");
    const buffer = Buffer.alloc(size);
    let offset = 0;
    while (offset < size) { const n = readSync(fd, buffer, offset, size - offset, offset); if (!n) break; offset += n; }
    need(offset === size, "input_short_read");
    return buffer;
  } finally { closeSync(fd); }
}

/** Strict JSON: UTF-8 (fatal), no duplicate object keys, safe integers only. */
export function parseJson(bytes, code = "invalid_json") {
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new BridgeRefusal(code); }
  let value;
  try { value = JSON.parse(text); } catch { throw new BridgeRefusal(code); }
  // JSON.parse silently keeps the last duplicate; scan tokens of the already-valid text.
  const tokens = [...text.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\]:,]/g)].map(m => m[0]);
  const stack = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "{" || t === "[") stack.push(t === "{" ? new Set() : null);
    else if (t === "}" || t === "]") stack.pop();
    else if (t.startsWith('"') && tokens[i + 1] === ":") {
      const keys = stack[stack.length - 1], key = JSON.parse(t);
      need(keys && !keys.has(key), "duplicate_json_key"); keys.add(key);
    }
  }
  const walk = v => {
    if (typeof v === "number") need(Number.isFinite(v) && (!Number.isInteger(v) || Number.isSafeInteger(v)), "unsafe_json_number");
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(value);
  return value;
}

export const encode = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);

/** Same grammar as the gate's `time()` (currentProcessEvidence.server.ts:56-69); returns epoch ms (UTC). */
export function stamp(value, code = "invalid_evidence_time") {
  const m = typeof value === "string" ? /^(\d{4}-\d{2}-\d{2})T((?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d)(?:\.(\d{1,6}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value) : null;
  need(m, code);
  const ms = Date.parse(`${m[1]}T${m[2]}Z`);
  need(Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 19) === `${m[1]}T${m[2]}`, code);
  let offset = 0;
  if (m[4] !== "Z") {
    const h = Number(m[6]), mi = Number(m[7]);
    need(h <= 14 && mi <= 59 && (h < 14 || mi === 0) && m[4] !== "-00:00", code);
    offset = (h * 60 + mi) * (m[5] === "+" ? 1 : -1);
  }
  return ms + Number((m[3] ?? "").padEnd(6, "0")) / 1000 - offset * 60000;
}
export const isDay = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

/** Canonical NST URL built by the frozen preparation (nativeProcessCapturePreparation.ts:26-33). */
export function canonicalNstUrl(date, group) {
  const url = new URL("https://data.naturalstattrick.com/playerteams.php");
  const query = { fromseason: "20262027", thruseason: "20262027", stype: "2", sit: "all", score: "all",
    stdoi: group === "individual" ? "std" : "oi", rate: "n", team: "ALL", pos: "S", loc: "B", toi: "0",
    gpfilt: "gpdate", fd: date, td: date, lines: "single", draftteam: "ALL" };
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return url.toString();
}

/** New private output directory (0700); files created exclusively (0600) and fsynced. */
export function createOutput(dir) {
  mkdirSync(dir, { mode: 0o700 }); // existing path (incl. symlink) fails
  const files = [];
  const write = (name, bytes) => {
    need(/^[A-Za-z0-9._-]+$/.test(name) && name !== "." && name !== "..", "output_name_invalid");
    const fd = openSync(join(dir, name), "wx", 0o600);
    try { let off = 0; while (off < bytes.length) off += writeSync(fd, bytes, off); fsyncSync(fd); } finally { closeSync(fd); }
    files.push({ file: name, bytes: bytes.length, sha256: sha(bytes) });
    return sha(bytes);
  };
  /** Completion marker last: temp + fsync + hard link (never overwrites). */
  const complete = (status, extra = {}) => {
    const manifest = encode({ status, ...extra, files: [...files] });
    write(".MANIFEST.json.tmp", manifest); files.pop();
    linkSync(join(dir, ".MANIFEST.json.tmp"), join(dir, "MANIFEST.json"));
    unlinkSync(join(dir, ".MANIFEST.json.tmp"));
    const dfd = openSync(dir, "r"); try { fsyncSync(dfd); } finally { closeSync(dfd); }
    return sha(manifest);
  };
  return { write, writeJson: (name, value) => write(name, encode(value)), complete, files };
}
