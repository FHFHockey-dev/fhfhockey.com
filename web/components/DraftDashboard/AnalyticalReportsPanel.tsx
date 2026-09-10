import type {
  DraftProReport,
  DraftProReportType,
  ReportInput,
} from "lib/draft-pro/reports";
import { useDraftProReports } from "hooks/useDraftProReports";
import { scenarioFingerprint } from "lib/draft-pro/scenarios";
import { useState } from "react";
import styles from "./AnalyticalReportsPanel.module.scss";

export type AnalyticalReportsPanelProps = Readonly<{
  eligible: boolean;
  input: ReportInput | null;
  snapshot?: unknown;
  draftId?: string | null;
  privateImportDraftId?: string | null;
  scenarioId?: string | null;
}>;
export function AnalyticalReportsPanel({
  eligible,
  input,
  snapshot,
  draftId,
  privateImportDraftId,
  scenarioId,
}: AnalyticalReportsPanelProps) {
  const [printError, setPrintError] = useState<string | null>(null);
  const reports = useDraftProReports(
    eligible,
    input ? scenarioFingerprint(input) : null,
  );
  const generate = (type: DraftProReportType) => {
    if (input)
      void reports.generate(input, type, {
        draftId,
        privateImportDraftId,
        scenarioId,
        snapshot,
      });
  };
  return (
    <section className={styles.panel} aria-label="Analytical reports">
      <div className={styles.header}>
        <div>
          <h2>Analytical reports</h2>
          <p>
            Deterministic roster totals, category context, schedule conflicts,
            and source freshness.
          </p>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            disabled={!eligible || !input || reports.status === "loading"}
            onClick={() =>
              generate(scenarioId ? "scenario_comparison" : "draft_summary")
            }
          >
            {reports.status === "loading" ? "Building…" : "Generate report"}
          </button>
          {eligible && reports.report ? (
            <button type="button" onClick={() => setPrintError(printReport(reports.report!) ? null : "Allow pop-ups to print this report.")}>
              Print report
            </button>
          ) : null}
        </div>
      </div>
      {!eligible ? (
        <p role="status">
          Draft Pro is inactive. Saved report names remain visible, but report
          contents are locked.
        </p>
      ) : !input ? (
        <p role="status">
          Complete a draft or open a saved draft to generate a report.
        </p>
      ) : null}
      {reports.error ? (
        <p role="alert">
          {reports.error}{" "}
          <button type="button" onClick={() => void reports.retry()}>
            Retry failed action
          </button>
        </p>
      ) : null}
      {printError ? <p role="alert">{printError}</p> : null}
      {eligible && reports.report ? (
        <ReportContent report={reports.report} />
      ) : null}
      <div className={styles.saved}>
        <h3>Saved reports</h3>
        {reports.listError ? (
          <p role="alert">
            {reports.listError}{" "}
            <button type="button" onClick={() => void reports.list()}>
              Retry list
            </button>
          </p>
        ) : reports.saved.length ? (
          <ul>
            {reports.saved.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={!eligible}
                  onClick={() => void reports.open(item.id)}
                >
                  {item.report_type.replaceAll("_", " ")}
                </button>
                <time dateTime={item.created_at}>
                  {new Date(item.created_at).toLocaleString()}
                </time>
                {!eligible ? <span>Locked</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>No saved reports yet.</p>
        )}
      </div>
    </section>
  );
}
function ReportContent({ report }: { report: DraftProReport }) {
  return (
    <article className={styles.report} aria-label="Report contents">
      <p className={styles.meta}>
        {report.reportType.replaceAll("_", " ")} · Season {report.season} ·{" "}
        {report.roster.count} players · Updated{" "}
        {new Date(report.createdAt).toLocaleString()}
      </p>
      <div className={styles.grid}>
        <section>
          <h3>Roster composition</h3>
          <ul>
            {report.roster.players.map((player) => (
              <li key={player.id}>
                {player.name} · {player.role} · {player.positions.join(", ")} ·{" "}
                {player.team ?? "Team unavailable"}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3>Totals</h3>
          <dl>
            <div>
              <dt>Raw VORP</dt>
              <dd>{report.totals.rawVorp.toFixed(1)}</dd>
            </div>
            <div>
              <dt>Projected points</dt>
              <dd>
                {report.totals.projectedPoints === null
                  ? "Unavailable"
                  : report.totals.projectedPoints.toFixed(1)}
              </dd>
            </div>
            {Object.entries(report.totals.categories).map(([key, value]) => (
              <div key={key}>
                <dt>{key.replaceAll("_", " ")}</dt>
                <dd>{value === null ? "Unavailable" : value.toFixed(3)}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <h3>Strengths and weaknesses</h3>
          <h4>Strengths</h4>
          <ul>
            {report.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h4>Weaknesses</h4>
          <ul>
            {report.weaknesses.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p>
            Comparison basis:{" "}
            {report.comparisonBasis ??
              "unavailable because no actual comparison roster was provided"}
            .
          </p>
        </section>
        <section>
          <h3>Schedule</h3>
          <p>{report.schedule.state.replaceAll("_", " ")}</p>
          <p>
            Window: {report.schedule.window ? `weeks ${report.schedule.window.startWeek ?? "?"}–${report.schedule.window.endWeek ?? "?"}${report.schedule.window.startDate ? ` (${report.schedule.window.startDate}–${report.schedule.window.endDate ?? "?"})` : ""}` : "Unavailable"}. Schedule data: {report.provenance.freshness.latestFetchedAt ?? "Unavailable"}
          </p>
          {report.schedule.conflicts.length ? (
            <ul>
              {report.schedule.conflicts.map((conflict) => (
                <li key={`${conflict.date}-${conflict.teams.join(",")}`}>
                  {conflict.date}: {conflict.games} bench conflicts
                </li>
              ))}
            </ul>
          ) : report.schedule.state === "ready" ? <p>Zero lineup conflicts.</p> : <p>Schedule conflicts unavailable.</p>}
        </section>
        <section><h3>Scoring and sources</h3><dl>{readableEntries(report.provenance.scoring).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}{readableEntries(report.provenance.sourceWeights).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></section>
      </div>
      <p className={styles.provenance}>
        Projection {report.provenance.projectionId} /{" "}
        {report.provenance.projectionVersion} (
        {report.provenance.projectionOrigin}); source season{" "}
        {report.provenance.season}; scoring{" "}
        {JSON.stringify(report.provenance.scoring)}; source weights{" "}
        {JSON.stringify(report.provenance.sourceWeights)}.
      </p>
    </article>
  );
}
const html = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] ?? character,
  );
const readableEntries = (value: unknown, prefix = ""): [string, string][] => value && typeof value === "object" && !Array.isArray(value) ? Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).flatMap(([key, entry]) => readableEntries(entry, prefix ? `${prefix} / ${key}` : key.replaceAll("_", " "))) : [[prefix, String(value)]];
export function reportPrintMarkup(report: DraftProReport) {
  const rows = (items: readonly [string, string][]) => `<table><tbody>${items.map(([key, value]) => `<tr><th>${html(key)}</th><td>${html(value)}</td></tr>`).join("")}</tbody></table>`;
  const window = report.schedule.window ? `Weeks ${report.schedule.window.startWeek ?? "?"}–${report.schedule.window.endWeek ?? "?"}; ${report.schedule.window.startDate ?? "date unavailable"}–${report.schedule.window.endDate ?? "date unavailable"}` : "Unavailable";
  const conflicts = report.schedule.conflicts.length ? `<ul>${report.schedule.conflicts.map((item) => `<li>${html(item.date)}: ${item.games} bench conflicts</li>`).join("")}</ul>` : report.schedule.state === "ready" ? "<p>Zero lineup conflicts.</p>" : "<p>Schedule conflicts unavailable.</p>";
  return `<!doctype html><html><head><title>Draft Pro report</title><style>body{font:14px system-ui;color:#111;background:#fff;margin:28px}h1,h2{color:#12365a}section{break-inside:avoid;margin:18px 0}ul{padding-left:20px}table{border-collapse:collapse;width:100%}td,th{padding:6px;border-bottom:1px solid #bbb;text-align:left}</style></head><body><h1>Draft Pro analytical report</h1><p>${html(report.reportType.replaceAll("_", " "))} · Season ${html(report.season)} · ${report.roster.count} players</p><section><h2>Roster composition</h2><ul>${report.roster.players.map((player) => `<li>${html(player.name)} · ${html(player.positions.join(", "))} · ${html(player.team ?? "Team unavailable")}</li>`).join("")}</ul></section><section><h2>Totals</h2><table><tbody><tr><th>Raw VORP</th><td>${report.totals.rawVorp.toFixed(1)}</td></tr><tr><th>Projected points</th><td>${report.totals.projectedPoints?.toFixed(1) ?? "Unavailable"}</td></tr>${Object.entries(
    report.totals.categories,
  )
    .map(
      ([key, value]) =>
        `<tr><th>${html(key.replaceAll("_", " "))}</th><td>${value?.toFixed(3) ?? "Unavailable"}</td></tr>`,
    )
    .join(
      "",
    )}</tbody></table></section><section><h2>Strengths</h2><p>Comparison basis: ${html(report.comparisonBasis ?? "Unavailable")}</p><ul>${report.strengths.map((item) => `<li>${html(item)}</li>`).join("")}</ul><h2>Weaknesses</h2><ul>${report.weaknesses.map((item) => `<li>${html(item)}</li>`).join("")}</ul></section><section><h2>Schedule</h2><p>${html(report.schedule.state)} · Window ${html(window)} · Schedule data ${html(report.provenance.freshness.latestFetchedAt ?? "Unavailable")}</p>${conflicts}</section><section><h2>Scoring and source weights</h2>${rows([...readableEntries(report.provenance.scoring), ...readableEntries(report.provenance.sourceWeights)])}</section><section><h2>Provenance</h2><p>${html(report.provenance.projectionId)} / ${html(report.provenance.projectionVersion)}</p></section></body></html>`;
}
export function printReport(report: DraftProReport) {
  const target = window.open("about:blank", "_blank");
  if (!target) return false;
  target.opener = null;
  target.document.open();
  target.document.write(reportPrintMarkup(report));
  target.document.close();
  target.focus();
  target.print();
  return true;
}
