import { useEffect, useMemo, useState } from "react";
import type { NextPage } from "next";
import Head from "next/head";

import supabase from "lib/supabase";

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
    reason?: string | null;
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

function renderHighlightedContext(selectedUnresolved: UnresolvedName) {
  const text = selectedUnresolved.context_text ?? "No context text.";
  const rawName = selectedUnresolved.raw_name.trim();
  const reason = selectedUnresolved.metadata?.reason;
  const slot = parseReviewSlot(reason);
  let structuredLineNumber = 0;
  const namePattern = rawName
    ? new RegExp(`((?:[A-Z]\\.?\\s*)?${escapeRegExp(rawName)})`, "gi")
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
          piece.toLowerCase().endsWith(rawName.toLowerCase()) ? (
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
    const first = payload.unresolvedNames[0];
    setSelectedUnresolvedId(first?.id ?? "");
    setAlias(first?.raw_name ?? "");
    setSelectedPlayerId("");
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
  const filteredPlayers = useMemo(() => {
    if (!selectedUnresolved?.team_id) return players;
    const teamPlayers = players.filter((player) => player.team_id === selectedUnresolved.team_id);
    return teamPlayers.length > 0 ? teamPlayers : players;
  }, [players, selectedUnresolved?.team_id]);

  async function resolveName() {
    if (!selectedUnresolved || !selectedPlayerId) return;
    const reviewToken = new URLSearchParams(window.location.search).get("reviewToken");
    const payload = await postWithOptionalAuth("/api/v1/db/player-name-aliases", {
      unresolvedId: selectedUnresolved.id,
      playerId: Number(selectedPlayerId),
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

  return (
    <>
      <Head>
        <title>Player Alias Review | FHFH</title>
      </Head>
      <main style={{ margin: "0 auto", maxWidth: 960, padding: 24 }}>
        <h1>Player Alias Review</h1>
        {statusMessage ? <p>{statusMessage}</p> : null}
        {isLoading ? <p>Loading...</p> : null}
        {!isLoading && unresolvedNames.length === 0 ? (
          <p>No matching unresolved player name was found.</p>
        ) : null}
        {selectedUnresolved ? (
          <section style={{ display: "grid", gap: 16 }}>
            {selectedUnresolved.status !== "pending" ? (
              <p>
                This name is already {selectedUnresolved.status}. You can leave this page as-is.
              </p>
            ) : null}
            <label>
              Pending name
              <select
                value={selectedUnresolvedId}
                onChange={(event) => {
                  const next = unresolvedNames.find((name) => name.id === event.target.value);
                  setSelectedUnresolvedId(event.target.value);
                  setAlias(next?.raw_name ?? "");
                  setSelectedPlayerId("");
                }}
              >
                {unresolvedNames.map((name) => (
                  <option key={name.id} value={name.id}>
                    {name.raw_name} {name.team_abbreviation ? `(${name.team_abbreviation})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Alias to save
              <input
                value={alias}
                onChange={(event) => setAlias(event.target.value)}
              />
            </label>

            <label>
              Match player
              <select
                value={selectedPlayerId}
                onChange={(event) => setSelectedPlayerId(event.target.value)}
              >
                <option value="">Choose a player...</option>
                {filteredPlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.fullName} {player.position ? `- ${player.position}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                disabled={selectedUnresolved.status !== "pending" || !selectedPlayerId}
                onClick={() => void resolveName()}
              >
                Save alias
              </button>
              <button
                disabled={selectedUnresolved.status !== "pending"}
                onClick={() => void ignoreName()}
              >
                Ignore
              </button>
            </div>

            <article>
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
              <pre style={{ whiteSpace: "pre-wrap" }}>
                {renderHighlightedContext(selectedUnresolved)}
              </pre>
            </article>
          </section>
        ) : null}
      </main>
    </>
  );
};

export default PlayerAliasesPage;
