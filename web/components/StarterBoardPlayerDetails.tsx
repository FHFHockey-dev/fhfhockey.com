import { useState, type ReactNode } from "react";
import useSWR from "swr";
import supabase from "lib/supabase/client";
import { PlayerLineupDeploymentGrid, type PlayerLineupDeploymentTally } from "./PlayerStats/PlayerLineupDeploymentGrid";

export async function fetchStarterBoardDeployment([, playerId, season]: readonly [string, number, number]) {
  const { data, error } = await supabase
    .from("player_lineup_deployment_tallies")
    .select("season_id,deployment_group,deployment_code,deployment_label,games,total_games,share,last_game_date")
    .eq("player_id", playerId)
    .eq("game_type", 2)
    .in("season_id", [season, season - 10001])
    .order("season_id", { ascending: false })
    .order("deployment_code", { ascending: true })
    .limit(40);
  if (error) throw error;
  const latestSeason = data?.[0]?.season_id;
  return (data ?? []).filter((row): row is typeof row & PlayerLineupDeploymentTally =>
    row.season_id === latestSeason && ["forward", "defense", "power_play"].includes(row.deployment_group));
}

export default function StarterBoardPlayerDetails({
  playerId, positions, date, className, children,
}: {
  playerId: number;
  positions: readonly string[];
  date: string;
  className: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const year = Number(date.slice(0, 4)) - (Number(date.slice(5, 7)) < 7 ? 1 : 0);
  const season = year * 10000 + year + 1;
  const isSkater = !positions.includes("G");
  const { data, error, mutate } = useSWR(
    open && isSkater && year > 0 ? ["starter-board-deployment", playerId, season] as const : null,
    fetchStarterBoardDeployment,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );
  const throughDate = data?.reduce((latest, row) => row.last_game_date && row.last_game_date > latest ? row.last_game_date : latest, "");
  const seasonLabel = data?.[0] ? `${String(data[0].season_id).slice(0, 4)}–${String(data[0].season_id).slice(6)} · Regular season` : "";

  return (
    <details className={className} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Projection details and evidence</summary>
      {open && isSkater && <>
        {error ? <p role="status">Deployment history unavailable. <button type="button" onClick={() => void mutate()}>Retry</button></p>
          : !data ? <p role="status">Loading deployment history…</p>
          : data.length === 0 ? <p>No recorded deployment for this or the previous season.</p>
          : <>
            <PlayerLineupDeploymentGrid rows={data} positions={positions} compact seasonLabel={seasonLabel} />
            <p>Recorded deployment{throughDate ? ` through ${throughDate}` : ""}; not today’s confirmed lineup.
              {throughDate && throughDate > date ? " These season totals include games after this slate." : ""}</p>
          </>}
      </>}
      {children}
    </details>
  );
}
