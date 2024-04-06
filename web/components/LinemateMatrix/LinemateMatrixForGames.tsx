import { useEffect, useState } from "react";
import {
  LinemateMatrixInternal,
  PlayerData,
  TOIData,
  getTOIData,
} from "components/LinemateMatrix";

type LinemateMatrixForGamesProps = {
  gameIds: number[];
  teamId: number;
};

export default function LinemateMatrixForGames({
  gameIds,
  teamId,
}: LinemateMatrixForGamesProps) {
  const [toi, setToi] = useState<TOIData[]>([]);
  const [roster, setRoster] = useState<PlayerData[]>([]);
  const [team, setTeam] = useState<{ id: number; name: string }>();
  useEffect(() => {
    (async () => {
      // const teamId = 25;
      // const gameIds = [2023021053, 2023021068, 2023021036];
      const data = await getTOIDataForGames(gameIds, teamId);
      setToi(data.toiData);
      setRoster(data.roster);
      setTeam(data.team);
    })();
  }, [gameIds, teamId]);
  return team !== undefined ? (
    <LinemateMatrixInternal
      teamId={team.id}
      mode="line-combination"
      teamName={team.name}
      toiData={toi}
      roster={roster}
    />
  ) : null;
}
async function getTOIDataForGames(gameIds: number[], teamId: number) {
  const data = await Promise.all(
    gameIds.map((gameId) => getTOIData(gameId, teamId))
  );
  const all = new Map<string, TOIData[]>();
  // teamId => players
  let rosters = new Map<number, MySet<PlayerData>>();
  data.forEach((game) => {
    Object.entries(game.rosters).forEach(([team, players]) => {
      let ps = rosters.get(Number(team));
      if (!ps) {
        ps = new MySet<PlayerData>((p) => p.id);
        rosters.set(Number(team), ps);
      }

      players.forEach((p) => {
        ps!.add(p);
      });
    });
    Object.values(game.toi).forEach((item) => {
      item.forEach((toiInfo) => {
        const key = getKey(toiInfo.p1.id, toiInfo.p2.id);
        const values = all.get(key);
        if (values) {
          values.push(toiInfo);
        } else {
          all.set(key, [toiInfo]);
        }
      });
    });
  });
  // average the toi array
  const avgToi = new Map<string, TOIData>();
  all.forEach((array, key) => {
    const players = { p1: array[0].p1, p2: array[0].p2 };
    avgToi.set(key, {
      toi: getAvg(array),
      ...players,
    });
  });
  return {
    toiData: [...avgToi.values()],
    roster: rosters.get(teamId)?.toArray() ?? [],
    team: data[0].teams.find((team) => team.id === teamId),
  };
}

function getAvg(array: TOIData[]) {
  let sum = 0;
  array.forEach((item) => (sum += item.toi));
  return sum / array.length;
}

function getKey(p1: number, p2: number) {
  return p1 > p2 ? `${p1}-${p2}` : `${p2}-${p1}`;
}

class MySet<T> {
  getKey: (item: T) => string | number;
  data: Map<string | number, T> = new Map<string, T>();
  constructor(getKey: (item: T) => string | number) {
    this.getKey = getKey;
  }
  add(item: T) {
    const key = this.getKey(item);
    this.data.set(key, item);
  }
  remove(item: T) {
    const key = this.getKey(item);
    return this.data.delete(key);
  }

  toArray() {
    return [...this.data.values()];
  }
}
// {'p1-p2':{toi:22, numGames:4}}
