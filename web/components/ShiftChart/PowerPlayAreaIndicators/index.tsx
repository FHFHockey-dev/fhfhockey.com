import { useEffect, useState } from "react";
import Fetch from "lib/cors-fetch";
import getPowerPlayBlocks, {
  Block,
  Time,
  parseTime
} from "utils/getPowerPlayBlocks";
import { teamsInfo } from "lib/NHL/teamsInfo";
import {
  PERIOD_IN_SECONDS,
  PERIOD_LENGTH,
  convertTimeToSeconds
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
  totalGameTimeInSeconds
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

function darkenHexColor(hex: string, percent: number): string {
  if (!hex) return "#000000"; // Return a default color if hex is invalid

  hex = hex.replace("#", "");
  const num = parseInt(hex, 16);

  let r = (num >> 16) - Math.round(((num >> 16) * percent) / 100);
  let g =
    ((num >> 8) & 0x00ff) - Math.round((((num >> 8) & 0x00ff) * percent) / 100);
  let b = (num & 0x00ff) - Math.round(((num & 0x00ff) * percent) / 100);

  r = Math.max(0, r);
  g = Math.max(0, g);
  b = Math.max(0, b);

  return `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function PowerPlayAreaIndicator({
  color,
  start,
  end,
  totalGameTimeInSeconds
}: PowerPlayAreaIndicatorProps) {
  const darkenedColor = darkenHexColor(color, 50);
  const areaStyle = {
    width: getWidthPercentage(start, end, totalGameTimeInSeconds),
    left: getLeftPercentage(start)
  };
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        height: "125%",
        backgroundColor: color,
        opacity: 0.4,
        ...areaStyle
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
