import { createHash } from "node:crypto";

type Page<T> = { data: T[] | null; error: { message: string } | null; count: number | null };

// Stay within the observed REST row cap while reducing repeated count/sort
// queries. Both passes retain their existing shared deadline and page bound.
export const REPORT_PAGE_SIZE = 1000;

export type ReportSource<T> = {
  rows: T[];
  complete: boolean;
  enumerationComplete: boolean;
  snapshotConsistent: false;
  consistency: string;
  verificationPages: number;
  expectedCount: number | null;
  pages: number;
  duplicateRows: number;
  error: string | null;
};

// Audit has no primary key. Canonical full-row identities preserve timestamp
// ties. Indistinguishable duplicates fail closed rather than claiming a stable ID.
function canonicalRow(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalRow).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalRow(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function reportRowIdentity(value: unknown): string {
  return createHash("sha256").update(canonicalRow(value)).digest("hex");
}

export async function readReportSource<T>(
  fetchPage: (from: number, to: number, signal: AbortSignal) => PromiseLike<Page<T>>,
  identity?: (row: T) => string,
  pageSize = 500,
  maxPages = 40,
  maxMs = 15_000,
  options: { deadlineAt?: number; requestTimeoutMs?: number } = {},
): Promise<ReportSource<T>> {
  const result: ReportSource<T> = {
    rows: [], complete: false, enumerationComplete: false, snapshotConsistent: false,
    consistency: "Separate REST reads of mutable history; matching counts and row images do not establish a transactional snapshot.",
    pages: 0, verificationPages: 0, expectedCount: null, duplicateRows: 0, error: null,
  };
  const fingerprints: string[] = [];
  // An absolute deadline lets sequential sources share one handler budget.
  const deadline = Math.min(Date.now() + maxMs, options.deadlineAt ?? Infinity);
  const requestTimeoutMs = options.requestTimeoutMs ?? 5_000;
  const deadlineError = "Source query deadline exceeded; totals unknown";
  // Read and then compare all row images under the same total page/time budget.
  // This detects observed mutations, including updates with unchanged counts.
  // It cannot prove that another mutation did not occur between/after requests.
  for (const verifying of [false, true]) {
    let offset = 0;
    const seen = new Set<string>();
    while (result.pages + result.verificationPages < maxPages) {
      let page: Page<T> = { data: null, count: null, error: { message: "Source query failed" } };
      for (let attempt = 0; attempt < 2; attempt++) {
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) { result.error = deadlineError; return result; }
        const controller = new AbortController();
        let rejectAborted!: (error: Error) => void;
        const aborted = new Promise<never>((_resolve, reject) => { rejectAborted = reject; });
        const onAbort = () => rejectAborted(new Error(Date.now() >= deadline ? deadlineError : "Source request timed out"));
        controller.signal.addEventListener("abort", onAbort, { once: true });
        const timer = setTimeout(() => controller.abort(), Math.min(requestTimeoutMs, remainingMs));
        try {
          page = await Promise.race([fetchPage(offset, offset + pageSize - 1, controller.signal), aborted]);
        } catch (error) {
          page = { data: null, count: null, error: { message: error instanceof Error ? error.message : String(error) } };
        } finally {
          clearTimeout(timer);
          controller.signal.removeEventListener("abort", onAbort);
        }
        if (!page.error || Date.now() >= deadline) break;
      }
      if (page.error) { result.error = Date.now() >= deadline ? deadlineError : page.error.message; return result; }
      if (verifying) result.verificationPages++;
      else result.pages++;
      if (!Array.isArray(page.data)) { result.error = "Source returned no row payload; completeness is unknown"; return result; }
      const changedCount = result.expectedCount != null && result.expectedCount !== page.count;
      result.expectedCount ??= page.count;
      for (const [index, row] of page.data.entries()) {
        const fingerprint = reportRowIdentity(row);
        if (identity) {
          const key = identity(row);
          if (seen.has(key)) {
            result.duplicateRows++;
            result.error = "Repeated source identity; overlapping pages or indistinguishable audit rows make completeness unknown";
            continue;
          }
          seen.add(key);
        }
        if (verifying) {
          if (fingerprints[offset + index] !== fingerprint) result.error = "Source rows changed during verification; original observations retained, totals unknown";
        } else {
          fingerprints.push(fingerprint);
          result.rows.push(row);
        }
      }
      offset += page.data.length;
      if (Date.now() >= deadline) { result.error = deadlineError; return result; }
      if (page.count == null || !Number.isSafeInteger(page.count) || page.count < 0) {
        result.error = "Exact source count unavailable; completeness is unknown";
        return result;
      }
      if (changedCount) result.error = "Source count changed during reading; concurrent arrivals or retention detected";
      if (result.error) return result;
      if (offset === page.count) {
        if (verifying) { result.complete = true; return result; }
        result.enumerationComplete = true;
        break;
      }
      if (page.data.length === 0 || offset > page.count) {
        result.error = "Source ended before its exact count was read";
        return result;
      }
    }
    if (result.pages + result.verificationPages >= maxPages) break;
  }
  result.error = "Source page budget exceeded before enumeration and verification completed; only observations are available";
  return result;
}

export function formatReportTime(iso: string): string {
  return `${iso} / ${new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", timeZoneName: "short" })}`;
}
