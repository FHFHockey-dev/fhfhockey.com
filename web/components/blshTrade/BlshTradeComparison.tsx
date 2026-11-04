/**
 * Decision 4 trade comparison: FORGE forecasts under the manager's league scoring, with each player's
 * retrospective Buy Low / Sell High evidence beside (never inside) the forecast. The core BLSH lists
 * do not import this view. Forecast numbers are labelled as forecasts; unavailable ones are withheld, not zero.
 */
import React, { useMemo, useState } from "react";

import type { DisplayProfile } from "lib/buyLowSellHigh/displayProfile";
import { compareTrade, FHFH_STANDARD_SCORING, forecastQualification, playerScoredValues, type ForecastQualification, type TradeScoring } from "lib/buyLowSellHigh/trade";
import { DEFAULT_HORIZON, GOALIE_TARGETS, HORIZON_OPTIONS, SKATER_TARGETS, TARGET_LABELS, type HorizonGames, type InterpretationRecord } from "lib/skoElement/contract";
import { retrospectiveComparison, retrospectivePlayer } from "./retrospective";
import styles from "./BlshTrade.module.scss";

type ScoringMode = "fhfh" | "points" | "categories";
type Side = "give" | "receive";
const WEIGHT_TARGETS = [...SKATER_TARGETS, ...GOALIE_TARGETS.filter(target => target !== "SHOTS_AGAINST_GOALIE" && target !== "GOALIE_MINUTES")];
const CATEGORY_LABELS: Record<string, string> = { ...TARGET_LABELS, SAVE_PERCENTAGE: "SV%", GOALS_AGAINST_AVERAGE: "GAA" };
const CATEGORY_OPTIONS = [...SKATER_TARGETS, "WINS_GOALIE", "SAVES_GOALIE", "SHUTOUTS_GOALIE", "GOALS_AGAINST_AVERAGE", "SAVE_PERCENTAGE"];
const DEFAULT_CATEGORIES = ["GOALS", "ASSISTS", "PP_POINTS", "SHOTS_ON_GOAL", "HITS", "BLOCKED_SHOTS"];
const QUALIFICATION_TEXT: Record<ForecastQualification["status"], string> = {
  qualified: "Qualified forecast", experimental: "Experimental forecast", unavailable: "Forecast unavailable",
};
const SIDE_TEXT: Record<Side, string> = { give: "You give", receive: "You receive" };

const digitsFor = (key: string) => (key === "SAVE_PERCENTAGE" ? 3 : key === "GOALS_AGAINST_AVERAGE" ? 2 : 1);
const fixed = (value: number, digits: number, signed = false) => `${signed && value > 0 ? "+" : ""}${value.toFixed(digits)}`;
const reasonLabel = (reason: string | null) => (reason ?? "unavailable").replace(/_/g, " ");

export type BlshTradeComparisonProps = {
  /** Interpretation records per horizon; FORGE totals inside them are passed through unchanged. */
  recordsByHorizon: Record<HorizonGames, InterpretationRecord[]>;
  /** BLSH display profiles keyed by the record player id. */
  evidence: Readonly<Record<string, DisplayProfile | undefined>>;
  /** Shown above everything when the data is synthetic. */
  fixtureBanner?: string | null;
  initialGive?: string[];
  initialReceive?: string[];
};

export default function BlshTradeComparison({ recordsByHorizon, evidence, fixtureBanner = null, initialGive = [], initialReceive = [] }: BlshTradeComparisonProps) {
  const [horizon, setHorizon] = useState<HorizonGames>(DEFAULT_HORIZON);
  const [mode, setMode] = useState<ScoringMode>("fhfh");
  const [weights, setWeights] = useState<Record<string, number>>({ ...FHFH_STANDARD_SCORING.weights });
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [sides, setSides] = useState<Record<Side, string[]>>({ give: initialGive, receive: initialReceive });
  const [showRetrospective, setShowRetrospective] = useState(false);

  const records = recordsByHorizon[horizon];
  const byId = useMemo(() => new Map(records.map(record => [record.identity.playerId, record])), [records]);
  const scoring = useMemo((): TradeScoring => (mode === "fhfh" ? FHFH_STANDARD_SCORING
    : mode === "points" ? { mode: "points", scoringBasis: "points:custom", weights }
      : { mode: "categories", categories: CATEGORY_OPTIONS.filter(key => categories.includes(key)) }), [mode, weights, categories]);
  const comparison = useMemo(() => compareTrade({ give: sides.give, receive: sides.receive, scoring }, records), [sides, scoring, records]);
  const retrospective = useMemo(() => retrospectiveComparison(sides.give, sides.receive, scoring, evidence), [sides, scoring, evidence]);
  const chosen = new Set([...sides.give, ...sides.receive]);
  const blockedByForecast = comparison.players.some(player => player.qualification.status === "unavailable")
    || comparison.issues.some(issue => issue.code === "missing_projection" || issue.code === "unknown_player");
  const offerRetrospective = !comparison.complete && blockedByForecast && sides.give.length > 0 && sides.receive.length > 0;

  const update = (side: Side, ids: string[]) => { setSides(current => ({ ...current, [side]: ids })); setShowRetrospective(false); };

  return (
    <div className={styles.container}>
      <header>
        <h1 className={styles.title}>Trade comparison</h1>
        <p className={styles.subtitle}>
          A forecast view, separate from the Buy Low / Sell High lists. Forecast numbers come from FORGE; Buy Low / Sell High evidence is recorded history shown beside them.
        </p>
      </header>
      {fixtureBanner && <p className={styles.fixtureBanner} role="note">{fixtureBanner}</p>}

      <section className={styles.controls} aria-label="Comparison settings">
        <fieldset className={styles.fieldset}>
          <legend>Forecast horizon</legend>
          <div className={styles.segmented}>
            {HORIZON_OPTIONS.map(option => (
              <button key={option} type="button" className={styles.segment} aria-pressed={horizon === option} onClick={() => { setHorizon(option); setShowRetrospective(false); }}>
                Next {option} team games{option === DEFAULT_HORIZON ? " (default)" : ""}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className={styles.fieldset}>
          <legend>League scoring</legend>
          <div className={styles.segmented}>
            {([["fhfh", "FHFH Standard (default)"], ["points", "Points weights"], ["categories", "Categories"]] as const).map(([value, label]) => (
              <button key={value} type="button" className={styles.segment} aria-pressed={mode === value} onClick={() => { setMode(value); setShowRetrospective(false); }}>{label}</button>
            ))}
          </div>
          {mode === "fhfh" && <p className={styles.muted}>3 per goal, 2 per assist, 1 per PP point, 0.2 per shot, 0.2 per hit, 0.25 per block. Skaters only.</p>}
          {mode === "points" && (
            <div className={styles.weightGrid}>
              {WEIGHT_TARGETS.map(target => (
                <label key={target} className={styles.control}>
                  {TARGET_LABELS[target]}
                  <input type="number" step="0.05" inputMode="decimal" value={weights[target] ?? 0}
                    onChange={event => { const value = Number(event.target.value); setWeights(current => ({ ...current, [target]: Number.isFinite(value) ? value : 0 })); }} />
                </label>
              ))}
            </div>
          )}
          {mode === "categories" && (
            <div className={styles.categoryGrid}>
              {CATEGORY_OPTIONS.map(key => (
                <label key={key} className={styles.check}>
                  <input type="checkbox" checked={categories.includes(key)}
                    onChange={event => setCategories(current => (event.target.checked ? [...current, key] : current.filter(item => item !== key)))} />
                  {CATEGORY_LABELS[key]}
                </label>
              ))}
            </div>
          )}
        </fieldset>
      </section>

      <div className={styles.sides}>
        {(["give", "receive"] as const).map(side => (
          <section key={side} className={styles.side} aria-labelledby={`${side}-heading`}>
            <div className={styles.sideHeader}>
              <h2 id={`${side}-heading`} className={styles.sideTitle}>{SIDE_TEXT[side]}</h2>
              <label className={styles.control}>
                <span className={styles.srOnly}>Add a player you {side === "give" ? "give" : "receive"}</span>
                <select value="" onChange={event => event.target.value && update(side, [...sides[side], event.target.value])}>
                  <option value="">Add a player…</option>
                  {records.filter(record => !chosen.has(record.identity.playerId)).map(record => (
                    <option key={record.identity.playerId} value={record.identity.playerId}>
                      {record.identity.name} ({record.identity.team ?? "team unknown"}, {record.identity.modelClass})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {!sides[side].length && <p className={styles.muted}>No players yet.</p>}
            {sides[side].map(id => (
              <PlayerCard key={id} playerId={id} record={byId.get(id)} profile={evidence[id]} scoring={scoring} horizon={horizon}
                onRemove={() => update(side, sides[side].filter(item => item !== id))} />
            ))}
          </section>
        ))}
      </div>

      <section className={styles.result} aria-labelledby="forecast-result-heading">
        <div className={styles.resultHeader}>
          <h2 id="forecast-result-heading" className={styles.sectionTitle}>Forecast comparison: next {horizon} scheduled team games</h2>
          {comparison.experimental && <span className={`${styles.badge} ${styles.badgeExperimental}`}>Experimental forecast</span>}
        </div>
        {comparison.issues.length > 0 && (
          <ul className={styles.issues}>
            {comparison.issues.map(issue => (
              <li key={issue.code} className={issue.blocking ? styles.issueBlocking : styles.issueNote}>
                <strong>{issue.blocking ? "Blocks the comparison: " : "Note: "}</strong>{issue.message}
              </li>
            ))}
          </ul>
        )}
        {comparison.rows.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className={styles.caption}>Forecast totals over each player&apos;s next {horizon} scheduled team games. No uncertainty range: FORGE game expectations v1 do not supply one.</caption>
              <thead>
                <tr><th scope="col">Scored</th><th scope="col">You give (forecast)</th><th scope="col">You receive (forecast)</th><th scope="col">Receive − give</th></tr>
              </thead>
              <tbody>
                {comparison.rows.map(row => {
                  const digits = row.key === "FANTASY_POINTS" ? 1 : digitsFor(row.key);
                  const cell = (value: number | null, reason: string | null) => (value === null
                    ? <span className={styles.withheld}>{reason === "no_goalies" ? "No goalies" : `Withheld (${reasonLabel(reason)})`}</span>
                    : <span className={styles.num}>{fixed(value, digits)}</span>);
                  return (
                    <tr key={row.key}>
                      <th scope="row">{row.key === "FANTASY_POINTS" ? "League points" : row.label}{row.lowerIsBetter ? " (lower is better)" : ""}</th>
                      <td>{cell(comparison.complete ? row.give.value : null, comparison.complete ? row.give.reason : row.give.reason ?? "comparison_incomplete")}</td>
                      <td>{cell(comparison.complete ? row.receive.value : null, comparison.complete ? row.receive.reason : row.receive.reason ?? "comparison_incomplete")}</td>
                      <td>
                        {comparison.complete && row.net !== null
                          ? <><span className={styles.num}>{fixed(row.net, digits, true)}</span>{row.favorableForReceiver !== null && <span className={styles.muted}> {row.favorableForReceiver ? "favours receiving" : "favours giving"}</span>}</>
                          : <span className={styles.withheld}>Withheld</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className={styles.summary}>{comparison.summary}</p>
        <ul className={styles.assumptions} aria-label="Forecast assumptions">
          <li>Totals are FORGE expectations over each player&apos;s own next {horizon} scheduled team games; the dates can differ by team.</li>
          <li>Participation is already inside every total: each player&apos;s chance of playing comes from an uncalibrated FORGE participation model.</li>
          <li>No uncertainty range is supplied, so small differences should not be read as meaningful.</li>
          <li>Not roster-aware: no replacement players, roster slots or market value.</li>
        </ul>
        {offerRetrospective && !showRetrospective && (
          <button type="button" className={styles.secondaryButton} onClick={() => setShowRetrospective(true)}>
            Show a retrospective comparison instead (recorded games, not a forecast)
          </button>
        )}
        {offerRetrospective && showRetrospective && <RetrospectivePanel comparison={retrospective} />}
      </section>
    </div>
  );
}

function RetrospectivePanel({ comparison }: { comparison: ReturnType<typeof retrospectiveComparison> }) {
  return (
    <section className={styles.retrospective} aria-labelledby="retrospective-heading">
      <p className={styles.kickerRetro}>Retrospective · not a forecast</p>
      <h3 id="retrospective-heading" className={styles.sectionTitle}>Recorded FHFH Standard points per game</h3>
      <p className={styles.muted}>
        From each player&apos;s Buy Low / Sell High window of recorded games. It describes what already happened; windows cover different dates and lengths, and it says nothing about the next games.
      </p>
      {comparison.reason && <p className={styles.issueBlocking}>{comparison.reason}</p>}
      {comparison.available && (
        <dl className={styles.facts}>
          <div><dt>You give, recorded per game</dt><dd className={styles.num}>{fixed(comparison.give.value!, 2)}</dd></div>
          <div><dt>You receive, recorded per game</dt><dd className={styles.num}>{fixed(comparison.receive.value!, 2)}</dd></div>
          <div><dt>Receive − give, recorded per game</dt><dd className={styles.num}>{fixed(comparison.net!, 2, true)}</dd></div>
        </dl>
      )}
    </section>
  );
}

function PlayerCard({ playerId, record, profile, scoring, horizon, onRemove }: {
  playerId: string; record: InterpretationRecord | undefined; profile: DisplayProfile | undefined;
  scoring: TradeScoring; horizon: HorizonGames; onRemove: () => void;
}) {
  const name = record?.identity.name ?? profile?.displayName ?? playerId;
  const qualification: ForecastQualification = record ? forecastQualification(record) : { status: "unavailable", reasons: ["No forecast record for this player"] };
  return (
    <article className={styles.card} aria-label={name}>
      <div className={styles.cardHeader}>
        <div>
          <h3 className={styles.playerName}>{name}</h3>
          <p className={styles.muted}>{record ? `${record.identity.team ?? "Team unknown"} · ${record.identity.eligibility.join("/") || record.identity.modelClass}` : "No forecast record"}</p>
        </div>
        <button type="button" className={styles.smallButton} onClick={onRemove} aria-label={`Remove ${name}`}>Remove</button>
      </div>

      <section className={styles.forecast} aria-label={`Forecast for ${name}`}>
        <div className={styles.blockHeader}>
          <p className={styles.kicker}>Forecast · next {horizon} team games</p>
          <span className={`${styles.badge} ${styles[`badge_${qualification.status}`]}`}>{QUALIFICATION_TEXT[qualification.status]}</span>
        </div>
        {qualification.reasons.length > 0 && <p className={styles.muted}>{qualification.reasons.join(". ")}.</p>}
        {record && qualification.status !== "unavailable" ? (
          <dl className={styles.facts}>
            {playerScoredValues(record, scoring).map(item => (
              <div key={item.key}>
                <dt>{item.label}</dt>
                <dd>{!item.applies ? <span className={styles.muted}>Not applicable</span>
                  : item.value === null ? <span className={styles.withheld}>Withheld ({reasonLabel(item.reason)})</span>
                    : <span className={styles.num}>{fixed(item.value, item.key === "FANTASY_POINTS" ? 1 : digitsFor(item.key))}</span>}</dd>
              </div>
            ))}
            <div><dt>Games covered</dt><dd>{record.horizon.scheduledGames} scheduled, {record.horizon.startDate ?? "?"} to {record.horizon.endDate ?? "?"}</dd></div>
            <div>
              <dt>Participation assumed</dt>
              <dd>{record.horizon.expectedAppearances === null ? "Unknown" : <><span className={styles.num}>{record.horizon.expectedAppearances.toFixed(1)}</span> expected {record.identity.modelClass === "G" ? "appearances" : "games played"}</>}
                {record.identity.modelClass === "G" && record.horizon.expectedStarts !== null && <>, <span className={styles.num}>{record.horizon.expectedStarts.toFixed(1)}</span> starts</>} (uncalibrated)</dd>
            </div>
            <div><dt>Uncertainty</dt><dd>Not supplied by FORGE v1; no range shown</dd></div>
          </dl>
        ) : <p className={styles.withheldBlock}>No forecast number is shown for this player.</p>}
      </section>

      <EvidenceBlock name={name} playerId={playerId} profile={profile} goalie={record?.identity.modelClass === "G"} />
    </article>
  );
}

function EvidenceBlock({ name, playerId, profile, goalie }: { name: string; playerId: string; profile: DisplayProfile | undefined; goalie: boolean }) {
  const recorded = retrospectivePlayer(playerId, profile);
  return (
    <section className={styles.evidence} aria-label={`Buy Low / Sell High evidence for ${name}`}>
      <p className={styles.kickerRetro}>Buy Low / Sell High · recorded games, not a forecast</p>
      {!profile ? <p className={styles.muted}>{goalie ? "Buy Low / Sell High covers skaters only; no evidence for goalies." : "No Buy Low / Sell High evidence for this player."}</p> : (
        <>
          <p className={styles.evidenceLead}>
            <strong>{profile.score.gapSignLabel ?? profile.score.statusLabel}</strong>
            {profile.score.value !== null && <> · index <span className={styles.num}>{fixed(profile.score.value, 0, true)}</span></>}
            {" · "}{profile.score.list ? `${profile.score.listLabel} #${profile.score.rank}` : profile.score.listLabel}
          </p>
          {profile.score.reasonText && <p className={styles.muted}>{profile.score.reasonText}</p>}
          {recorded.recordedPerGame !== null && recorded.referencePerGame !== null && (
            <dl className={styles.facts}>
              <div><dt>Recorded FHFH points per game</dt><dd className={styles.num}>{recorded.recordedPerGame.toFixed(2)}</dd></div>
              <div><dt>Reference at current ice time</dt><dd className={styles.num}>{recorded.referencePerGame.toFixed(2)}</dd></div>
            </dl>
          )}
          <p className={styles.muted}>{profile.evidence.window.games} recorded games. {profile.evidence.window.freshnessText}. {profile.evidence.tierLabel} ({profile.evidence.tierNote.toLowerCase()}).</p>
          <p className={styles.muted}>{profile.claimsText}</p>
        </>
      )}
    </section>
  );
}
