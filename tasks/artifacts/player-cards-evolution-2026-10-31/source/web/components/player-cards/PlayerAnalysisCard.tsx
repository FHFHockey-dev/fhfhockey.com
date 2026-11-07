import React from "react";
import PlayerHeroHeader from "./PlayerHeroHeader";
import type { PreparedHero } from "./HeroPlayerCard";
import { ANALYSIS_FIELDS, analysisDifference, type AnalysisMetric, type AnalysisSnapshot } from "../../lib/player-cards/analysisSnapshot";
import type { CardEvidence, TradeContext } from "../../lib/player-cards/analysisEvidence";
import type { GoalieOutlook } from "../../lib/player-cards/goalieOutlook";
import { currentArtworkKey, reviewedHeroFor } from "../../lib/player-cards/currentArtwork";
import { compositionKey, portraitKey } from "../../lib/player-cards/portraitTreatment";
import { outlineKey } from "../../lib/player-cards/alphaOutline";
import { outlineStackKey } from "../../lib/player-cards/outlineStack";

export type AnalysisPresentation = { snapshot: AnalysisSnapshot; view: "categories" | "comparison" | "evidence" | "trades"; blsh: CardEvidence; trades: TradeContext } | { goalie: GoalieOutlook; gameIndex: number };
export const analysisPresentationKey = (p: AnalysisPresentation, hero?: PreparedHero | null) => JSON.stringify([p, currentArtworkKey(hero)]);
const number = (v: number | null) => v === null ? "—" : Number.isInteger(v) ? String(v) : v.toFixed(2);
const categoryMetrics: AnalysisMetric[] = ["goals", "assists", "points", "ppPoints", "shots", "blocks", "hits", "bsh"];
function lines(text: string, max = 94): string[] {
  const result: string[] = []; let current = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const characters = Array.from(word);
    for (let start = 0; start < characters.length; start += max) {
      const piece = characters.slice(start, start + max).join("");
      if (current && Array.from(current).length + Array.from(piece).length + 1 > max) { result.push(current); current = ""; }
      current += `${current ? " " : ""}${piece}`;
    }
  }
  if (current) result.push(current); return result;
}
function TextLines({ text, y, maxLines = 12 }: { text: string; y: number; maxLines?: number }) {
  const wrapped = lines(text);
  return <text x="40" y={y} fontSize="21" fill="#30383d" data-evidence-max-width="1120" data-evidence-truncated={wrapped.length > maxLines ? "true" : undefined}>{wrapped.slice(0, maxLines).map((line, i) => <tspan key={i} x="40" dy={i ? 29 : 0}>{line}{i === maxLines - 1 && wrapped.length > maxLines ? " … (too long to export; narrow the evidence)" : ""}</tspan>)}</text>;
}
export default function PlayerAnalysisCard({ presentation: p, hero, svgRef }: { presentation: AnalysisPresentation; hero?: PreparedHero | null; svgRef?: React.Ref<SVGSVGElement> }) {
  const goalie = "goalie" in p, snapshot = "snapshot" in p ? p.snapshot : null;
  const player = goalie ? { ...p.goalie.player, position: "G" } : snapshot!.capture.player;
  if (hero) {
    const approved = reviewedHeroFor(player);
    if (!approved || Object.entries(approved).some(([key, value]) => hero[key as keyof typeof approved] !== value)) throw new Error("Artwork must match the selected player, team and reviewed source.");
  }
  const research = !goalie && p.view === "evidence" ? p.blsh.retained : undefined;
  const source = research ? "RETAINED BLSH · PROVISIONAL RESEARCH" : goalie ? p.goalie.state === "fixture" ? "SYNTHETIC GOALIE FIXTURE" : "GOALIE SOURCE UNAVAILABLE" : snapshot!.capture.source === "synthetic" ? "SYNTHETIC CONTRACT FIXTURE" : snapshot!.capture.source === "retained" ? "RETAINED CAPTURE · NOT CURRENT" : "OBSERVED CAPTURE";
  const title = goalie ? "Goalie outlook" : p.view === "categories" ? "Scoring & peripherals" : p.view === "comparison" ? `${snapshot!.recent.label} vs ${snapshot!.baseline.label}` : p.view === "evidence" ? "Supporting evidence" : "Trade context";
  const game = goalie ? p.goalie.games[p.gameIndex] : null;
  const confirmationWarnings = goalie ? p.goalie.sharedProvenance?.confirmationWarnings || [] : [];
  const warningLines = lines(confirmationWarnings.join(" "), 120);
  const warningsTooLong = warningLines.length > 2;
  const displayedWarnings = warningsTooLong ? ["Source warnings are too long for this card. Read the full details; PNG export is unavailable."] : warningLines;
  const explanation = research && "snapshot" in p ? `${p.blsh.heading}. ${p.blsh.lines.join(" ")}. Observed ${research.asOfUTC}; method ${research.methodVersion}. ${research.provenance?.message || ""} ${research.currentBoxes?.summary || ""}. ${research.currentBoxes?.lines.join(" ") || ""}` : goalie ? [game?.heading, game?.confirmation, game?.forecast, ...confirmationWarnings, ...(game?.dimensions.map(d => `${d.group}: ${d.label}: ${d.text}`) || []), p.goalie.reason].filter(Boolean).join(". ") : `${snapshot!.recent.label}, ${snapshot!.recent.gp} GP, ${snapshot!.settings.basis}, strength ${snapshot!.capture.strength}. ${snapshot!.recent.readings.map(r => `${ANALYSIS_FIELDS[r.metric].label}: ${number(r.value)} ${r.unit}${r.reason ? ` (${r.reason})` : ""}`).join(". ")}. ${snapshot!.disclosure} ${snapshot!.recent.sampleWarning || ""}`;
  const rows = snapshot ? categoryMetrics.map(m => snapshot.recent.readings.find(r => r.metric === m)!) : [];
  const maximum = Math.max(1, ...rows.map(r => r.value || 0));
  return <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" width="1200" height="1020" viewBox="0 0 1200 1020" role="img" aria-label={`${player.name}. ${source}. ${title}. ${explanation}`} data-analysis-key={analysisPresentationKey(p, hero)} data-portrait-key={hero ? portraitKey(hero) : undefined} data-pipeline-key={hero ? compositionKey(hero) : undefined} data-team-logo-hash={hero?.teamLogo?.sha256} data-outline-key={outlineKey(hero?.outline)} data-outline-settings={hero?.outlineSettings ? outlineStackKey(hero.outlineSettings) : undefined}>
    <title>{player.name} · FHFH · {title}</title><desc>{explanation}</desc><rect width="1200" height="1020" fill="#F2F1EB" />
    <PlayerHeroHeader identity={player} hero={hero} context={research ? `${snapshot!.capture.season} · saved BLSH research` : goalie ? `${p.goalie.player.season} · schedule & matchup context` : `${snapshot!.capture.season} · ${snapshot!.recent.label} · ${snapshot!.capture.strength === "all" ? "All Strengths" : snapshot!.capture.strength}`} disclosure={source} />
    <g fontFamily="Arial, sans-serif" style={{ fontVariantNumeric: "tabular-nums" }}>
      <text x="40" y="375" fontSize="24" fontWeight="700" fill="#1A1D21">{title.toUpperCase()}</text>
      {goalie ? <>
        <TextLines text={game ? `${game.heading}. Starter: ${game.confirmation}. ${game.forecast}` : p.goalie.reason || "No selected game."} y={414} maxLines={4} />
        {game?.dimensions.map((d, i) => <g key={d.label} transform={`translate(40 ${540 + i * 27})`}><text fontSize="19" fill="#1A1D21" fontWeight="700">{d.label}</text><text x="345" fontSize="17" fill="#555D60" data-evidence-truncated={d.text.length > 80 ? "true" : undefined}>{d.text.length > 80 ? `${d.text.slice(0, 77)}…` : d.text}</text></g>)}
      </> : p.view === "categories" ? <>
        <text x="40" y="401" fontSize="15" fontWeight="700" fill="#087CA2">SCORING</text><text x="40" y="582" fontSize="15" fontWeight="700" fill="#087CA2">PERIPHERALS</text>
        {rows.map((r, i) => <g key={r.metric} transform={`translate(40 ${i < 4 ? 431 + i * 38 : 612 + (i - 4) * 38})`}>
          <text fontSize="25" fill="#1A1D21">{ANALYSIS_FIELDS[r.metric].label}</text><text x="440" textAnchor="end" fontSize="28" fontWeight="700">{number(r.value)}</text>
          {snapshot!.settings.visual === "bars" && <><rect x="470" y="-20" width="440" height="22" rx="3" fill="#D9DDD8" />{r.value !== null ? <rect x="470" y="-20" width={r.value / maximum * 440} height="22" rx="3" fill="#087CA2" /> : <text x="480" y="-3" fontSize="16">Missing · not zero</text>}</>}
          <text x="1120" textAnchor="end" fontSize="17" fill="#555D60">{r.unit}</text>
        </g>)}
        {snapshot!.settings.visual === "radar" && <g transform="translate(815 567)" aria-label="Raw count shape, not percentiles">
          {[0.5, 1].map(scale => <circle key={scale} r={130 * scale} fill="none" stroke="#AAB3AE" />)}
          {rows.map((r, i) => { const a = i / rows.length * Math.PI * 2 - Math.PI / 2, x = Math.cos(a), y = Math.sin(a), next = rows[(i + 1) % rows.length], b = (i + 1) / rows.length * Math.PI * 2 - Math.PI / 2; return <g key={r.metric}><line x2={x * 130} y2={y * 130} stroke="#C0C7C2" />{r.value !== null && <circle cx={x * 130 * r.value / maximum} cy={y * 130 * r.value / maximum} r="5" fill="#087CA2" />}{r.value !== null && next.value !== null && <line x1={x * 130 * r.value / maximum} y1={y * 130 * r.value / maximum} x2={Math.cos(b) * 130 * next.value / maximum} y2={Math.sin(b) * 130 * next.value / maximum} stroke="#087CA2" strokeWidth="3" />}<text x={x * 151} y={y * 151} fontSize="14" textAnchor="middle">{r.metric === "ppPoints" ? "PPP" : r.metric === "shots" ? "SOG" : r.metric.toUpperCase()}{r.value === null ? " ?" : ""}</text></g>; })}
        </g>}
        <text x="40" y="774" fontSize="18" fill="#555D60">Common raw scale 0–{number(maximum)} · {snapshot!.settings.basis} · missing values leave gaps · no percentile or quality score</text>
        <text x="40" y="808" fontSize="23" fontWeight="700">OPPORTUNITY · TOI {number(snapshot!.recent.readings.find(r => r.metric === "toiSeconds")!.value)} min/GP · PP {number(snapshot!.recent.readings.find(r => r.metric === "ppToiSeconds")!.value)} min/GP</text>
        <text x="40" y="840" fontSize="18" fill="#555D60">— means missing or unqualified source, not zero. Individual xG and on-ice xG remain separate.</text>
      </> : p.view === "comparison" ? <>
        <text x="710" y="409" fontSize="19" textAnchor="end">{snapshot!.recent.label} · {snapshot!.recent.gp} GP</text><text x="935" y="409" fontSize="19" textAnchor="end">{snapshot!.baseline.label} · {snapshot!.baseline.gp} GP</text><text x="1160" y="409" fontSize="19" textAnchor="end">Change</text>
        {(["goals", "assists", "points", "shots", "bsh", "toiSeconds", "ppToiSeconds", "ixg", "xgf", "xga", "xgPct"] as AnalysisMetric[]).map((m, i) => { const r = snapshot!.recent.readings.find(r => r.metric === m)!, b = snapshot!.baseline.readings.find(r => r.metric === m)!, delta = analysisDifference(snapshot!, m); return <g key={m} transform={`translate(40 ${445 + i * 34})`} fontSize="23"><text>{ANALYSIS_FIELDS[m].label} · {r.unit}</text><text x="670" textAnchor="end">{number(r.value)}</text><text x="895" textAnchor="end">{number(b.value)}</text><text x="1120" textAnchor="end">{delta.value === null ? "—" : `${delta.value > 0 ? "+" : ""}${number(delta.value)}${m === "xgPct" ? " pp" : ""}`}</text></g>; })}
        <text x="40" y="820" fontSize="18">{snapshot!.baseline.label} dates: {[...snapshot!.baseline.dates].sort().at(0) || "—"} → {[...snapshot!.baseline.dates].sort().at(-1) || "—"} · {snapshot!.baseline.gp} GP</text>
        <text x="40" y="843" fontSize="17">{snapshot!.baseline.reason || (snapshot!.settings.basis === "total" && snapshot!.recent.gp !== snapshot!.baseline.gp ? "Totals have unequal appearance samples; choose per-game or per60 for a change." : "— means missing or unqualified source; changes are descriptive, not a forecast.")}</text>
      </> : p.view === "evidence" ? <TextLines text={`${p.blsh.heading}. ${p.blsh.lines.join(" ")} ${p.blsh.market}`} y={420} maxLines={14} /> : <TextLines text={`${p.trades.lines.join(" ")} ${p.trades.records.map(r => `${r.attribution}; observed ${r.observedAt}; trade date ${r.tradedAt || "unknown"}; ${r.give.map(a => a.kind === "player" ? a.name : `${a.season} ${a.description}`).join(" + ")} for ${r.receive.map(a => a.kind === "player" ? a.name : `${a.season} ${a.description}`).join(" + ")}; scoring ${r.context.scoring || "unknown"}, roster ${r.context.roster || "unknown"}.`).join(" ")}`} y={420} maxLines={14} />}
      <rect x="0" y="864" width="1200" height="156" fill="#1A1D21" />
      <g fill="#F2F1EB" fontSize="18">{warningLines.length ? <text x="40" y="894" fontSize="17" data-confirmation-warnings="true" data-evidence-max-width="1120" data-evidence-truncated={warningsTooLong ? "true" : undefined}>{displayedWarnings.map((line, i) => <tspan key={i} x="40" dy={i ? 28 : 0}>{line}</tspan>)}</text> : <><text x="40" y="894">{research ? `Saved BLSH window ${research.dates[0]} → ${research.dates.at(-1)} · ${research.dates.length} GP · separate from NHL controls` : goalie ? "Volume upside, ratio exposure and win support are separate dimensions; no combined score." : `${snapshot!.recent.requestedAppearances === null ? `${snapshot!.recent.gp} GP` : `${snapshot!.recent.gp} of ${snapshot!.recent.requestedAppearances} appearances`} · dates ${[...snapshot!.recent.dates].sort().at(0) || "—"} → ${[...snapshot!.recent.dates].sort().at(-1) || "—"} · basis ${snapshot!.settings.basis} · strength ${snapshot!.capture.strength}`}</text>
        <text x="40" y="922">{research ? research.currentBoxes ? `Stale research · ${research.currentBoxes.summary} · saved values unchanged` : "Stale development reference · exploratory support evidence · no calibrated confidence or trade advice" : goalie ? "Source confirmation and conditional forecast are separate. Partial inputs are not live/complete." : p.view === "comparison" ? snapshot!.disclosure : "BSH = blocks + shots on goal + hits. Missing component → unavailable BSH."}</text></>}
        <text x="40" y="950">{research ? `BLSH observed: ${research.asOfUTC} · recorded through ${research.eventThroughDate}` : goalie ? `Inventory observed: ${p.goalie.observedAt}` : `Observed: ${snapshot!.capture.observedAt} · rank/N unavailable · all NHL valid values; no GP/TOI/position filter`}</text>
        <text x="40" y="979">{research ? research.provenance ? `${research.methodVersion} · ${research.provenance.state !== "unavailable" ? `${research.provenance.state === "pending-review" ? "mapping review pending" : "retained mapping reviewed"} · ${research.provenance.captureStale ? "stale capture" : "retained capture"}` : "source mapping unavailable"}` : `Method: ${research.methodVersion} · retained source and complete profile in manifest` : goalie ? p.goalie.sharedProvenance ? `${p.goalie.sharedProvenance.version} fixture · ${p.goalie.sharedProvenance.sourceState} inputs · live producer admission pending.` : "Synthetic consumer proposal; producer interface and real inputs pending." : snapshot!.recent.sampleWarning || "Final status at observation; exact end time unavailable. Field reasons and source definitions in manifest."}</text><text x="40" y="1007" fontSize="16">FHFHOCKEY.COM · {source}</text>
      </g>
    </g>
  </svg>;
}
