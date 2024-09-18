// components/PlayerTable.tsx
import React, { useEffect, useState } from "react";
import { fetchPlayerStats } from "../services/playerService";
import { Player } from "../types/Player";

const PlayerTable: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    const getPlayers = async () => {
      const data = await fetchPlayerStats();
      setPlayers(data);
    };

    getPlayers();
  }, []);

  return (
    <div className="player-table">
      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th>Team</th>
            {/* Add other headers */}
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.id}>
              <td>{player.name}</td>
              <td>{player.team}</td>
              {/* Add other data fields */}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PlayerTable;
