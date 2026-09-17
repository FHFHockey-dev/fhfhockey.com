import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "contexts/AuthProviderContext";
import supabase from "lib/supabase/client";
import type { loadYahooStarterBoard } from "lib/integrations/yahoo/starterBoard";

type Result = Awaited<ReturnType<typeof loadYahooStarterBoard>>;

export default function StarterBoardYahoo() {
  const { user } = useAuth();
  return user ? <YahooTeam key={user.id} /> : <p><Link href="/account">Sign in and connect Yahoo</Link> for today’s Draft Pro lineup comparison.</p>;
}

function YahooTeam() {
  const [data, setData] = useState<Result | null>(null);
  const [teamId, setTeamId] = useState("");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  async function load() {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setBusy(true); setError(null); setData(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Sign in to load your Yahoo team.");
      const response = await fetch("/api/v1/account/yahoo/starter-board", {
        method: "POST", cache: "no-store", signal: controller.signal,
        headers: { Authorization: `Bearer ${session.session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...(teamId ? { teamId } : {}), ...(category ? { category } : {}) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Unable to load Yahoo recommendations.");
      if (controller.signal.aborted) return;
      setData(payload.data);
      if (payload.data.teamId) setTeamId(payload.data.teamId);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Yahoo is unavailable.");
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }
  const names = new Map(data?.roster?.map((player) => [player.id, player.name]) ?? []);
  return <details>
    <summary>My Yahoo team · Today · Draft Pro</summary>
    <p>Compare today’s eligible lineup using your league’s scoring. Recommendations do not change your Yahoo roster.</p>
    <div>
      {data?.teams.length ? <label>Team <select value={teamId} onChange={(event) => setTeamId(event.target.value)}>
        <option value="">Select a team</option>
        {data.teams.map((team) => <option key={team.id} value={team.id}>{team.name ?? team.id}</option>)}
      </select></label> : null}
      {data?.mode === "categories" ? <label>Individual category <select value={category} onChange={(event) => setCategory(event.target.value)}>
        <option value="">Select a category</option>
        {data.categoryOptions?.map((key) => <option key={key} value={key}>{key.replaceAll("_", " ")}</option>)}
      </select></label> : null}
      <button type="button" onClick={load} disabled={busy}>{busy ? "Loading Yahoo…" : "Refresh today’s comparison"}</button>
    </div>
    {error ? <p role="alert">{error} <Link href="/account">Account settings</Link></p> : null}
    {data ? <div aria-live="polite">
      <p>{data.date} · {data.teamName ?? "Choose your team"}{data.category ? ` · ${data.category.replaceAll("_", " ")}` : ""}</p>
      {data.lineup ? <>
        <h3>{data.lineup.status === "complete" ? "Highest projected value for today’s eligible slots" : "Incomplete lineup comparison"}</h3>
        <p>Roster: {data.rosterFetchedAt ?? "Timestamp unavailable"} · Settings: {data.settingsFetchedAt ?? "Timestamp unavailable"}</p>
        {data.roster?.some((player) => player.valueBasis === "no_game") ? <p>
          No game today: {data.roster.filter((player) => player.valueBasis === "no_game").map((player) => player.name).join(", ")}. These players contribute zero today.
        </p> : null}
        <ul>{data.lineup.assignments.map((row) => <li key={row.id}>
          {row.position}: {row.playerId ? names.get(row.playerId) ?? row.playerId : "Empty"}
          {row.value !== null ? ` · ${row.value.toFixed(2)}` : " · Expected value unavailable"}
          {row.preserved ? " · Current position preserved" : ""}
        </li>)}</ul>
        <h3>Streaming shortlist</h3>
        <p>Checks up to 100 players on Yahoo’s available list, including waivers, and compares those with today’s projections. A player must be usable today to receive an incremental value.</p>
        {data.streamingCoverage ? <p>{data.streamingCoverage.playersChecked} available players checked · {data.streamingCoverage.matchedToday} matched to today’s projections.</p> : null}
        <p>Availability: {data.availabilityFetchedAt ?? "Timestamp unavailable"}</p>
        <ul>{data.streaming?.slice(0, 10).map((row) => <li key={row.playerId}>
          {row.name} · {row.availability.replaceAll("_", " ")} · {row.incrementalValue === null ? "Today’s gain unavailable" : `${row.incrementalValue.toFixed(2)} incremental value`}
          {row.dropPlayerId ? <span> · Requires dropping {names.get(row.dropPlayerId) ?? row.dropPlayerId}</span> : null}
          {row.limitations.length ? <ul>{row.limitations.map((message) => <li key={message}>{message}</li>)}</ul> : null}
        </li>)}</ul>
      </> : null}
      <ul>{data.limitations.map((message) => <li key={message}>{message}</li>)}</ul>
    </div> : null}
  </details>;
}
