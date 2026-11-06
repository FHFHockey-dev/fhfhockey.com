import { Fragment, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from "react";

import type { TrainerExtraction, TrainerSlotValue, TrainerType } from "lib/sources/tweetSwipeTrainer";
import type { TrainerCard } from "lib/sources/tweetSwipeTrainerServer";

import { findPlayerByName, foldName, sentenceCase, suggestPlayers } from "./TrainerCard";
import { resolveCardName, type TrainerCategoryOption, type TrainerPlayerOption } from "./trainerApi";
import styles from "./TweetSwipeTrainer.module.scss";

const FORWARD_LINES = 4;
const DEFENSE_PAIRS = 3;
const GOALIE_ROLES = ["Starter", "Backup"] as const;
// Slots read left to right as the tweet lists them, which beat writers write as LW-C-RW and LD-RD.
const FORWARD_SPOTS = ["LW", "C", "RW"] as const;
const DEFENSE_SPOTS = ["LD", "RD"] as const;
// Drags carry this type so slots only accept names from the tray, not stray text.
const TRAY_TYPE = "application/x-fhfh-trainer-name";

type ListKind = "extraSkaters" | "extras" | "others";
type Target =
  | { kind: "forward"; row: number; col: number }
  | { kind: "pair"; row: number; col: number }
  | { kind: "goalie"; index: number }
  | { kind: ListKind; index: number };

function typeForCategory(category: string): TrainerType {
  if (category === "LINE COMBINATION" || category === "LINEUP") return "line_combination";
  if (category === "GOALIE START") return "goalie";
  if (["INJURY", "SCRATCHES", "RETURN"].includes(category)) return "injury";
  if (category === "TRANSACTION") return "transaction";
  return "other";
}

function names(slots: TrainerSlotValue[], size: number): string[] {
  return Array.from({ length: size }, (_, index) => slots[index]?.name ?? "");
}

function grid(lines: TrainerSlotValue[][], rows: number, size: number): string[][] {
  return Array.from({ length: rows }, (_, index) => names(lines[index] ?? [], size));
}

const key = (name: string) => foldName(name);

/** An unknown name, resolved right here through the alias tool, so later tweets match it too. */
function ResolveRow(props: {
  card: TrainerCard;
  raw: string;
  players: TrainerPlayerOption[];
  listId: string;
  onResolved: (raw: string, player: TrainerPlayerOption, message: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suggestions = useMemo(
    () => suggestPlayers(props.raw, props.players, props.card.parse.teamId),
    [props.raw, props.players, props.card.parse.teamId]
  );
  const player = findPlayerByName(props.players, draft);

  async function save(chosen: TrainerPlayerOption) {
    setBusy(true);
    setError(null);
    try {
      const queued = props.card.unresolvedNames.find((name) => key(name.rawName) === key(props.raw));
      const message = await resolveCardName({
        card: props.card,
        rawName: props.raw,
        playerId: chosen.id,
        reason: "trainer_unmatched",
        unresolvedId: queued?.id ?? null
      });
      props.onResolved(props.raw, chosen, message);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Alias save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.resolveRow} role="group" aria-label={`Resolve ${props.raw}`}>
      <p className={styles.resolveLead}>
        &ldquo;{props.raw}&rdquo; isn&rsquo;t a known player.
        {suggestions.length ? " Is it:" : " Who is it?"}
      </p>
      {suggestions.length ? (
        <div className={styles.slotChips}>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              className={styles.trayChip}
              disabled={busy}
              onClick={() => void save(suggestion)}
            >
              {suggestion.fullName}
            </button>
          ))}
        </div>
      ) : null}
      <div className={styles.editorListRow}>
        <input
          className={styles.slotInput}
          list={props.listId}
          value={draft}
          placeholder="Another player"
          aria-label={`Player ${props.raw} means`}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="button" className={styles.primaryButton} disabled={!player || busy} onClick={() => player && void save(player)}>
          {busy ? "Saving…" : "Save alias"}
        </button>
      </div>
      {error ? <p className={styles.fixError} role="alert">{error}</p> : null}
    </div>
  );
}

function SlotInput(props: {
  value: string;
  label: string;
  listId: string;
  players: TrainerPlayerOption[];
  placing: string | null;
  onChange: (value: string) => void;
  onPlace: (name: string) => void;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  // A long name shrinks its own text to fit the field (down to 10px) instead of scrolling inside it.
  useLayoutEffect(() => {
    const element = input.current;
    if (!element) return;
    const fit = () => {
      element.style.fontSize = "";
      let size = parseFloat(getComputedStyle(element).fontSize) || 14;
      while (element.scrollWidth > element.clientWidth && size > 10) {
        size -= 0.5;
        element.style.fontSize = `${size}px`;
      }
    };
    fit();
    // Refit when the field's width changes (window resize, layout switch).
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [props.value]);
  const known = !props.value.trim() || Boolean(findPlayerByName(props.players, props.value));
  const className = [
    styles.slotInput,
    known ? "" : styles.slotInputUnknown,
    props.placing ? styles.slotTarget : "",
    over ? styles.slotDropOver : ""
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <input
      ref={input}
      className={className}
      list={props.listId}
      value={props.value}
      // While a name is picked, a tap places it instead of opening the keyboard.
      readOnly={Boolean(props.placing)}
      aria-label={props.placing ? `${props.label}: place ${props.placing} here` : props.label}
      title={known ? undefined : "Not a known player name: it will be stored as text"}
      onChange={(event) => props.onChange(event.target.value)}
      onClick={() => {
        if (props.placing) props.onPlace(props.placing);
      }}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (props.placing && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          props.onPlace(props.placing);
        }
      }}
      onDragOver={(event: DragEvent<HTMLInputElement>) => {
        if (!event.dataTransfer.types.includes(TRAY_TYPE)) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event: DragEvent<HTMLInputElement>) => {
        const name = event.dataTransfer.getData(TRAY_TYPE);
        setOver(false);
        if (!name) return;
        event.preventDefault();
        props.onPlace(name);
      }}
    />
  );
}

export default function CorrectionEditor(props: {
  card: TrainerCard;
  players: TrainerPlayerOption[];
  categoryOptions: TrainerCategoryOption[];
  busy: boolean;
  onCancel: () => void;
  onSave: (correction: TrainerExtraction, notes: string) => void;
  onAliasSaved: (message: string) => void;
}) {
  const start = props.card.extraction;
  const { parse } = props.card;
  const slotIds = new Set(
    [...start.forwards.flat(), ...start.defensePairs.flat(), ...start.goalies, ...start.extras].map((slot) => slot.playerId)
  );
  const [category, setCategory] = useState(start.category);
  const [subcategory, setSubcategory] = useState(start.subcategory ?? "");
  const [forwards, setForwards] = useState(() => grid(start.forwards, FORWARD_LINES, 3));
  const [pairs, setPairs] = useState(() => grid(start.defensePairs, DEFENSE_PAIRS, 2));
  const [goalies, setGoalies] = useState(() => names(start.goalies, GOALIE_ROLES.length));
  const [extraSkaters, setExtraSkaters] = useState(() => (start.extraSkaters ?? []).map((slot) => slot.name));
  const [extras, setExtras] = useState(() => start.extras.map((slot) => slot.name));
  const [others, setOthers] = useState(() => start.players.filter((slot) => !slotIds.has(slot.playerId)).map((slot) => slot.name));
  const [bumped, setBumped] = useState<string[]>([]);
  const [placing, setPlacing] = useState<string | null>(null);
  // Names resolved here: raw text -> the player's full name, so the tray and every spot follow the fix.
  const [renamed, setRenamed] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const listId = `trainer-correction-${props.card.key}`;
  const subcategories = props.categoryOptions.find((option) => option.category === category)?.subcategories ?? [];
  const showLines = typeForCategory(category) === "line_combination";

  // Names the parser saw but didn't place: dropped candidate lines, unmatched names and, for lineups, other
  // names. A name leaves the tray once it sits in a spot; a name pushed out of a spot comes back.
  const candidates = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    const add = (raw: string | null | undefined) => {
      const name = raw?.trim() ? renamed[key(raw)] ?? raw.trim() : null;
      if (!name || seen.has(key(name))) return;
      seen.add(key(name));
      out.push(name);
    };
    for (const line of [...parse.forwards, ...parse.defensePairs]) {
      if (!line.kept) line.slots.forEach((slot) => add(slot.fullName ?? slot.raw));
    }
    parse.players.filter((player) => player.playerId == null).forEach((player) => add(player.raw));
    if (showLines) others.forEach(add);
    bumped.forEach(add);
    return out;
  }, [parse, showLines, others, bumped, renamed]);
  const placed = new Set(
    [...forwards.flat(), ...pairs.flat(), ...goalies, ...extraSkaters, ...extras, ...(showLines ? [] : others)]
      .filter((value) => value.trim())
      .map(key)
  );
  const tray = candidates.filter((name) => !placed.has(key(name)));

  const toSlot = (name: string): TrainerSlotValue => {
    const player = findPlayerByName(props.players, name);
    return { playerId: player?.id ?? null, name: player?.fullName ?? name.trim() };
  };
  const filled = (values: string[]) => values.filter((value) => value.trim()).map(toSlot);

  function valueAt(target: Target): string {
    if (target.kind === "forward") return forwards[target.row]?.[target.col] ?? "";
    if (target.kind === "pair") return pairs[target.row]?.[target.col] ?? "";
    if (target.kind === "goalie") return goalies[target.index] ?? "";
    const list = target.kind === "extraSkaters" ? extraSkaters : target.kind === "extras" ? extras : others;
    return list[target.index] ?? "";
  }

  function write(target: Target, value: string) {
    const setGrid = (rows: string[][], row: number, col: number) =>
      rows.map((cells, rowIndex) => (rowIndex === row ? cells.map((cell, colIndex) => (colIndex === col ? value : cell)) : cells));
    if (target.kind === "forward") setForwards((rows) => setGrid(rows, target.row, target.col));
    else if (target.kind === "pair") setPairs((rows) => setGrid(rows, target.row, target.col));
    else if (target.kind === "goalie") setGoalies((cells) => cells.map((cell, index) => (index === target.index ? value : cell)));
    else {
      const setList = target.kind === "extraSkaters" ? setExtraSkaters : target.kind === "extras" ? setExtras : setOthers;
      setList((list) => {
        const next = [...list];
        next[target.index] = value;
        return next;
      });
    }
  }

  /** Puts a tray name in a spot. Whatever was there goes back to the tray; the name leaves any other spot. */
  function place(target: Target, name: string) {
    const previous = valueAt(target);
    if (previous.trim() && key(previous) !== key(name)) setBumped((list) => [...list, previous]);
    // A name can only sit in one spot.
    setForwards((rows) => rows.map((cells) => cells.map((cell) => (key(cell) === key(name) ? "" : cell))));
    setPairs((rows) => rows.map((cells) => cells.map((cell) => (key(cell) === key(name) ? "" : cell))));
    setGoalies((cells) => cells.map((cell) => (key(cell) === key(name) ? "" : cell)));
    for (const setList of [setExtraSkaters, setExtras]) setList((list) => list.filter((cell) => key(cell) !== key(name)));
    write(target, name);
    setPlacing(null);
  }

  // Every name that doesn't match a known player, in a spot or still in the tray, can be resolved here.
  const unknownNames = [...new Set([...forwards.flat(), ...pairs.flat(), ...goalies, ...extraSkaters, ...extras, ...tray].filter(
    (value) => value.trim() && !findPlayerByName(props.players, value)
  ))].filter((value, index, all) => all.findIndex((other) => key(other) === key(value)) === index);

  function resolved(raw: string, player: TrainerPlayerOption, message: string) {
    const swap = (value: string) => (key(value) === key(raw) ? player.fullName : value);
    setForwards((rows) => rows.map((cells) => cells.map(swap)));
    setPairs((rows) => rows.map((cells) => cells.map(swap)));
    setGoalies((cells) => cells.map(swap));
    setExtraSkaters((list) => list.map(swap));
    setExtras((list) => list.map(swap));
    setOthers((list) => list.map(swap));
    setBumped((list) => list.map(swap));
    setRenamed((map) => ({ ...map, [key(raw)]: player.fullName }));
    props.onAliasSaved(message);
  }

  function save() {
    const lineSlots = showLines ? forwards.map(filled).filter((line) => line.length) : [];
    const pairSlots = showLines ? pairs.map(filled).filter((pair) => pair.length) : [];
    const goalieSlots = filled(goalies);
    const extraSkaterSlots = filled(extraSkaters);
    const extraSlots = filled(extras);
    // Names left in the tray were still named in the tweet.
    const named = showLines ? filled(tray) : filled(others);
    const everyone = new Map<string, TrainerSlotValue>();
    for (const slot of [...lineSlots.flat(), ...pairSlots.flat(), ...goalieSlots, ...extraSkaterSlots, ...extraSlots, ...named]) {
      if (slot.playerId != null) everyone.set(`id:${slot.playerId}`, slot);
    }
    props.onSave(
      {
        type: typeForCategory(category),
        category,
        subcategory: subcategory || null,
        players: [...everyone.values()],
        forwards: lineSlots,
        defensePairs: pairSlots,
        goalies: goalieSlots,
        extras: extraSlots,
        extraSkaters: extraSkaterSlots
      },
      notes
    );
  }

  const slot = (target: Target, label: string) => (
    <SlotInput
      value={valueAt(target)}
      label={label}
      listId={listId}
      players={props.players}
      placing={placing}
      onChange={(next) => write(target, next)}
      onPlace={(name) => place(target, name)}
    />
  );

  const listEditor = (kind: ListKind, label: string, values: string[], setValues: (next: string[]) => void) => (
    <div className={styles.editorGroup}>
      <h3 className={styles.slotTitle}>{label}</h3>
      {values.map((value, index) => (
        <div key={index} className={styles.editorListRow}>
          {slot({ kind, index }, `${label} ${index + 1}`)}
          <button
            type="button"
            className={styles.ghostButton}
            onClick={() => setValues(values.filter((_, itemIndex) => itemIndex !== index))}
            aria-label={`Remove ${value || "empty row"}`}
          >
            Remove
          </button>
        </div>
      ))}
      {placing ? (
        <div className={styles.editorListRow}>{slot({ kind, index: values.length }, `New ${label.toLowerCase()} spot`)}</div>
      ) : (
        <button type="button" className={`${styles.ghostButton} ${styles.addButton}`} onClick={() => setValues([...values, ""])}>
          Add player
        </button>
      )}
    </div>
  );

  return (
    <section
      className={styles.editor}
      aria-label="Correct the parser's answer"
      onKeyDown={(event) => {
        // Escape first drops the picked name; a second Escape leaves the editor.
        if (event.key === "Escape" && placing) {
          event.stopPropagation();
          setPlacing(null);
        }
      }}
    >
      <datalist id={listId}>
        {props.players.map((player) => (
          <option key={player.id} value={player.fullName} />
        ))}
      </datalist>
      <header className={styles.editorHeader}>
        <h2>What should the parser have said?</h2>
        <p>Start from the parser&rsquo;s answer and change what&rsquo;s wrong. Names that don&rsquo;t match a player are kept as text.</p>
      </header>

      <div className={styles.editorRow}>
        <label className={styles.fieldLabel}>
          <span>Category</span>
          <select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setSubcategory("");
            }}
          >
            {props.categoryOptions.map((option) => (
              <option key={option.category} value={option.category}>{sentenceCase(option.category)}</option>
            ))}
          </select>
        </label>
        <label className={styles.fieldLabel}>
          <span>Subcategory</span>
          <select value={subcategory} onChange={(event) => setSubcategory(event.target.value)}>
            <option value="">None</option>
            {subcategories.map((option) => (
              <option key={option} value={option}>{sentenceCase(option)}</option>
            ))}
          </select>
        </label>
      </div>

      {tray.length ? (
        <div className={styles.tray} role="group" aria-label="Names to place">
          <h3 className={styles.slotTitle}>Names to place</h3>
          <p className={styles.trayHint} aria-live="polite">
            {placing
              ? `Placing ${placing}: click the spot it belongs in, or press Esc to cancel.`
              : "Click a name, then the spot it belongs in. On desktop you can also drag it."}
          </p>
          <div className={styles.slotChips}>
            {tray.map((name) => (
              <button
                key={name}
                type="button"
                draggable
                className={placing && key(placing) === key(name) ? `${styles.trayChip} ${styles.trayChipPicked}` : styles.trayChip}
                aria-pressed={placing ? key(placing) === key(name) : false}
                onClick={() => setPlacing((current) => (current && key(current) === key(name) ? null : name))}
                onDragStart={(event) => {
                  event.dataTransfer.setData(TRAY_TYPE, name);
                  event.dataTransfer.setData("text/plain", name);
                  event.dataTransfer.effectAllowed = "move";
                  setPlacing(name);
                }}
                onDragEnd={() => setPlacing(null)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {unknownNames.length ? (
        <div className={styles.resolveGroup}>
          <h3 className={styles.slotTitle}>Names to resolve</h3>
          {unknownNames.map((raw) => (
            <ResolveRow key={key(raw)} card={props.card} raw={raw} players={props.players} listId={listId} onResolved={resolved} />
          ))}
        </div>
      ) : null}

      {showLines ? (
        <>
          <div className={styles.editorGroup}>
            <h3 className={styles.slotTitle}>Forward lines</h3>
            <div className={styles.editorGrid} data-cols="3">
              <span aria-hidden="true" />
              {FORWARD_SPOTS.map((spot) => (
                <span key={spot} className={styles.spotHead} aria-hidden="true">{spot}</span>
              ))}
              {forwards.map((line, lineIndex) => (
                <Fragment key={lineIndex}>
                  <span className={styles.slotLabel}>L{lineIndex + 1}</span>
                  {line.map((_, slotIndex) => (
                    <span key={slotIndex} className={styles.editorCell}>
                      {slot({ kind: "forward", row: lineIndex, col: slotIndex }, `Line ${lineIndex + 1} ${FORWARD_SPOTS[slotIndex]}`)}
                    </span>
                  ))}
                </Fragment>
              ))}
            </div>
          </div>
          <div className={styles.editorGroup}>
            <h3 className={styles.slotTitle}>Defence pairs</h3>
            <div className={styles.editorGrid} data-cols="3">
              <span aria-hidden="true" />
              {DEFENSE_SPOTS.map((spot) => (
                <span key={spot} className={styles.spotHead} aria-hidden="true">{spot}</span>
              ))}
              <span aria-hidden="true" />
              {pairs.map((pair, pairIndex) => (
                <Fragment key={pairIndex}>
                  <span className={styles.slotLabel}>D{pairIndex + 1}</span>
                  {pair.map((_, slotIndex) => (
                    <span key={slotIndex} className={styles.editorCell}>
                      {slot({ kind: "pair", row: pairIndex, col: slotIndex }, `Pair ${pairIndex + 1} ${DEFENSE_SPOTS[slotIndex]}`)}
                    </span>
                  ))}
                  <span aria-hidden="true" />
                </Fragment>
              ))}
            </div>
          </div>
          {listEditor("extraSkaters", "Extra skaters", extraSkaters, setExtraSkaters)}
        </>
      ) : null}

      <div className={styles.editorGroup}>
        <h3 className={styles.slotTitle}>Goalies</h3>
        {GOALIE_ROLES.map((role, index) => (
          <div key={role} className={styles.editorSlotRow}>
            <span className={styles.slotRole}>{role}</span>
            <span className={styles.editorCell}>{slot({ kind: "goalie", index }, `${role} goalie`)}</span>
          </div>
        ))}
      </div>

      {listEditor("extras", "Scratches and injuries", extras, setExtras)}
      {showLines ? null : listEditor("others", "Players", others, setOthers)}

      <label className={styles.fieldLabel}>
        <span>Notes (optional)</span>
        <textarea value={notes} rows={2} onChange={(event) => setNotes(event.target.value)} />
      </label>

      <div className={styles.fixActions}>
        <button type="button" className={styles.primaryButton} disabled={props.busy} onClick={save}>
          {props.busy ? "Saving…" : "Save correction"}
        </button>
        <button type="button" className={styles.ghostButton} disabled={props.busy} onClick={props.onCancel}>Back to card</button>
      </div>
    </section>
  );
}
