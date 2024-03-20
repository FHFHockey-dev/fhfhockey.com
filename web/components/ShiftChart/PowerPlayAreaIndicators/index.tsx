import { useEffect, useState } from "react";
import Fetch from "lib/cors-fetch";
import getPowerPlayBlocks, {
  Block,
  Time,
  parseTime,
} from "utils/getPowerPlayBlocks";
import { teamsInfo } from "web/lib/NHL/teamsInfo";
import {
  PERIOD_IN_SECONDS,
  PERIOD_LENGTH,
  convertTimeToSeconds,
} from "hooks/useGoals";

type Props = {
  id: number;
  totalGameTimeInSeconds: number;
};

function getAreaColor(teamId: number) {
  const teams = Object.values(teamsInfo);
  return teams.find((team) => team.id === teamId)?.accent ?? "#E9072B";
}

export default function PowerPlayAreaIndicators({
  id,
  totalGameTimeInSeconds,
}: Props) {
  const [powerPlays, setPowerPlays] = useState<Block[]>([]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setPowerPlays([]);
      try {
        const { plays } = await Fetch(
          `https://api-web.nhle.com/v1/gamecenter/${id}/play-by-play`
        ).then((res) => res.json());

        const blocks = getPowerPlayBlocks(plays);
        setPowerPlays(blocks);
      } catch (e: any) {
        console.error("Error when obtain play by play data", e);
        setPowerPlays([]);
      }
    })();
  }, [id]);

  return (
    <>
      {powerPlays.map((powerPlay, i) => (
        <PowerPlayAreaIndicator
          key={i}
          color={getAreaColor(powerPlay.teamId)}
          totalGameTimeInSeconds={totalGameTimeInSeconds}
          {...powerPlay}
        />
      ))}
    </>
  );
}

type PowerPlayAreaIndicatorProps = {
  color: string;
  start: Time;
  end: Time;
  totalGameTimeInSeconds: number;
};

function PowerPlayAreaIndicator({
  color,
  start,
  end,
  totalGameTimeInSeconds,
}: PowerPlayAreaIndicatorProps) {
  const areaStyle = {
    width: getWidthPercentage(start, end, totalGameTimeInSeconds),
    left: getLeftPercentage(start),
  };
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        height: "100%",
        backgroundColor: color,
        opacity: 0.6,
        ...areaStyle,
      }}
    >
      {/* {color}, {start.timeInPeriod} {end.timeInPeriod} */}
    </div>
  );
}

function getLeftPercentage(time: Time) {
  const leftPercentage = `${
    ((convertTimeToSeconds(time.timeInPeriod) / PERIOD_IN_SECONDS) *
      PERIOD_LENGTH +
      PERIOD_LENGTH * (time.period - 1)) *
    100
  }%`;

  return leftPercentage;
}

function getWidthPercentage(
  start: Time,
  end: Time,
  totalGameTimeInSeconds: number
) {
  let duration = 0;
  if (start.period === end.period) {
    duration =
      convertTimeToSeconds(end.timeInPeriod) -
      convertTimeToSeconds(start.timeInPeriod);
  } else {
    // `start` cannot be OT
    const startTimeInSeconds = parseTime(start.timeInPeriod);
    duration = PERIOD_IN_SECONDS - startTimeInSeconds;
    duration += convertTimeToSeconds(end.timeInPeriod);
  }

  return `${(duration / totalGameTimeInSeconds) * 100}%`;
}
