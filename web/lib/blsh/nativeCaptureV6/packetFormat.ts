/** Original native-v6 wire format shared by the offline ledger reader and hosted context selector. */
export const NATIVE_PACKET_FILES = [
  "STARTED.json", "PLAN.json", "RUNTIME.json", "operation-1-STARTED.json", "operation-1-SETTLED.json",
  "schedule.raw.json", "schedule.TRANSPORT-OBSERVATION.json", "operation-2-STARTED.json", "operation-2-SETTLED.json",
  "operation-3-STARTED.json", "operation-3-SETTLED.json", "individual.parser-input.html", "individual.TRANSPORT-OBSERVATION.json",
  "operation-4-STARTED.json", "operation-4-SETTLED.json", "operation-5-STARTED.json", "operation-5-SETTLED.json",
  "onIce.parser-input.html", "onIce.TRANSPORT-OBSERVATION.json", "MANIFEST.json",
];
export function need(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}
export function object(value: unknown): Record<string, unknown> {
  need(value !== null && typeof value === "object" && !Array.isArray(value), "invalid_json_object");
  return value as Record<string, unknown>;
}
export function matches(value: unknown, pattern: RegExp): value is string {
  return typeof value === "string" && pattern.test(value);
}
export function timestamp(value: unknown) {
  // Writer uses ISO milliseconds. PostgreSQL UTC JSON can carry six fractional digits.
  need(matches(value, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|\+00:00)$/), "invalid_utc_time");
  const ms = Date.parse(value);
  need(Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 19) === value.slice(0, 19), "invalid_utc_time");
  const micros = ms * 1000 + Number((value.match(/\.(\d{1,6})/)?.[1] ?? "").padEnd(6, "0").slice(3));
  need(Number.isSafeInteger(micros), "invalid_utc_time");
  return micros;
}
export function parseJSON(bytes: Uint8Array): unknown {
  const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  const value: unknown = JSON.parse(text);
  // JSON.parse silently collapses duplicate object members, including escaped names.
  // Scan only structural tokens in the known-valid JSON, ignoring quoted punctuation.
  const scopes: (Set<string> | null)[] = [];
  for (const token of text.matchAll(/"(?:\\.|[^"\\])*"\s*:|"(?:\\.|[^"\\])*"|[{}\[\]]/g)) {
    const part = token[0];
    if (part === "{" || part === "[") scopes.push(part === "{" ? new Set<string>() : null);
    else if (part === "}" || part === "]") scopes.pop();
    else if (part.endsWith(":")) {
      const name = JSON.parse(part.slice(0, -1)) as string;
      const names = scopes.at(-1);
      need(names && !names.has(name), "duplicate_json_member");
      names.add(name);
    }
  }
  return value;
}

export function validateNativeManifest(manifest: Record<string, unknown>, runId: string, sourceDate: string,
  rows: readonly { bytes?: unknown; sha256?: unknown }[]) {
  need(manifest.state === "packet_complete_pending_review" && manifest.runId === runId && manifest.sourceDate === sourceDate && manifest.lifecycleMode === "disabled"
    && manifest.operationCount === 5 && JSON.stringify(manifest.retained) === JSON.stringify(["individual", "onIce"]) && manifest.independentlyAccepted === false
    && manifest.advancedAdmission === false && manifest.score === null, "manifest_identity_or_state_mismatch");
  need(Array.isArray(manifest.files) && manifest.files.length === rows.length - 1, "manifest_file_count_mismatch");
  for (const [i, entry] of manifest.files.entries()) {
    const item = object(entry);
    need(item.file === NATIVE_PACKET_FILES[i] && item.bytes === rows[i].bytes && item.sha256 === rows[i].sha256, "manifest_file_mismatch");
  }
}

export function nativeObjectLimit(file: string) {
  return file === "schedule.raw.json" ? 1024 * 1024 : file.endsWith(".html") ? 2 * 1024 * 1024 : 64 * 1024;
}
