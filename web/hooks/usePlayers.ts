import { useEffect, useState } from "react";
import type { Player } from "lib/NHL/types";
import { getAllPlayers } from "lib/NHL/client";

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
