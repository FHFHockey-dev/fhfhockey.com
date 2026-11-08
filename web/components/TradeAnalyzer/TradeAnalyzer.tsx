import { useState, type FormEvent } from "react";

import { SLOT_TYPES } from "lib/rosterAutopsy/manual";
import { assetsFromText, MAX_OTHER_ASSETS, MAX_ROSTER_PLAYERS, previewOffer, rosterFromText, type ManualPlayer, type OfferTeam, type TeamId } from "lib/tradeAnalyzer/offer";
import { emptySlots, INCOMING_STATUS_NOTE, slotFeasibility, type SlotEntry } from "lib/tradeAnalyzer/slotFeasibility";

import styles from "./TradeAnalyzer.module.scss";

type TeamForm = { id: TeamId; name: string; rosterText: string; rosterReviewed: boolean; capacity: string;
  capacityReviewed: boolean; givePlayerIds: string[]; dropPlayerIds: string[]; assetText: string;
  slots: SlotEntry["slots"]; slotsReviewed: boolean };
const emptyTeam = (id: TeamId): TeamForm => ({ id, name: "", rosterText: "", rosterReviewed: false,
  capacity: "", capacityReviewed: false, givePlayerIds: [], dropPlayerIds: [], assetText: "",
  slots: emptySlots(), slotsReviewed: false });
const teamLabel = (id: TeamId) => id === "a" ? "Team A" : "Team B";
const toggle = (ids: string[], id: string, checked: boolean) => checked ? [...ids, id] : ids.filter(value => value !== id);

function RosterList({ players }: { players: ManualPlayer[] }) {
  return players.length ? <ul>{players.map(player => <li key={player.id}><strong>{player.name}</strong>
    <span> · {player.positions || "Positions unknown"} · {player.status || "Status unknown"}</span></li>)}</ul> : <p>No players entered.</p>;
}

export default function TradeAnalyzer() {
  const [forms, setForms] = useState<[TeamForm, TeamForm]>([emptyTeam("a"), emptyTeam("b")]);
  const [effectiveDate, setEffectiveDate] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const teams = forms.map(form => ({ id: form.id, name: form.name, roster: rosterFromText(form.id, form.rosterText),
    rosterReviewed: form.rosterReviewed, totalCapacity: /^\d+$/.test(form.capacity) ? Number(form.capacity) : null,
    capacityReviewed: form.capacityReviewed, givePlayerIds: form.givePlayerIds, dropPlayerIds: form.dropPlayerIds,
    otherAssets: assetsFromText(form.assetText) })) as [OfferTeam, OfferTeam];
  const result = previewOffer({ effectiveDate, teams });
  const feasibility = slotFeasibility({ effectiveDate, teams }, result,
    forms.map(form => ({ slots: form.slots, slotsReviewed: form.slotsReviewed })) as [SlotEntry, SlotEntry]);
  const update = (id: TeamId, patch: Partial<TeamForm>) => setForms(current => current.map(team => team.id === id ? { ...team, ...patch } : team) as [TeamForm, TeamForm]);
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setShowPreview(true); }

  return <div className={styles.page}>
    <header className={styles.hero}><p className={styles.eyebrow}>Manual offer review</p><h1>Trade Analyzer</h1>
      <p>Enter an offer you received or plan to make. Compare both complete rosters and choose any drops yourself.</p>
      <p className={styles.note}>Two teams only · {MAX_ROSTER_PLAYERS} players and {MAX_OTHER_ASSETS} other assets per side. This page keeps inputs only until you leave or reload; nothing is sent or saved.</p>
    </header>
    <form onSubmit={submit}>
      <div className={styles.panel}><label className={styles.date}>Proposed effective date<input type="date" value={effectiveDate} onChange={event => setEffectiveDate(event.target.value)} /></label>
        <p className={styles.note}>This records your scenario date. Deadlines, processing delays and dated lineup legality are not verified.</p></div>
      <div className={styles.teamGrid}>{forms.map((form, index) => {
        const team = teams[index];
        const label = teamLabel(form.id);
        return <fieldset key={form.id} className={styles.panel}><legend>{label}</legend>
          <label>{label} name<input maxLength={120} value={form.name} onChange={event => update(form.id, { name: event.target.value })} /></label>
          <label>{label} full before-roster<textarea aria-label={`${label} full before-roster`} rows={7} maxLength={20000} value={form.rosterText} placeholder={"Player name | C/LW | bench\nAnother player | D | IR"}
            onChange={event => update(form.id, { rosterText: event.target.value, rosterReviewed: false, givePlayerIds: [], dropPlayerIds: [] })} /></label>
          <p className={styles.note}>One player per line: name | league positions | status. Include active, bench and reserve players. Positions and status remain manager-reported; they do not establish lineup eligibility. Distinguish identical names. Editing the roster clears its offer/drop selections.</p>
          <label className={styles.check}><input type="checkbox" checked={form.rosterReviewed} onChange={event => update(form.id, { rosterReviewed: event.target.checked })} />I reviewed {label}&apos;s complete roster and ownership.</label>
          <label>{label} maximum total players<input type="text" inputMode="numeric" maxLength={3} value={form.capacity}
            onChange={event => update(form.id, { capacity: event.target.value, capacityReviewed: false })} /></label>
          <p className={styles.note}>Enter the maximum count including active, bench and reserve players, not just starting slots. Leave blank if unknown. Separate reserve/slot restrictions remain unverified.</p>
          <label className={styles.check}><input type="checkbox" checked={form.capacityReviewed} onChange={event => update(form.id, { capacityReviewed: event.target.checked })} />I reviewed {label}&apos;s total-player limit.</label>
          <fieldset className={styles.slotFieldset}><legend>{label} starting slots</legend>
            <div className={styles.slotGrid}>{SLOT_TYPES.map(type => <label key={type}>{type}<input aria-label={`${label} ${type} starting slots`} type="text" inputMode="numeric" maxLength={2} value={form.slots[type]}
              onChange={event => update(form.id, { slots: { ...form.slots, [type]: event.target.value }, slotsReviewed: false })} /></label>)}</div>
          </fieldset>
          <p className={styles.note}>Active starting slots only, not bench or reserve spots. Enter 0 for slot types your league does not use.</p>
          <label className={styles.check}><input type="checkbox" checked={form.slotsReviewed} onChange={event => update(form.id, { slotsReviewed: event.target.checked })} />I reviewed {label}&apos;s starting slots.</label>
          <h2>{label} gives to {teamLabel(form.id === "a" ? "b" : "a")}</h2>
          {team.roster.length ? <ul className={styles.selectionList}>{team.roster.map(player => <li key={player.id}><label className={styles.check}>
            <input type="checkbox" checked={form.givePlayerIds.includes(player.id)} onChange={event => update(form.id, {
              givePlayerIds: toggle(form.givePlayerIds, player.id, event.target.checked), dropPlayerIds: form.dropPlayerIds.filter(id => id !== player.id) })} />
            Offer {player.name || "Unnamed player"} ({player.positions || "positions unknown"})</label></li>)}</ul> : <p className={styles.note}>Enter the full roster above to select outgoing players.</p>}
          <label>{label} picks or other assets<textarea aria-label={`${label} picks or other assets`} rows={3} maxLength={6000} value={form.assetText} placeholder={"pick: 2027 round 2, original owner unknown\nUnknown asset or condition"}
            onChange={event => update(form.id, { assetText: event.target.value })} /></label>
          <p className={styles.note}>Use “pick:” for each pick; other lines stay unknown assets. Full descriptions are retained, never priced or silently removed.</p>
        </fieldset>;
      })}</div>
      <button type="submit" className={styles.previewButton}>Preview offer</button>
    </form>

    {showPreview && <section className={styles.results} aria-labelledby="offer-preview-heading">
      <h2 id="offer-preview-heading">Offer preview</h2>
      <p role="status">{result.entryComplete ? "Entry and reviewed total-player counts are complete. This is not a trade-legality or value verdict." : "Conditional preview — resolve the items below before relying on roster counts."} The preview updates as you edit.</p>
      {result.issues.length > 0 && <div className={styles.warning}><h3>Items to resolve</h3><ul>{result.issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.message}</li>)}</ul></div>}
      <div className={styles.teamGrid}>{result.teams.map((preview, index) => {
        const team = teams[index], form = forms[index];
        return <section key={team.id} className={styles.panel} aria-labelledby={`preview-${team.id}`}>
          <h3 id={`preview-${team.id}`}>{team.name || teamLabel(team.id)} before and after</h3>
          <h4>Before · {preview.before.length} players</h4><RosterList players={preview.before} />
          <h4>Gives</h4><ul>{team.roster.filter(player => team.givePlayerIds.includes(player.id)).map(player => <li key={player.id}>{player.name} · manager-entered player</li>)}
            {team.otherAssets.map((asset, assetIndex) => <li key={`asset-${assetIndex}`}>{asset.kind === "pick" ? "Pick" : "Unknown asset"}: {asset.rawText || "Description missing"} · value unavailable</li>)}</ul>
          <h4>Receives</h4><ul>{teams[1 - index].roster.filter(player => teams[1 - index].givePlayerIds.includes(player.id)).map(player => <li key={player.id}>{player.name} · manager-entered player</li>)}
            {teams[1 - index].otherAssets.map((asset, assetIndex) => <li key={`asset-${assetIndex}`}>{asset.kind === "pick" ? "Pick" : "Unknown asset"}: {asset.rawText || "Description missing"} · value unavailable</li>)}</ul>
          {preview.capacity.status === "available" ? <p className={styles.capacity}>Reviewed total-player limit: {preview.capacity.value.total}. Before: {preview.capacity.value.beforeCount}; after exchange: {preview.capacity.value.afterExchangeCount}; after selected drops: {preview.capacity.value.afterCount}.
            {` ${preview.capacity.value.requiredDrops} drop(s) needed after the exchange; ${preview.capacity.value.additionalDrops} additional drop(s) still required.`}</p>
            : <p className={styles.warning}>Capacity unresolved: {preview.capacity.reasons.join(" ")}</p>}
          <h4>Select explicit drops for {team.name || teamLabel(team.id)}</h4>
          <p className={styles.note}>Only retained players from this team&apos;s before-roster can be dropped here. Offered and incoming players are excluded. No player is dropped automatically.</p>
          <ul className={styles.selectionList}>{team.roster.filter(player => !team.givePlayerIds.includes(player.id)).map(player => <li key={player.id}><label className={styles.check}>
            <input type="checkbox" checked={form.dropPlayerIds.includes(player.id)} onChange={event => update(team.id, { dropPlayerIds: toggle(form.dropPlayerIds, player.id, event.target.checked) })} />
            Drop {teamLabel(team.id)}: {player.name}</label></li>)}</ul>
          <p className={styles.note}>Selected drops: {preview.drops.length ? preview.drops.map(player => player.name).join(", ") : "None"}. Their production cost is unavailable, not zero.</p>
          <h4>After selected drops</h4>{preview.after.status === "available" ? <RosterList players={preview.after.value} /> : <p>{preview.after.reasons.join(" ")}</p>}
        </section>;
      })}</div>
      <section className={styles.panel} aria-labelledby="slot-coverage-heading">
        <h3 id="slot-coverage-heading">Starting-slot coverage with reviewed positions</h3>
        <p className={styles.note}>Each team&apos;s manager-entered positions are placed into its entered starting slots, each player used once. This shows coverage only. It does not check locks, deadlines or reserve rules, and it does not measure production or value.</p>
        {feasibility.issues.length > 0 && <ul className={styles.warning}>{feasibility.issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.message}</li>)}</ul>}
        <div className={styles.teamGrid}>{feasibility.teams.map((item, index) => {
          const name = teams[index].name || teamLabel(item.teamId);
          return <section key={item.teamId} aria-label={`${name} starting-slot coverage`} className={styles.coverage}>
            <h4>{name}</h4>
            {item.coverage.status === "available" ? <>
              <p>Before: {item.coverage.value.before.filled} of {item.coverage.value.before.totalSlots} starting slots filled. After: {item.coverage.value.after.filled} of {item.coverage.value.after.totalSlots} filled
                {item.coverage.value.unfilledChange === 0 ? " (no change)." : item.coverage.value.unfilledChange > 0 ? ` (${item.coverage.value.unfilledChange} more unfilled).` : ` (${-item.coverage.value.unfilledChange} fewer unfilled).`}</p>
              <ul>{item.coverage.value.positions.filter(row => row.dedicatedSlots > 0 || row.eligibleBefore !== row.eligibleAfter).map(row => <li key={row.position}>
                {row.position}: {row.filledBefore} → {row.filledAfter} of {row.dedicatedSlots} dedicated slots filled; eligible players {row.eligibleBefore} → {row.eligibleAfter}</li>)}</ul>
              <p className={styles.note}>Reserve-status players left out of coverage: {item.coverage.value.before.excludedReserves} before, {item.coverage.value.after.excludedReserves} after. Position fills show one possible assignment; flex slots are not added to position counts.</p>
            </> : <p className={styles.warning}>Coverage unavailable: {item.coverage.reasons.join(" ")}</p>}
            {item.incoming.length > 0 && <p className={styles.note}>Incoming: {item.incoming.map(player => `${player.name} (${player.status})`).join(", ")}. {INCOMING_STATUS_NOTE}</p>}
          </section>;
        })}</div>
      </section>
      <section className={styles.panel} aria-labelledby="offer-evidence-heading"><h3 id="offer-evidence-heading">What this preview cannot establish</h3>
        {([ ["Dated legality", result.datedLegality], ["League valuation", result.valuation], ["Roster impact", result.impact], ["Counterparty acceptance", result.acceptance], ["Market evidence", result.market] ] as const).map(([label, value]) =>
          <p key={label}><strong>{label}: unavailable.</strong> {value.status === "unavailable" ? value.reasons.join(" ") : ""}</p>)}
        <p>Player quality is not scored. Players, positions and ownership are manually entered and have not been verified against your league. This offer stays on this page; it is never submitted as a transaction or counted as market evidence.</p>
      </section>
    </section>}
  </div>;
}
