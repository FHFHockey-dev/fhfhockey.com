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

async function fetchWithAuth(url: string): Promise<ApiData> {
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
    const endpoint = unresolvedId
      ? `/api/v1/db/player-name-aliases?unresolvedId=${encodeURIComponent(unresolvedId)}`
      : "/api/v1/db/player-name-aliases";
    const payload = await fetchWithAuth(endpoint);
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
  const filteredPlayers = useMemo(() => {
    if (!selectedUnresolved?.team_id) return players;
    const teamPlayers = players.filter((player) => player.team_id === selectedUnresolved.team_id);
    return teamPlayers.length > 0 ? teamPlayers : players;
  }, [players, selectedUnresolved?.team_id]);

  async function resolveName() {
    if (!selectedUnresolved || !selectedPlayerId) return;
    const payload = await postWithOptionalAuth("/api/v1/db/player-name-aliases", {
      unresolvedId: selectedUnresolved.id,
      playerId: Number(selectedPlayerId),
      alias: alias || selectedUnresolved.raw_name
    });
    setStatusMessage(payload.message ?? "Alias saved.");
    await loadData();
  }

  async function ignoreName() {
    if (!selectedUnresolved) return;
    const payload = await postWithOptionalAuth("/api/v1/db/player-name-aliases", {
      unresolvedId: selectedUnresolved.id,
      action: "ignore"
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
          <p>No pending unresolved player names.</p>
        ) : null}
        {selectedUnresolved ? (
          <section style={{ display: "grid", gap: 16 }}>
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
              <button disabled={!selectedPlayerId} onClick={() => void resolveName()}>
                Save alias
              </button>
              <button onClick={() => void ignoreName()}>Ignore</button>
            </div>

            <article>
              <h2>Context</h2>
              <p>
                {selectedUnresolved.source} · {selectedUnresolved.team_abbreviation ?? "No team"} ·{" "}
                {selectedUnresolved.tweet_id ?? "No tweet id"}
              </p>
              {selectedUnresolved.source_url ? (
                <p>
                  <a href={selectedUnresolved.source_url}>Open source tweet</a>
                </p>
              ) : null}
              <pre style={{ whiteSpace: "pre-wrap" }}>
                {selectedUnresolved.context_text ?? "No context text."}
              </pre>
            </article>
          </section>
        ) : null}
      </main>
    </>
  );
};

export default PlayerAliasesPage;
