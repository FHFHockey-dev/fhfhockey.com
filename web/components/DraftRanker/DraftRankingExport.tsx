import { useState } from "react";

import supabase from "lib/supabase/client";

import styles from "./DraftRanker.module.scss";

type ExportFormat = "csv" | "json";

export default function DraftRankingExport({
  rankingId,
}: {
  rankingId: string;
}) {
  const [includeCandidates, setIncludeCandidates] = useState(false);
  const [includeWatchlist, setIncludeWatchlist] = useState(false);
  const [includeEventSummary, setIncludeEventSummary] = useState(false);
  const [pendingFormat, setPendingFormat] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(format: ExportFormat) {
    setPendingFormat(format);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Sign in again to export your board.");
      const query = new URLSearchParams({
        rankingId,
        format,
        includeCandidates: String(includeCandidates),
        includeWatchlist: String(includeWatchlist),
        includeEventSummary: String(includeEventSummary),
      });
      const response = await fetch(`/api/v1/draft-ranker/export?${query}`, {
        headers: {
          Accept: format === "csv" ? "text/csv" : "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message ?? "The export failed.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filename =
        disposition.match(/filename="([^"]+)"/u)?.[1] ??
        `fhfh-draft-rankings.${format}`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "The export failed.",
      );
    } finally {
      setPendingFormat(null);
    }
  }

  return (
    <section
      className={styles.exportCard}
      aria-labelledby="ranking-export-title"
    >
      <div>
        <p className={styles.eyebrow}>Portable and private</p>
        <h2 id="ranking-export-title">Export my rankings</h2>
        <p>
          CSV and versioned JSON include stable player IDs and evidence labels.
          Private pairwise responses are excluded.
        </p>
      </div>
      <fieldset>
        <legend>Optional data</legend>
        <label>
          <input
            type="checkbox"
            checked={includeCandidates}
            onChange={(event) => setIncludeCandidates(event.target.checked)}
          />
          Candidates after No. 250
        </label>
        <label>
          <input
            type="checkbox"
            checked={includeWatchlist}
            onChange={(event) => setIncludeWatchlist(event.target.checked)}
          />
          Watchlist
        </label>
        <label>
          <input
            type="checkbox"
            checked={includeEventSummary}
            onChange={(event) => setIncludeEventSummary(event.target.checked)}
          />
          Rank-event summary
        </label>
      </fieldset>
      <div className={styles.exportActions}>
        <button
          type="button"
          disabled={pendingFormat != null}
          onClick={() => download("csv")}
        >
          {pendingFormat === "csv" ? "Preparing CSV…" : "Download CSV"}
        </button>
        <button
          type="button"
          disabled={pendingFormat != null}
          onClick={() => download("json")}
        >
          {pendingFormat === "json" ? "Preparing JSON…" : "Download JSON"}
        </button>
      </div>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
