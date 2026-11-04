import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { useAuth } from "contexts/AuthProviderContext";
import { normalizeEligibility } from "lib/rosterScheduleOptimizer/eligibility";
import { readWorkspace } from "lib/rosterScheduleOptimizer/workspace";
import { analyzeRoster, copyManualRsoWorkspace, emptyWorkspace, MAX_PLAYERS, MAX_STARTING_SLOTS, mergeManualRsoWorkspace, parseSlotCounts, parseWorkspace, retainedRecentPoints, rsoMergeCandidates, SLOT_TYPES, storageKey, type ManualPlayer, type ManualWorkspace, type PositionCoverage } from "lib/rosterAutopsy/manual";

import styles from "./RosterAutopsy.module.scss";

type LoadedWorkspace = { scope: string; workspace: ManualWorkspace; storage: "available" | "unavailable" | "unreadable" | "conflict" };
type ImportReview = { source: ManualWorkspace; baseline: string; selectedIds: string[]; replaceSlots: boolean };
const initialForm = { name: "", eligibility: "", team: "", status: "bench" as ManualPlayer["status"] };
const slotNames: Record<(typeof SLOT_TYPES)[number], string> = {
  C: "Center", LW: "Left wing", RW: "Right wing", D: "Defense", G: "Goalie", F: "Forward flex", W: "Wing flex", UTIL: "Utility",
};

function positionStatus(row: PositionCoverage): string {
  if (row.state === "no_slot") return "No usable slot";
  if (row.state === "flex_only") return "Flex slots only";
  if (row.state === "needs_review") return "Needs review";
  if (row.state === "short") return `${row.dedicatedSlots - row.eligible.length} fewer eligible than dedicated slots`;
  return "Covered individually";
}

export default function RosterAutopsy() {
  const { user, isLoading } = useAuth();
  const scope = storageKey(user?.id ?? null);
  const [loaded, setLoaded] = useState<LoadedWorkspace | null>(null);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [importReview, setImportReview] = useState<ImportReview | null>(null);
  const saved = useRef<{ scope: string; raw: string | null } | null>(null);

  useEffect(() => {
    if (isLoading) return;
    setForm(initialForm);
    setError("");
    setImportMessage("");
    setImportReview(null);
    try {
      const raw = window.localStorage.getItem(scope);
      const restored = raw === null ? emptyWorkspace() : parseWorkspace(raw);
      saved.current = { scope, raw };
      setLoaded({ scope, workspace: restored ?? emptyWorkspace(), storage: restored ? "available" : "unreadable" });
    } catch {
      saved.current = { scope, raw: null };
      setLoaded({ scope, workspace: emptyWorkspace(), storage: "unavailable" });
    }
  }, [isLoading, scope]);

  useEffect(() => {
    const expected = saved.current;
    if (isLoading || !loaded || loaded.scope !== scope || loaded.storage === "unreadable" || loaded.storage === "conflict"
      || !expected || expected.scope !== scope) return;
    try {
      const current = window.localStorage.getItem(scope);
      if (current !== expected.raw) {
        setLoaded(value => value?.scope === scope ? { ...value, storage: "conflict" } : value);
        return;
      }
      const next = JSON.stringify(loaded.workspace);
      if (current !== next) window.localStorage.setItem(scope, next);
      saved.current = { scope, raw: next };
      if (loaded.storage === "unavailable") setLoaded(current => current?.scope === scope ? { ...current, storage: "available" } : current);
    } catch {
      if (loaded.storage !== "unavailable") setLoaded(current => current?.scope === scope ? { ...current, storage: "unavailable" } : current);
    }
  }, [isLoading, loaded, scope]);

  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === scope && saved.current?.scope === scope && event.newValue !== saved.current.raw) {
        setLoaded(current => current?.scope === scope && current.storage !== "unreadable" ? { ...current, storage: "conflict" } : current);
      }
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [scope]);

  const visibleWorkspace = !isLoading && loaded?.scope === scope ? loaded.workspace : null;
  const result = useMemo(() => visibleWorkspace ? analyzeRoster(visibleWorkspace) : null, [visibleWorkspace]);
  if (!loaded || !visibleWorkspace) return <p className={styles.loading}>Opening your manual roster…</p>;
  const workspace = visibleWorkspace;
  const slotsValid = parseSlotCounts(workspace.slots) !== null;
  const update = (edit: (current: ManualWorkspace) => ManualWorkspace) => {
    setLoaded(current => current?.scope === scope ? { ...current, workspace: edit(current.workspace) } : current);
  };
  const editPlayer = (id: string, change: Partial<ManualPlayer>) => update(current => ({ ...current, rosterReviewed: false,
    players: current.players.map(player => player.id === id ? { ...player, ...change } : player) }));

  function addPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim(), team = form.team.trim().toUpperCase(), eligibility = form.eligibility.trim();
    if (!name || !normalizeEligibility(eligibility).valid) {
      setError("Enter a name and valid league positions, such as C/LW or D.");
      return;
    }
    if (workspace.players.length >= MAX_PLAYERS) { setError(`This workspace supports up to ${MAX_PLAYERS} players.`); return; }
    if (workspace.players.some(player => player.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase()
      && player.team.trim().toLocaleLowerCase() === team.toLocaleLowerCase())) {
      setError("A player with that name and team is already on this roster. Add a team to distinguish players with the same name.");
      return;
    }
    const id = typeof globalThis.crypto?.randomUUID === "function" ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    update(current => ({ ...current, rosterReviewed: false, players: [...current.players,
      { id: `manual:${id}`, name, team, eligibility, status: form.status, recent: null }] }));
    setForm(initialForm);
    setError("");
  }

  function importRso() {
    setImportReview(null);
    try {
      const source = readWorkspace(window.localStorage, undefined, user?.id ?? null);
      const copied = source && copyManualRsoWorkspace(source);
      if (!copied) { setImportMessage(`A readable manual RSO workspace with at most ${MAX_PLAYERS} players was not found for the current user on this device.`); return; }
      const candidates = rsoMergeCandidates(workspace, copied);
      setImportReview({ source: copied, baseline: JSON.stringify(workspace),
        selectedIds: candidates.filter(candidate => candidate.status === "new").map(candidate => candidate.player.id),
        replaceSlots: workspace.players.length === 0 && !workspace.slotsReviewed
          && SLOT_TYPES.every(slot => workspace.slots[slot] === "0") && parseSlotCounts(copied.slots) !== null });
      setImportMessage("");
    } catch {
      setImportMessage("The RSO workspace could not be read on this device. You can still enter your roster below.");
    }
  }

  function applyRsoMerge() {
    if (!importReview) return;
    if (JSON.stringify(workspace) !== importReview.baseline) {
      setImportMessage("Your workspace changed during review. Open the RSO review again before importing.");
      setImportReview(null);
      return;
    }
    const merged = mergeManualRsoWorkspace(workspace, importReview.source, importReview.selectedIds, importReview.replaceSlots);
    if (!merged.ok) { setImportMessage(merged.message); return; }
    setLoaded(current => current?.scope === scope && JSON.stringify(current.workspace) === importReview.baseline
      ? { ...current, workspace: merged.workspace } : current);
    setImportReview(null);
    setImportMessage(`Added ${merged.added} ${merged.added === 1 ? "player" : "players"}; existing entries were kept.${merged.unresolvedAdded ? ` ${merged.unresolvedAdded} items need review.` : ""}${merged.recentOmitted ? " Some recent stats were omitted because the saved scoring differs or is unavailable." : ""}`);
  }

  return <div className={styles.page}>
    <header className={styles.hero}>
      <div><p className={styles.eyebrow}>FHFH · roster autopsy</p><h1>Know your roster</h1>
        <p>Start with your league&apos;s positions and see where your roster has coverage or a possible gap.</p></div>
      <div className={styles.heroMeta}><strong>Manual workspace</strong><span>{loaded.storage === "available"
        ? `Saved on this device for ${user ? "your account" : "this browser"}.` : "Changes remain in this session."}</span>
        <span>League comparisons and player grades need more data.</span></div>
    </header>

    {loaded.storage !== "available" && <p className={styles.warning} role="alert">{loaded.storage === "unreadable"
      ? "The saved autopsy workspace could not be read. It has not been overwritten; changes in this session will not be saved."
      : loaded.storage === "conflict" ? "This roster changed in another tab. Your current edits remain here but will not overwrite the saved copy. Reload to see the other version."
        : "Browser storage is unavailable. Changes will stay only for this session."}</p>}

    <nav className={styles.mobileJump} aria-label="Roster autopsy sections">
      <a href="#autopsy-roster-heading">Roster</a><a href="#autopsy-coverage-heading">Coverage</a>
    </nav>

    <div className={styles.layout}>
      <section className={styles.panel} aria-labelledby="autopsy-roster-heading">
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Your team</p><h2 id="autopsy-roster-heading" className={styles.jumpTarget} tabIndex={-1}>Roster</h2></div>
          <span>{workspace.players.length} {workspace.players.length === 1 ? "player" : "players"}</span></div>
        <p className={styles.intro}>Enter each player&apos;s fantasy eligibility, including every eligible position. Names and positions are manager-entered, not verified here. Active and bench players count toward coverage; IR, IR+ and NA do not.</p>
        <div className={styles.importRow}>
          <button type="button" onClick={importRso} aria-expanded={Boolean(importReview)} aria-controls="autopsy-import-review">Review manual RSO import</button>
          <span>Choose players to add; existing entries stay unchanged.</span>
          <a href="/roster-schedule-optimizer">Open Roster Schedule Optimizer</a>
        </div>
        {importMessage && <p role="status" className={styles.notice}>{importMessage}</p>}
        {importReview && <section id="autopsy-import-review" className={styles.importReview} aria-labelledby="autopsy-import-heading">
          <h3 id="autopsy-import-heading">Review RSO import</h3>
          <p>Existing players stay unchanged. Check possible duplicate names before selecting them.</p>
          <ul>{rsoMergeCandidates(workspace, importReview.source).map(({ player, status }) => <li key={player.id}>
            <label className={styles.importCandidate}><input type="checkbox" disabled={status === "already_present"}
              checked={importReview.selectedIds.includes(player.id)} onChange={event => setImportReview(current => current ? { ...current,
                selectedIds: event.target.checked ? [...current.selectedIds, player.id] : current.selectedIds.filter(id => id !== player.id) } : current)} />
              <span><strong>{player.name}</strong> · {player.team || "Team unknown"} · {player.eligibility || "Positions unknown"}
                <small>{status === "already_present" ? "Already in your roster" : status === "possible_duplicate" ? "Possible duplicate name — select only if different" : "New to this roster"}</small></span>
            </label>
          </li>)}</ul>
          {importReview.source.unresolved.length > 0 && <p>{importReview.source.unresolved.length} unresolved RSO {importReview.source.unresolved.length === 1 ? "item" : "items"} will be included for review.</p>}
          <label className={styles.confirm}><input type="checkbox" checked={importReview.replaceSlots}
            disabled={!parseSlotCounts(importReview.source.slots)} onChange={event => setImportReview(current => current ? { ...current, replaceSlots: event.target.checked } : current)} />
            Use RSO starting slots (replaces the counts shown here).</label>
          {!parseSlotCounts(importReview.source.slots) && <p>RSO starting slots are unavailable or exceed this workspace&apos;s limits.</p>}
          <p>{workspace.players.length === 0 && workspace.scoring === null
            ? "RSO scoring will be copied for retained recent stats when you add players."
            : "Your saved scoring stays unchanged; incompatible recent stats will be omitted."}</p>
          {JSON.stringify(workspace) !== importReview.baseline && <p className={styles.error}>Your workspace changed. Review the RSO import again before applying it.</p>}
          <div className={styles.importActions}><button type="button" onClick={applyRsoMerge} disabled={JSON.stringify(workspace) !== importReview.baseline}>Add selected players</button>
            <button type="button" onClick={() => setImportReview(null)}>Cancel</button></div>
        </section>}
        <form onSubmit={addPlayer} className={styles.addForm}>
          <label>Player name<input value={form.name} maxLength={160} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Player name" /></label>
          <label>League positions<input value={form.eligibility} maxLength={100} onChange={event => setForm({ ...form, eligibility: event.target.value })} placeholder="C/LW" /></label>
          <label>Team <span>(optional)</span><input value={form.team} maxLength={80} onChange={event => setForm({ ...form, team: event.target.value })} placeholder="NHL team" /></label>
          <label>Roster status<select value={form.status} onChange={event => setForm({ ...form, status: event.target.value as ManualPlayer["status"] })}>
            <option value="bench">Bench</option><option value="active">Active</option><option value="IR">IR</option><option value="IR+">IR+</option><option value="NA">NA</option>
          </select></label>
          <button type="submit">Add player</button>
        </form>
        {error && <p className={styles.error} role="alert">{error}</p>}

        {workspace.unresolved.length > 0 && <div className={styles.reviewList}><strong>Items needing review</strong>
          <p>Resolve or account for each item before confirming the roster.</p>
          <ul>{workspace.unresolved.map((item, index) => <li key={`${item}-${index}`}><span>{item}</span>
            <button type="button" aria-label={`Mark ${item} reviewed`} onClick={() => update(current => ({ ...current, rosterReviewed: false,
              unresolved: current.unresolved.filter((_, itemIndex) => itemIndex !== index) }))}>Mark reviewed</button></li>)}</ul></div>}

        {workspace.players.length === 0 ? <p className={styles.empty}>Add a player or copy your manual RSO roster to begin.</p> : <ul className={styles.rosterList}>
          {workspace.players.map(player => {
            const valid = normalizeEligibility(player.eligibility).valid;
            const recent = retainedRecentPoints(player, workspace.scoring);
            return <li key={player.id} className={styles.player}>
              <div className={styles.playerName}><strong>{player.name}</strong><span>{player.team || "Team not entered"}</span>
                {recent !== null && player.recent && <small>{recent.toFixed(2)} recent league pts/appearance · {player.recent.games} games · saved RSO stats, date unknown</small>}</div>
              <label>Positions<input aria-label={`${player.name} positions`} maxLength={100} value={player.eligibility}
                onChange={event => editPlayer(player.id, { eligibility: event.target.value })} aria-invalid={!valid} /></label>
              <label>Status<select aria-label={`${player.name} status`} value={player.status}
                onChange={event => editPlayer(player.id, { status: event.target.value as ManualPlayer["status"] })}>
                <option value="bench">Bench</option><option value="active">Active</option><option value="IR">IR</option><option value="IR+">IR+</option><option value="NA">NA</option></select></label>
              <button type="button" aria-label={`Remove ${player.name}`} onClick={() => update(current => ({ ...current, rosterReviewed: false,
                players: current.players.filter(row => row.id !== player.id) }))}>Remove</button>
              {!valid && <span className={styles.error}>Review this player&apos;s league positions.</span>}
            </li>;
          })}</ul>}
        {workspace.scoring && <p className={styles.note}>Any points shown use the scoring saved in RSO and retained recent box scores. Verify your league settings; the stats&apos; observation date is unknown. These are historical hints, not projections.</p>}
        <label className={styles.confirm}><input type="checkbox" checked={workspace.rosterReviewed} disabled={!workspace.players.length}
          onChange={event => update(current => ({ ...current, rosterReviewed: event.target.checked }))} />
          I reviewed this roster and its league positions.</label>
      </section>

      <aside className={styles.side}>
        <section className={styles.panel} aria-labelledby="autopsy-slots-heading">
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>League setup</p><h2 id="autopsy-slots-heading">Starting slots</h2></div></div>
          <p className={styles.intro}>Enter the number of each active slot in your league. Bench and reserve spots are not starting slots; custom slot types are not supported here.</p>
          <div className={styles.slotGrid}>{SLOT_TYPES.map(slot => <label key={slot}><span>{slot} <small>{slotNames[slot]}</small></span>
            <input type="text" inputMode="numeric" maxLength={3} aria-label={`${slot} starting slots`} value={workspace.slots[slot]}
              onChange={event => update(current => ({ ...current, slotsReviewed: false, slots: { ...current.slots, [slot]: event.target.value } }))} /></label>)}</div>
          {!slotsValid && <p className={styles.note}>Enter whole numbers from 0 to 25 and at least one starting slot ({MAX_STARTING_SLOTS} total maximum).</p>}
          <label className={styles.confirm}><input type="checkbox" checked={workspace.slotsReviewed} disabled={!slotsValid}
            onChange={event => update(current => ({ ...current, slotsReviewed: event.target.checked }))} />
            I reviewed these starting slots.</label>
        </section>

        <section className={styles.panel} aria-labelledby="autopsy-coverage-heading">
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Position check</p><h2 id="autopsy-coverage-heading" className={styles.jumpTarget} tabIndex={-1}>Coverage</h2></div></div>
          {!result ? <p className={styles.empty}>Add roster players, then enter and confirm your starting slots to see coverage.</p> : <>
            <p className={styles.coverageTotal}><strong>{result.assignments.length} / {result.totalSlots}</strong> starting slots can be filled with known eligibility{result.incomplete ? " · review needed" : ""}</p>
            <p className={styles.note}>{result.available} active or bench players considered · {result.excludedReserves} in reserve. This is a lineup-shape check, without game schedules, locks, player quality or league rankings.</p>
            <div className={styles.positionList}>{result.positions.map(row => <article key={row.position} className={styles.positionCard}>
              <div><h3>{row.position}</h3><strong data-state={row.state}>{positionStatus(row)}</strong></div>
              <p>{row.eligible.length} known eligible · {row.dedicatedSlots} dedicated {row.dedicatedSlots === 1 ? "slot" : "slots"}
                {row.uncertainPlayers > 0 ? ` · ${row.uncertainPlayers} needing position detail` : ""}</p>
              <small>{row.eligible.length ? row.eligible.map(player => player.name).join(", ") : "No known eligible players"}</small>
            </article>)}</div>
            <p className={styles.note}>A multi-position player can appear in several position counts. Each player is used only once in the simultaneous slot total, so individual coverage may overlap.</p>
            {result.incomplete && <p className={styles.warning}>Complete the roster and position review before treating these counts as a full roster assessment.</p>}
          </>}
        </section>
      </aside>
    </div>
    <p className={styles.footerNote}>This view is advisory. Player-quality grades, league comparisons, trade suggestions and playoff schedules are not available in this manual foundation.</p>
  </div>;
}
