import { useEffect, useState } from "react";
import { getAllPlayers } from "lib/NHL/API";
import type { Player } from "pages/api/v1/player/[id]";

export default function usePlayers() {
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    let mounted = true;

    getAllPlayers().then((players) => {
      if (mounted) {
        setPlayers(players);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  return players;
}
