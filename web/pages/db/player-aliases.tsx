import { useEffect, useMemo, useState } from "react";
import type { NextPage } from "next";
import Head from "next/head";

import type { NhlProspectIdentity } from "lib/sources/nhlProspectIdentity";
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
  metadata: {
    contextAlias?: string | null;
    reason?: string | null;
    reviewKind?: string | null;
  } | null;
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function parseReviewSlot(reason: string | null | undefined): {
  group: "line" | "pair" | null;
  index: number | null;
} {
  const lineMatch = reason?.match(/^line_(\d+)_null_id$/);
  if (lineMatch?.[1]) return { group: "line", index: Number(lineMatch[1]) };
  const pairMatch = reason?.match(/^pair_(\d+)_null_id$/);
  if (pairMatch?.[1]) return { group: "pair", index: Number(pairMatch[1]) };
  return { group: null, index: null };
}

function isStructuredContextLine(line: string): boolean {
  return /[-–—/\\•]/.test(line) && !/^https?:\/\//i.test(line.trim());
}

function countMatches(text: string, pattern: RegExp): number {
  pattern.lastIndex = 0;
  return Array.from(text.matchAll(pattern)).length;
}

function renderHighlightedContext(selectedUnresolved: UnresolvedName) {
  const text = selectedUnresolved.context_text ?? "No context text.";
  const rawName = selectedUnresolved.raw_name.trim();
  const contextAlias = selectedUnresolved.metadata?.contextAlias?.trim();
  const reason = selectedUnresolved.metadata?.reason;
  const slot = parseReviewSlot(reason);
  let structuredLineNumber = 0;
  const exactName = contextAlias || rawName;
  const exactPattern = exactName
    ? new RegExp(`\\b(${escapeRegExp(exactName)})\\b`, "gi")
    : null;
  const namePattern =
    exactPattern && (contextAlias || countMatches(text, exactPattern) === 1)
      ? exactPattern
      : null;

  return text.split(/(\n)/).map((part, index) => {
    if (part === "\n") return part;

    const isStructured = isStructuredContextLine(part);
    if (isStructured) structuredLineNumber += 1;
    const shouldHighlightLine =
      slot.index != null &&
      isStructured &&
      ((slot.group === "line" && structuredLineNumber === slot.index) ||
        (slot.group === "pair" && structuredLineNumber === slot.index + 4));

    if (!namePattern) {
      return (
        <span key={index} style={shouldHighlightLine ? { background: "#513d05" } : undefined}>
          {part}
        </span>
      );
    }

    const pieces = part.split(namePattern);
    return (
      <span key={index} style={shouldHighlightLine ? { background: "#513d05" } : undefined}>
        {pieces.map((piece, pieceIndex) =>
          piece.toLowerCase() === exactName.toLowerCase() ? (
            <mark key={pieceIndex} style={{ background: "#ffd54a", color: "#111", padding: "0 2px" }}>
              {piece}
            </mark>
          ) : (
            piece
          )
        )}
      </span>
    );
  });
}

const PlayerAliasesPage: NextPage = () => {
  const [unresolvedNames, setUnresolvedNames] = useState<UnresolvedName[]>([]);
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [selectedUnresolvedId, setSelectedUnresolvedId] = useState<string>("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [splitPlayerIds, setSplitPlayerIds] = useState<[string, string]>(["", ""]);
  const [lookup, setLookup] = useState<NhlProspectIdentity | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [unlinkedProspects, setUnlinkedProspects] = useState<Array<{ id: number; canonical_name: string }>>([]);
  const [playerSearch, setPlayerSearch] = useState("");
  const [membershipSourceUrl, setMembershipSourceUrl] = useState("");
  const [membershipReviewEnabled, setMembershipReviewEnabled] = useState(false);
  const [alias, setAlias] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function loadData() {
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
    setLookup(null);
    setMembershipReviewEnabled(payload.membershipReviewEnabled ?? false);
    setMembershipSourceUrl("");
    const first = payload.unresolvedNames.find((name) => name.status === "pending") ?? payload.unresolvedNames[0];
    setSelectedUnresolvedId(first?.id ?? "");
    setAlias(first?.raw_name ?? "");
    setSelectedPlayerId("");
    setSplitPlayerIds(["", ""]);
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
  const selectedReviewSlot = getReviewSlotLabel(selectedUnresolved?.metadata?.reason);
  const pendingNames = unresolvedNames.filter((name) => name.status === "pending");
  const resolvedNames = unresolvedNames.filter((name) => name.status === "resolved");
  const filteredPlayers = useMemo(() => {
    const search = playerSearch.trim().toLowerCase();
    return players.filter((player) => !search || player.fullName.toLowerCase().includes(search) || String(player.id) === search)
      .sort((a, b) => Number(b.team_id === selectedUnresolved?.team_id) - Number(a.team_id === selectedUnresolved?.team_id));
  }, [players, playerSearch, selectedUnresolved?.team_id]);

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

  async function resolveName() {
    if (!selectedUnresolved || !selectedPlayerId) return;
    const reviewToken = new URLSearchParams(window.location.search).get("reviewToken");
    const payload = await postWithOptionalAuth("/api/v1/db/player-name-aliases", {
      unresolvedId: selectedUnresolved.id,
      playerId: Number(selectedPlayerId),
      importNhlIdentity: lookup?.nhlId === Number(selectedPlayerId),
      membershipSourceUrl: membershipSourceUrl.trim() || undefined,
      alias: alias || selectedUnresolved.raw_name,
      ...(reviewToken ? { reviewToken } : {}),
    });
    setStatusMessage(payload.message ?? "Alias saved.");
    await loadData();
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
    if (!selectedUnresolved || splitPlayerIds.some((id) => !id)) return;
    const parts = selectedUnresolved.raw_name.split("-").map((part) => part.trim());
    const payload = await postWithOptionalAuth("/api/v1/db/player-name-aliases", { unresolvedId: selectedUnresolved.id, action: "split", parts: parts.map((part, index) => ({ alias: part, playerId: Number(splitPlayerIds[index]) })) });
    setStatusMessage(payload.message ?? "Name split and resolved.");
    await loadData();
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
                {pendingNames.map((name) => <li key={name.id} className={name.id === selectedUnresolvedId ? styles.current : undefined}><button type="button" onClick={() => { setSelectedUnresolvedId(name.id); setAlias(name.raw_name); setSelectedPlayerId(""); setMembershipSourceUrl(""); }}>{name.raw_name}{name.team_abbreviation ? <span>{name.team_abbreviation}</span> : null}</button></li>)}
              </ol>
              {resolvedNames.length ? <p className={styles.resolvedSummary}>✓ {resolvedNames.length} resolved in this queue</p> : null}
            </aside>
            <div className={styles.reviewPanel}>
            {selectedUnresolved.status !== "pending" ? (
              <p className={styles.resolvedNotice}>✓ This name is already {selectedUnresolved.status}. Select a pending name from the queue to continue.</p>
            ) : null}
            <label className={styles.field}>
              Pending name
              <select
                value={selectedUnresolvedId}
                onChange={(event) => {
                  const next = unresolvedNames.find((name) => name.id === event.target.value);
                  setSelectedUnresolvedId(event.target.value);
                  setAlias(next?.raw_name ?? "");
                  setSelectedPlayerId(""); setSplitPlayerIds(["", ""]);
                  setMembershipSourceUrl("");
                }}
              >
                {unresolvedNames.map((name) => (
                  <option key={name.id} value={name.id}>
                    {name.raw_name} {name.team_abbreviation ? `(${name.team_abbreviation})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              Alias to save
              <input
                value={alias}
                onChange={(event) => setAlias(event.target.value)}
              />
            </label>

            <label className={styles.field}>
              Search all players by name or NHL ID
              <input value={playerSearch} onChange={(event) => setPlayerSearch(event.target.value)} />
            </label>
            {membershipReviewEnabled && <button disabled={lookupBusy || !/^\d{7}$/.test(playerSearch.trim())} onClick={() => void lookupNhlPlayer()}>
              {lookupBusy ? "Checking NHL…" : "Look up NHL ID"}
            </button>}
            {lookup && <p>{lookup.fullName} · NHL {lookup.nhlId} · <a href={lookup.sourceUrl} target="_blank" rel="noreferrer">Verified NHL profile</a>.
              {lookup.currentTeamId ? " Current organization is verified separately from active roster status." : " Current organization is unknown; membership will still need review."}
            </p>}
            {playerSearch.trim() && unlinkedProspects.filter((player) => player.canonical_name.toLowerCase().includes(playerSearch.trim().toLowerCase())).slice(0, 20).map((player) => (
              <p key={player.id}>{player.canonical_name} — verified prospect; NHL ID is not linked yet. Enter an NHL ID above to verify the link.</p>
            ))}
            <p>Team matches appear first. Choosing a player from another team saves an identity alias; it does not change roster membership.</p>
            {selectedUnresolved.metadata?.reviewKind && <p>Review reason: {selectedUnresolved.metadata.reviewKind.replace(/_/g, " ")}.</p>}
            {selectedUnresolved.metadata?.reviewKind === "invalid_extraction" && <p>This may contain several players or non-player text. <a href="/db/tweet-pattern-review">Review tweet parsing</a> before creating an alias.</p>}
            <label className={styles.field}>
              Match player
              <select
                aria-label="Match player"
                value={selectedPlayerId}
                onChange={(event) => setSelectedPlayerId(event.target.value)}
              >
                <option value="">Choose a player...</option>
                {filteredPlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.fullName} · {player.id} {player.position ? `- ${player.position}` : ""} {player.team_id === selectedUnresolved.team_id ? "· team match" : "· verify membership"}
                  </option>
                ))}
              </select>
            </label>

            {membershipReviewEnabled && <label>
              Verified NHL camp roster URL (optional)
              <input type="url" value={membershipSourceUrl} onChange={(event) => setMembershipSourceUrl(event.target.value)} />
              <span>Supply an NHL.com source only after verifying this player belongs to the reported team’s camp. Saving records camp membership for 30 days and preserves historical rosters.</span>
            </label>}

            <div style={{ display: "flex", gap: 12 }}>
              <button
                disabled={selectedUnresolved.status !== "pending" || !selectedPlayerId}
                onClick={() => void resolveName().catch((error) => setStatusMessage(error.message))}
              >
                {lookup?.nhlId === Number(selectedPlayerId) ? "Import NHL player and save alias" : membershipSourceUrl.trim() ? "Save alias and camp membership" : "Save alias"}
              </button>
              <button
                disabled={selectedUnresolved.status !== "pending"}
                onClick={() => void ignoreName()}
              >
                Ignore
              </button>
            </div>
            {selectedUnresolved.status === "pending" && /^\S+-\S+$/.test(selectedUnresolved.raw_name) ? (
              <div className={styles.splitPanel}>
                <strong>Is this two players?</strong>
                <p>Choose one player for each side of the hyphen. A split saves both aliases separately.</p>
                <div className={styles.splitGrid}>
                  {selectedUnresolved.raw_name.split("-").map((part, index) => <label className={styles.field} key={part}><span>{part.trim()}</span><select value={splitPlayerIds[index]} onChange={(event) => setSplitPlayerIds((previous) => { const next = [...previous] as [string, string]; next[index] = event.target.value; return next; })}><option value="">Choose player…</option>{filteredPlayers.map((player) => <option key={player.id} value={player.id}>{player.fullName} · {player.id}</option>)}</select></label>)}
                </div>
                <button type="button" disabled={splitPlayerIds.some((id) => !id)} onClick={() => void splitName().catch((error) => setStatusMessage(error.message))}>Save as two players</button>
              </div>
            ) : null}

            <article className={styles.context}>
              <h2>Context</h2>
              <p>
                {selectedUnresolved.source} · {selectedUnresolved.team_abbreviation ?? "No team"} ·{" "}
                {selectedUnresolved.tweet_id ?? "No tweet id"}
              </p>
              {selectedReviewSlot ? <p>Review target: {selectedReviewSlot}</p> : null}
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

export default PlayerAliasesPage;
