import { useEffect, useState } from "react";
import { getPlayer } from "lib/NHL/API";
import type { Player } from "lib/NHL/types";

export default function usePlayer(playerId: number | undefined) {
  const [player, setPlayer] = useState<Player | null>(null);

  useEffect(() => {
    let mounted = true;
    if (playerId) {
      (async () => {
        try {
          const p = await getPlayer(playerId);
          if (mounted) {
            setPlayer(p);
          }
        } catch (e) {
          console.error(e);

          if (mounted) {
            setPlayer(null);
          }
        }
      })();
    }

    return () => {
      mounted = false;
    };
  }, [playerId]);

  return player;
}
