import React from "react";
import { DateRangeMatrixInternal } from "./index";
import type { Mode, TOIData } from "./index";
import type { PlayerData } from "./utilities";

type Props = {
  teamId: number;
  teamName: string;
  roster: PlayerData[];
  toiData: TOIData[];
  mode: Mode;
  homeAwayInfo?: { gameId: number; homeOrAway: string }[];
  playerATOI: Record<number, string>;
  loading: boolean;
  lines: PlayerData[][];
  pairs: PlayerData[][];
};

export default function DateRangeMatrixView({
  teamId,
  teamName,
  roster,
  toiData,
  mode,
  homeAwayInfo = [],
  playerATOI,
  loading,
  lines,
  pairs,
}: Props) {
  return (
    <div>
      {!loading && (
        <DateRangeMatrixInternal
          teamId={teamId}
          teamName={teamName}
          roster={roster}
          toiData={toiData}
          mode={mode}
          homeAwayInfo={homeAwayInfo}
          playerATOI={playerATOI}
          loading={loading}
          lines={lines}
          pairs={pairs}
        />
      )}
    </div>
  );
}

