import { useEffect, useMemo, useState } from "react";
import type { NextPage } from "next";
import Head from "next/head";

import type { NhlProspectIdentity } from "lib/sources/nhlProspectIdentity";
import { aliasReviewRole, findAliasReviewOccurrences, getAliasReviewOccurrence, type AliasReviewPlayer } from "lib/sources/playerAliasReview";
import AdminPageGate from "components/Admin/AdminPageGate";
import supabase from "lib/supabase";
import styles from "./player-aliases.module.scss";

type UnresolvedName = {
  id: string;
  raw_name: string;
  normalized_name: string;
  team_id: number | null;
  team_abbreviation: string | null;
  source: string;
  source_url: string | null;
  tweet_id: string | null;
  context_text: string | null;
  status: "pending" | "resolved" | "ignored";
  resolved_player_id?: number | null;
  resolved_alias_id?: string | null;
  metadata: {
    contextAlias?: string | null;
    reason?: string | null;
    reviewKind?: string | null;
    identityResolved?: boolean;
    savedAlias?: string | null;
    splitPlayerIds?: number[];
    splitAliases?: string[];
    resolutionScope?: string;
    evidence?: { start: number; end: number; text?: string; origin?: "parser" | "unique_token" | "contextual_row" };
    situation?: string | null;
    sourceOrdinal?: number | null;
    candidates?: number[];
  } | null;
  review?: {
    sourceDate: string | null;
    seasonId: number | null;
    candidates: AliasReviewPlayer[];
    preferredPlayerId: number | null;
    preferenceReason: string;
    ambiguousSurname: boolean;
    scopeMessage: string;
  };
  created_at: string;
};

type PlayerOption = {
  id: number;
  fullName: string;
  lastName: string;
  position: string | null;
  team_id: number | null;
};

type ApiData = {
  success: boolean;
  unresolvedNames: UnresolvedName[];
  players: PlayerOption[];
  message?: string;
  membershipReviewEnabled?: boolean;
  lookup?: NhlProspectIdentity;
  unlinkedProspects?: Array<{ id: number; canonical_name: string }>;
};

async function fetchWithOptionalAuth(url: string): Promise<ApiData> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const response = await fetch(url, {
    headers: token
      ? {
          Authorization: `Bearer ${token}`
        }
      : undefined
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.message ?? "Request failed.");
  }
  return payload;
}

async function postWithOptionalAuth(url: string, body: Record<string, unknown>) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.message ?? "Request failed.");
  }
  return payload;
}

function getReviewSlotLabel(reason: string | null | undefined): string | null {
  if (!reason) return null;
  const lineMatch = reason.match(/^line_(\d+)_null_id$/);
  if (lineMatch?.[1]) return `forward line ${lineMatch[1]}`;
  const pairMatch = reason.match(/^pair_(\d+)_null_id$/);
  if (pairMatch?.[1]) return `defense pair ${pairMatch[1]}`;
  if (reason === "goalie_1_null_id") return "goalie 1";
  if (reason === "goalie_2_null_id") return "goalie 2";
  if (reason === "scratches_null_id") return "scratches";
  if (reason === "injuries_null_id") return "injuries";
  if (reason === "unmatched_names") return "unmatched name";
  return null;
}

function getReviewTargetLabel(row: UnresolvedName): string {
  const role = aliasReviewRole(row);
  const slot = getReviewSlotLabel(row.metadata?.reason) ?? (role ? `${role === "es_forward" ? "forward line" : "defense pair"}${row.metadata?.sourceOrdinal ? ` ${row.metadata.sourceOrdinal}` : ""}` : null);
  const occurrence = getAliasReviewOccurrence(row);
  return [slot, occurrence ? `text line ${occurrence.line}` : null].filter(Boolean).join(" · ");
}

function renderHighlightedContext(selectedUnresolved: UnresolvedName) {
  const text = selectedUnresolved.context_text ?? "No context text.";
  const occurrence = getAliasReviewOccurrence(selectedUnresolved);
  if (!occurrence) return text;
  return <>{text.slice(0, occurrence.start)}<mark aria-label="Selected unresolved occurrence" style={{ background: "#ffd54a", color: "#111", padding: "0 2px" }}>{text.slice(occurrence.start, occurrence.end)}</mark>{text.slice(occurrence.end)}</>;
}

const PlayerAliasesReview = () => {
  const [unresolvedNames, setUnresolvedNames] = useState<UnresolvedName[]>([]);
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [selectedUnresolvedId, setSelectedUnresolvedId] = useState<string>("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [splitPlayerIds, setSplitPlayerIds] = useState<[string, string]>(["", ""]);
  const [splitAliases, setSplitAliases] = useState<[string, string]>(["", ""]);
  const [splitMode, setSplitMode] = useState(false);
  const [lookup, setLookup] = useState<NhlProspectIdentity | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [unlinkedProspects, setUnlinkedProspects] = useState<Array<{ id: number; canonical_name: string }>>([]);
  const [playerSearch, setPlayerSearch] = useState("");
  const [membershipSourceUrl, setMembershipSourceUrl] = useState("");
  const [membershipReviewEnabled, setMembershipReviewEnabled] = useState(false);
  const [alias, setAlias] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  function selectName(name?: UnresolvedName) {
    const savedIds = name?.metadata?.splitPlayerIds;
    const savedAliases = name?.metadata?.splitAliases;
    const savedSplit = savedIds?.length === 2 && savedAliases?.length === 2;
    setSelectedUnresolvedId(name?.id ?? "");
    setAlias(name?.metadata?.savedAlias ?? (name ? getAliasReviewOccurrence(name)?.text : null) ?? name?.raw_name ?? "");
    setSelectedPlayerId(savedSplit ? "" : name?.resolved_player_id ? String(name.resolved_player_id) : "");
    setSplitMode(Boolean(savedSplit));
    setSplitPlayerIds(savedSplit ? [String(savedIds[0]), String(savedIds[1])] : ["", ""]);
    setSplitAliases(savedSplit ? [savedAliases[0], savedAliases[1]] : ["", ""]);
    setMembershipSourceUrl("");
    setLookup(null);
  }

  async function loadData(preferredId?: string) {
    setIsLoading(true);
    const params = new URLSearchParams(window.location.search);
    const unresolvedId = params.get("unresolvedId");
    const reviewToken = params.get("reviewToken");
    const query = new URLSearchParams({
      ...(unresolvedId ? { unresolvedId } : {}),
      ...(reviewToken ? { reviewToken } : {}),
    });
    const queryString = query.toString();
    const endpoint = `/api/v1/db/player-name-aliases${queryString ? `?${queryString}` : ""}`;
    const payload = await fetchWithOptionalAuth(endpoint);
    setUnresolvedNames(payload.unresolvedNames);
    setPlayers(payload.players);
    setUnlinkedProspects(payload.unlinkedProspects ?? []);
    setMembershipReviewEnabled(payload.membershipReviewEnabled ?? false);
    const first = payload.unresolvedNames.find((name) => name.id === preferredId && name.status === "pending")
      ?? payload.unresolvedNames.find((name) => name.status === "pending") ?? payload.unresolvedNames[0];
    selectName(first);
    setIsLoading(false);
  }

  useEffect(() => {
    void loadData().catch((error) => {
      setStatusMessage(error.message);
      setIsLoading(false);
    });
  }, []);

  const selectedUnresolved = unresolvedNames.find(
    (name) => name.id === selectedUnresolvedId
  );
  const selectedReviewSlot = selectedUnresolved ? getReviewTargetLabel(selectedUnresolved) : "";
  const selectedOccurrence = selectedUnresolved ? getAliasReviewOccurrence(selectedUnresolved) : null;
  const possibleOccurrences = selectedUnresolved ? findAliasReviewOccurrences(selectedUnresolved.metadata?.contextAlias || selectedUnresolved.raw_name, selectedUnresolved.context_text ?? "") : [];
  const occurrenceMode = selectedUnresolved?.review?.ambiguousSurname || ((selectedUnresolved?.metadata?.candidates?.length ?? 0) > 1 && !/[.\s]/.test(selectedUnresolved?.raw_name ?? ""));
  const savedPlayerIds = selectedUnresolved?.metadata?.splitPlayerIds
    ?? (selectedUnresolved?.resolved_player_id ? [selectedUnresolved.resolved_player_id] : []);
  const savedPlayerNames = savedPlayerIds.map((id) => players.find((player) => player.id === id)?.fullName ?? `NHL ${id}`).join(" and ");
  const pendingNames = unresolvedNames.filter((name) => name.status === "pending");
  const resolvedNames = unresolvedNames.filter((name) => name.status === "resolved");
  const filteredPlayers = useMemo(() => {
    const search = playerSearch.trim().toLowerCase();
    const rank = (player: PlayerOption) => selectedUnresolved?.review
      ? player.id === selectedUnresolved.review.preferredPlayerId ? 2 : Number(selectedUnresolved.review.candidates.some((candidate) => candidate.id === player.id))
      : Number(player.team_id === selectedUnresolved?.team_id);
    return players.filter((player) => !search || player.fullName.toLowerCase().includes(search) || String(player.id) === search).sort((a, b) => rank(b) - rank(a));
  }, [players, playerSearch, selectedUnresolved]);

  function playerOptionsFor(selectedId: string): PlayerOption[] {
    const selected = players.find((player) => String(player.id) === selectedId);
    return selected && !filteredPlayers.some((player) => player.id === selected.id)
      ? [selected, ...filteredPlayers]
      : filteredPlayers;
  }

  async function lookupNhlPlayer() {
    setLookupBusy(true);
    setLookup(null);
    try {
      const params = new URLSearchParams(window.location.search);
      params.set("nhlId", playerSearch.trim());
      params.set("unresolvedId", selectedUnresolvedId);
      const payload = await fetchWithOptionalAuth(`/api/v1/db/player-name-aliases?${params}`);
      if (!payload.lookup?.nhlId) throw new Error("No verified NHL player was found.");
      setLookup(payload.lookup);
      setPlayers((previous) => [...previous.filter((player) => player.id !== payload.lookup!.nhlId), {
        id: payload.lookup!.nhlId!, fullName: payload.lookup!.fullName, lastName: payload.lookup!.lastName,
        position: payload.lookup!.position, team_id: payload.lookup!.currentTeamId,
      }]);
      setSelectedPlayerId(String(payload.lookup.nhlId));
      setStatusMessage("NHL identity verified. Review the player below, then save to import and resolve.");
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : "NHL lookup failed."); }
    finally { setLookupBusy(false); }
  }

  async function resolveName(assignOnly = occurrenceMode) {
    if (!selectedUnresolved || !selectedPlayerId) return;
    const reviewToken = new URLSearchParams(window.location.search).get("reviewToken");
    const payload = await postWithOptionalAuth("/api/v1/db/player-name-aliases", {
      unresolvedId: selectedUnresolved.id,
      playerId: Number(selectedPlayerId),
      importNhlIdentity: lookup?.nhlId === Number(selectedPlayerId),
      membershipSourceUrl: membershipSourceUrl.trim() || undefined,
      alias: alias || selectedUnresolved.raw_name,
      ...(assignOnly ? { action: "assign_occurrence" } : {}),
      ...(reviewToken ? { reviewToken } : {}),
    });
    setStatusMessage(payload.message ?? "Alias saved.");
    await loadData(selectedUnresolved.id);
  }

  async function ignoreName() {
    if (!selectedUnresolved) return;
    const reviewToken = new URLSearchParams(window.location.search).get("reviewToken");
    const payload = await postWithOptionalAuth("/api/v1/db/player-name-aliases", {
      unresolvedId: selectedUnresolved.id,
      action: "ignore",
      ...(reviewToken ? { reviewToken } : {}),
    });
    setStatusMessage(payload.message ?? "Name ignored.");
    await loadData();
  }

  async function splitName() {
    if (!selectedUnresolved || splitPlayerIds.some((id) => !id) || splitPlayerIds[0] === splitPlayerIds[1] || splitAliases.some((value) => !value.trim())) return;
    const reviewToken = new URLSearchParams(window.location.search).get("reviewToken");
    const payload = await postWithOptionalAuth("/api/v1/db/player-name-aliases", {
      unresolvedId: selectedUnresolved.id, action: "split",
      parts: splitAliases.map((part, index) => ({ alias: part.trim(), playerId: Number(splitPlayerIds[index]) })),
      ...(reviewToken ? { reviewToken } : {}),
    });
    setStatusMessage(payload.message ?? "Name split and resolved.");
    await loadData(selectedUnresolved.id);
  }

  return (
    <>
      <Head>
        <title>Player Alias Review | FHFH</title>
      </Head>
      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Database tools</p>
            <h1>Player Alias Review</h1>
          </div>
          <div className={styles.queueCount} aria-label={`${pendingNames.length} names remaining`}>
            <strong>{pendingNames.length}</strong>
            <span>remaining</span>
          </div>
        </header>
        {statusMessage ? <p className={styles.statusMessage} role="status">{statusMessage}</p> : null}
        {isLoading ? <p className={styles.emptyState}>Loading...</p> : null}
        {!isLoading && unresolvedNames.length === 0 ? (
          <p className={styles.emptyState}>No matching unresolved player name was found.</p>
        ) : null}
        {selectedUnresolved ? (
          <section className={styles.layout}>
            <aside className={styles.queuePanel} aria-label="Alias review queue">
              <div className={styles.panelHeader}>
                <div><p className={styles.eyebrow}>Work queue</p><h2>{pendingNames.length} names to review</h2></div>
              </div>
              <ol className={styles.queueList}>
                {pendingNames.map((name) => <li key={name.id} className={name.id === selectedUnresolvedId ? styles.current : undefined}><button type="button" onClick={() => selectName(name)}>{name.raw_name}<span>{name.team_abbreviation}{getReviewTargetLabel(name) ? ` · ${getReviewTargetLabel(name)}` : ""}{name.metadata?.identityResolved ? " · identity saved" : ""}</span></button></li>)}
              </ol>
              {resolvedNames.length ? <p className={styles.resolvedSummary}>✓ {resolvedNames.length} resolved in this queue</p> : null}
            </aside>
            <div className={styles.reviewPanel}>
            {selectedUnresolved.status !== "pending" ? (
              <p className={styles.resolvedNotice}>✓ This name is already {selectedUnresolved.status}. Select a pending name from the queue to continue.</p>
            ) : null}
            {savedPlayerNames && <p className={styles.resolvedNotice}>
              {selectedUnresolved.metadata?.resolutionScope === "occurrence" ? "Identity assigned" : savedPlayerIds.length === 2 ? "Aliases saved" : "Alias saved"} for {savedPlayerNames}.
              {selectedUnresolved.status === "pending" && selectedUnresolved.metadata?.reviewKind === "missing_membership" ? " Membership still needs review; you do not need to assign these identities again." : ""}
            </p>}
            <label className={styles.field}>
              Pending name
              <select
                value={selectedUnresolvedId}
                onChange={(event) => {
                  const next = unresolvedNames.find((name) => name.id === event.target.value);
                  selectName(next);
                }}
              >
                {unresolvedNames.map((name) => (
                  <option key={name.id} value={name.id}>
                    {name.raw_name} {name.team_abbreviation ? `(${name.team_abbreviation})` : ""} {getReviewTargetLabel(name) ? `· ${getReviewTargetLabel(name)}` : ""}
                  </option>
                ))}
              </select>
            </label>

            {!splitMode && !occurrenceMode && <label className={styles.field}>
              Alias to save
              <input
                value={alias}
                onChange={(event) => setAlias(event.target.value)}
              />
            </label>}

            <label className={styles.field}>
              Search all players by name or NHL ID
              <input value={playerSearch} onChange={(event) => setPlayerSearch(event.target.value)} />
            </label>
            {!splitMode && !occurrenceMode && membershipReviewEnabled && <button disabled={lookupBusy || !/^\d{7}$/.test(playerSearch.trim())} onClick={() => void lookupNhlPlayer()}>
              {lookupBusy ? "Checking NHL…" : "Look up NHL ID"}
            </button>}
            {lookup && <p>{lookup.fullName} · NHL {lookup.nhlId} · <a href={lookup.sourceUrl} target="_blank" rel="noreferrer">Verified NHL profile</a>.
              {lookup.currentTeamId ? " Current organization is verified separately from active roster status." : " Current organization is unknown; membership will still need review."}
            </p>}
            {playerSearch.trim() && unlinkedProspects.filter((player) => player.canonical_name.toLowerCase().includes(playerSearch.trim().toLowerCase())).slice(0, 20).map((player) => (
              <p key={player.id}>{player.canonical_name} — verified prospect; NHL ID is not linked yet. Enter an NHL ID above to verify the link.</p>
            ))}
            {selectedUnresolved.review ? <p>Source date: {selectedUnresolved.review.sourceDate ?? "unknown"} · season: {selectedUnresolved.review.seasonId ?? "unknown"} · recorded team: {selectedUnresolved.team_abbreviation ?? selectedUnresolved.team_id ?? "unknown"}. {selectedUnresolved.review.scopeMessage} {selectedUnresolved.review.preferenceReason}</p> : <p>Current team labels are shown for reference; they do not establish membership at the source date.</p>}
            {occurrenceMode && !splitMode && <p>This surname has multiple identities. Assign this occurrence only; no blanket surname alias will be learned.</p>}
            {selectedUnresolved.metadata?.reviewKind && <p>Review reason: {selectedUnresolved.metadata.reviewKind.replace(/_/g, " ")}.</p>}
            {selectedUnresolved.metadata?.reviewKind === "invalid_extraction" && <p>This may contain several players or non-player text. <a href="/db/tweet-pattern-review">Review tweet parsing</a> before creating an alias.</p>}
            {!splitMode && <label className={styles.field}>
              Match player
              <select
                aria-label="Match player"
                value={selectedPlayerId}
                onChange={(event) => setSelectedPlayerId(event.target.value)}
              >
                <option value="">Choose a player...</option>
                {playerOptionsFor(selectedPlayerId).map((player) => {
                  const dated = selectedUnresolved.review?.candidates.find((candidate) => candidate.id === player.id);
                  return (
                  <option key={player.id} value={player.id}>
                    {dated?.fullName ?? player.fullName} · {player.id} {dated ? dated.position ? `- captured position ${dated.position}` : "· captured position unknown" : player.position ? `· current position ${player.position}` : ""} {player.id === selectedUnresolved.review?.preferredPlayerId ? "· source evidence preference" : dated ? "· dated team candidate" : "· verify membership"}
                  </option>
                  );
                })}
              </select>
            </label>}

            {!splitMode && !occurrenceMode && membershipReviewEnabled && <label>
              Verified NHL camp roster URL (optional)
              <input type="url" value={membershipSourceUrl} onChange={(event) => setMembershipSourceUrl(event.target.value)} />
              <span>Supply an NHL.com source only after verifying this player belongs to the reported team’s camp. Saving records camp membership for 30 days and preserves historical rosters.</span>
            </label>}

            <div style={{ display: "flex", gap: 12 }}>
              {!splitMode && <button
                disabled={selectedUnresolved.status !== "pending" || !selectedPlayerId || Boolean(occurrenceMode && !selectedOccurrence)}
                onClick={() => void resolveName().catch((error) => setStatusMessage(error.message))}
              >
                {occurrenceMode ? "Assign this occurrence" : lookup?.nhlId === Number(selectedPlayerId) ? "Import NHL player and save alias" : membershipSourceUrl.trim() ? "Save alias and camp membership" : "Save alias"}
              </button>}
              {!splitMode && !occurrenceMode && !lookup && <button disabled={selectedUnresolved.status !== "pending" || !selectedPlayerId || !selectedOccurrence} onClick={() => void resolveName(true).catch((error) => setStatusMessage(error.message))}>Assign this occurrence only</button>}
              <button
                disabled={selectedUnresolved.status !== "pending"}
                onClick={() => void ignoreName()}
              >
                Ignore
              </button>
            </div>
            {selectedUnresolved.status === "pending" && <button type="button" aria-pressed={splitMode} onClick={() => setSplitMode((previous) => !previous)}>
              {splitMode ? "Assign one player" : "Assign two players"}
            </button>}
            {splitMode ? (
              <div className={styles.splitPanel}>
                <strong>Assign two separate identities</strong>
                <p>Enter each player&apos;s alias and choose two different players. Keep compound surnames intact. This saves identity aliases; it does not confirm a lineup or defense pairing. Missing membership remains pending.</p>
                <div className={styles.splitGrid}>
                  {[0, 1].map((index) => <div key={index}>
                    <label className={styles.field}>Alias {index + 1}<input value={splitAliases[index]} onChange={(event) => setSplitAliases((previous) => { const next = [...previous] as [string, string]; next[index] = event.target.value; return next; })} /></label>
                    <label className={styles.field}>Player {index + 1}<select value={splitPlayerIds[index]} onChange={(event) => setSplitPlayerIds((previous) => { const next = [...previous] as [string, string]; next[index] = event.target.value; return next; })}><option value="">Choose player…</option>{playerOptionsFor(splitPlayerIds[index]).map((player) => <option key={player.id} value={player.id}>{player.fullName} · {player.id}</option>)}</select></label>
                  </div>)}
                </div>
                {splitPlayerIds[0] && splitPlayerIds[0] === splitPlayerIds[1] && <p role="alert">Choose two different players.</p>}
                <button type="button" disabled={selectedUnresolved.status !== "pending" || splitPlayerIds.some((id) => !id) || splitPlayerIds[0] === splitPlayerIds[1] || splitAliases.some((value) => !value.trim())} onClick={() => void splitName().catch((error) => setStatusMessage(error.message))}>Save as two players</button>
              </div>
            ) : null}

            <article className={styles.context}>
              <h2>Context</h2>
              <p>
                {selectedUnresolved.source} · {selectedUnresolved.team_abbreviation ?? "No team"} ·{" "}
                {selectedUnresolved.tweet_id ?? "No tweet id"}
              </p>
              {selectedReviewSlot ? <p>Review target: {selectedReviewSlot}</p> : null}
              {selectedOccurrence ? <p>Review occurrence: text line {selectedOccurrence.line}, “{selectedOccurrence.text}”. {selectedOccurrence.basis === "offset" ? "Recorded parser offsets." : selectedOccurrence.basis === "contextual_row" ? "Contextual row fallback; original offsets are unavailable or do not match." : "Unique text match; original offsets are unavailable or do not match."}</p> : <p>No exact occurrence can be selected from this record. {possibleOccurrences.length > 1 ? "Several matching occurrences remain ambiguous; none is highlighted." : "The recorded token or offsets do not match the retained context."}</p>}
              {!selectedOccurrence && possibleOccurrences.length > 1 && <ul aria-label="Possible unresolved occurrences">{possibleOccurrences.map((occurrence) => <li key={occurrence.start}>Text line {occurrence.line}: {occurrence.row}</li>)}</ul>}
              {selectedUnresolved.source_url ? (
                <p>
                  <a href={selectedUnresolved.source_url}>Open source tweet</a>
                </p>
              ) : null}
              <pre>
                {renderHighlightedContext(selectedUnresolved)}
              </pre>
            </article>
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
};

const PlayerAliasesPage: NextPage = () => (
  <AdminPageGate allowReviewToken>
    <PlayerAliasesReview />
  </AdminPageGate>
);

export default PlayerAliasesPage;
