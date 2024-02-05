import React, { useState, useEffect } from "react";
import styles from "../styles/shotMap.module.scss";
import Fetch from "lib/cors-fetch";

function ShotMap() {
  const [startDate, setStartDate] = useState("");
  const [gameIds, setGameIds] = useState({});
  const [fetching, setFetching] = useState(true);
  const [endDate, setEndDate] = useState("");
  const [playData, setPlayData] = useState({});

  const heatMapResolution = { x: 90, y: 45 }; // Heat map resolution

  let shotsHeatMap = Array.from({ length: heatMapResolution.y }, () =>
    Array.from({ length: heatMapResolution.x }, () => 0)
  );
  let goalsHeatMap = Array.from({ length: heatMapResolution.y }, () =>
    Array.from({ length: heatMapResolution.x }, () => 0)
  );

  const iceSurfaceWidth = 198.5; // Adjusted playable length of the rink
  const iceSurfaceHeight = 84; // Adjusted playable width of the rink
  const xOffset = 1;
  const yOffset = 1;

  function convertToSVGCoordinates(x, y) {
    // Transform real-world rink coordinates to SVG coordinates
    const svgX = ((x + 101) / 202) * iceSurfaceWidth + xOffset;
    const svgY = ((-y + 43.5) / 87) * iceSurfaceHeight + yOffset;
    return { svgX, svgY };
  }

  useEffect(() => {
    async function fetchStartDate() {
      const response = await Fetch(
        "https://api-web.nhle.com/v1/schedule/now"
      ).then((res) => res.json());
      setStartDate(response.regularSeasonStartDate);
      fetchGameData(response.regularSeasonStartDate);
    }

    fetchStartDate();
  }, []);

  async function fetchGameData(date) {
    const response = await Fetch(
      `https://api-web.nhle.com/v1/schedule/${date}`
    ).then((res) => res.json());

    const newGameIds = { ...gameIds };
    response.gameWeek.forEach((week) => {
      week.games.forEach(async (game) => {
        if (!newGameIds[week.date]) {
          newGameIds[week.date] = [];
        }
        newGameIds[week.date].push(game.id);

        const playDataResponse = await Fetch(
          `https://api-web.nhle.com/v1/gamecenter/${game.id}/play-by-play`
        ).then((res) => res.json());

        const extractedPlayData = extractPlayDetails(playDataResponse.plays);
        setPlayData((prevPlayData) => ({
          ...prevPlayData,
          [game.id]: extractedPlayData,
        }));
      });
    });

    setGameIds(newGameIds);

    if (new Date(response.nextStartDate) <= new Date()) {
      fetchGameData(response.nextStartDate);
    } else {
      setFetching(false);
      setEndDate(date);
    }
  }

  function extractPlayDetails(plays) {
    if (!Array.isArray(plays)) {
      return [];
    }

    const relevantPlays = plays.filter(
      (play) =>
        play.typeDescKey === "shot-on-goal" || play.typeDescKey === "goal"
    );

    return relevantPlays.map((play) => {
      const details = {
        xCoord: play.details.xCoord,
        yCoord: play.details.yCoord,
        shootingPlayerId: play.details.shootingPlayerId,
        goalieInNetId: play.details.goalieInNetId,
        shotType: play.details.shotType,
        homeTeamDefendingSide: play.homeTeamDefendingSide,
        zoneCode: play.details.zoneCode,
        isGoal: play.typeDescKey === "goal",
      };

      if (play.typeDescKey === "goal") {
        details.assist1PlayerId = play.details.assist1PlayerId || null;
        details.assist2PlayerId = play.details.assist2PlayerId || null;
      }

      return details;
    });
  }

  function aggregateDataIntoHeatMaps() {
    // Reset the heat maps to zero
    shotsHeatMap = shotsHeatMap.map((row) => row.map(() => 0));
    goalsHeatMap = goalsHeatMap.map((row) => row.map(() => 0));

    Object.values(playData)
      .flat()
      .forEach((play) => {
        const { svgX, svgY } = convertToSVGCoordinates(
          play.xCoord,
          play.yCoord
        );
        const xIndex = Math.floor(
          svgX / (iceSurfaceWidth / heatMapResolution.x)
        );
        const yIndex = Math.floor(
          svgY / (iceSurfaceHeight / heatMapResolution.y)
        );

        if (
          xIndex >= 0 &&
          xIndex < heatMapResolution.x &&
          yIndex >= 0 &&
          yIndex < heatMapResolution.y
        ) {
          shotsHeatMap[yIndex][xIndex]++;
          if (play.isGoal) {
            goalsHeatMap[yIndex][xIndex]++;
          }
        }
      });
  }

  function getColorForDensity(density, isGoal = false) {
    const maxDensity = Math.max(
      ...(isGoal ? goalsHeatMap : shotsHeatMap).flat()
    );
    const intensity = density / maxDensity;

    // Set a minimum opacity level (e.g., 0.5) to ensure visibility
    const minOpacity = 0.5;
    const opacity = Math.max(intensity, minOpacity);

    return isGoal
      ? `rgba(0, 0, 255, ${opacity})`
      : `rgba(255, 0, 0, ${opacity})`; // Blue for goals, red for shots
  }

  function hexagonPoints(centerX, centerY, size) {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angleDeg = 60 * i - 30;
      const angleRad = (Math.PI / 180) * angleDeg;
      points.push(centerX + size * Math.cos(angleRad));
      points.push(centerY + size * Math.sin(angleRad));
    }
    return points.join(" ");
  }

  const [tooltipData, setTooltipData] = useState(null);

  function handleMouseEnter(event, xIndex, yIndex, shots, goals) {
    event.persist(); // Persist the event
    const xG = goals === 0 ? 0 : (shots / goals).toFixed(2);
    const rect = event.target.getBoundingClientRect();

    setTooltipData({
      x: xIndex,
      y: yIndex,
      shots,
      goals,
      xG,
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
    });
  }

  function handleMouseLeave() {
    setTooltipData(null);
  }

  const renderTooltip = () => {
    if (!tooltipData) return null;

    return (
      <div
        style={{
          position: "absolute",
          top: `${tooltipData.top}px`,
          left: `${tooltipData.left}px`,
          backgroundColor: "white",
          border: "1px solid black",
          padding: "10px",
          borderRadius: "5px",
          pointerEvents: "none", // Ensures the tooltip doesn't interfere with mouse events
        }}
      >
        Coordinate: ({tooltipData.x}, {tooltipData.y})
        <br />
        Total Shots: {tooltipData.shots}
        <br />
        Total Goals: {tooltipData.goals}
        <br />
        Coordinate xG: {tooltipData.xG}
      </div>
    );
  };

  const renderHeatMap = () => {
    aggregateDataIntoHeatMaps();

    const hexagonFullWidth = iceSurfaceWidth / heatMapResolution.x;
    const hexagonFullHeight = iceSurfaceHeight / (heatMapResolution.y * 0.75); // Adjust for vertical overlap
    const hexagonSize = hexagonFullWidth / 2;

    return shotsHeatMap.flatMap((row, yIndex) =>
      row.map((shots, xIndex) => {
        const goals = goalsHeatMap[yIndex][xIndex];

        // Calculate center positions for hexagons
        let centerX = xIndex * hexagonFullWidth + hexagonSize;
        let centerY = yIndex * hexagonFullHeight * 0.75 + hexagonFullHeight / 2;

        // Stagger every other row by half the width of a hexagon
        if (yIndex % 2 === 1) {
          centerX += hexagonSize;
        }

        const shotPoints = hexagonPoints(centerX, centerY, hexagonSize);
        const goalPoints =
          goals > 0 ? hexagonPoints(centerX, centerY, hexagonSize * 0.5) : null;

        return (
          <React.Fragment key={`${xIndex}-${yIndex}`}>
            <polygon
              points={shotPoints}
              fill={getColorForDensity(shots)}
              onMouseEnter={(e) =>
                handleMouseEnter(e, xIndex, yIndex, shots, goals)
              }
              onMouseLeave={handleMouseLeave}
            />
            {goalPoints && (
              <polygon
                points={goalPoints}
                fill={getColorForDensity(goals, true)}
              />
            )}
          </React.Fragment>
        );
      })
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.contentAbove}>
        <p>
          {startDate ? `Regular Season Start Date: ${startDate}` : "Loading..."}
        </p>
        {!fetching && (
          <p>
            Finished collecting Game IDs for {startDate} to {endDate}
          </p>
        )}
      </div>
      <svg
        id="ice-hockey-svg"
        xmlns="http://www.w3.org/2000/svg"
        className={styles.hockeyRink}
        viewBox="0 0 202 87"
      >
        <g id="transformations">
          <clipPath id="clipBorder">
            <path
              d="M 0 28
                    A 28 28 0 0 1 28 0
                    L 172 0
                    A 28 28 0 0 1 200 28
                    L 200 57
                    A 28 28 0 0 1 172 85
                    L 29 85
                    A 28 28 0 0 1 0 57
                    L 0 28"
            />
          </clipPath>
          <path
            id="background"
            d="M 0 28
                A 28 28 0 0 1 28 0
                L 172 0
                A 28 28 0 0 1 200 28
                L 200 57
                A 28 28 0 0 1 172 85
                L 29 85
                A 28 28 0 0 1 0 57
                L 0 28"
            fill="white"
          />
          <path
            id="center-line"
            d="M 100 0
                  L 100 85"
            stroke="#C8102e"
            strokeWidth="1"
          />
          <path
            id="center-line-decor"
            d="
                  M 100 2
                  L 100 5
                  M 100 8
                  L 100 11
                  M 100 14
                  L 100 17
                  M 100 20
                  L 100 23
                  M 100 26
                  L 100 29
                  M 100 32
                  L 100 35
                  M 100 38
                  L 100 41
                  M 100 44
                  L 100 47
                  M 100 50
                  L 100 53
                  M 100 56
                  L 100 59
                  M 100 62
                  L 100 65
                  M 100 68
                  L 100 71
                  M 100 74
                  L 100 77
                  M 100 80
                  L 100 83
                  "
            stroke="white"
            strokeWidth=".25"
          />
          <g id="goal-lines">
            <path
              id="left-goal-line"
              d="M 11 6
                    L 11 79"
              stroke="#C8102e"
              strokeWidth="0.166667"
            />
            <path
              id="right-goal-line"
              d="M 189 6
                    L 189 79"
              stroke="#C8102e"
              strokeWidth="0.166667"
            />
          </g>
          <g id="goal-creases">
            <g id="left-goalie-crease">
              <path
                d="
                          M 0 56.5
                          L 11 53.5
                          M 0 28.5
                          L 11 31.5"
                stroke="#C8102e"
                strokeWidth="0.1667"
              />
              <path
                id="left-goal-crease"
                d="
                          M 11 38.5
                          L 15.5 38.5
                          A 6 6 0 0 1 15.5 46.5
                          L 11 46.5
                          M 15 38.5
                          L 15 38.9166667
                          M 15 46.5
                          L 15 46.08333333"
                stroke="#C8102e"
                fill="#E6F9FF"
                strokeWidth="0.1667"
              />
              <path
                id="left-goal"
                d="
                          M 11 39.5
                          L 9 39.5
                          A 5 5 0 0 0 9 45.5
                          L 11 45.5"
                stroke="black"
                fill="transparent"
                strokeWidth="0.1667"
              />
            </g>
            <g id="right-goalie-crease">
              <path
                d="
                          M 200 56.5
                          L 189 53.5
                          M 200 28.5
                          L 189 31.5"
                stroke="#C8102e"
                strokeWidth="0.1667"
              />
              <path
                id="right-goal-crease"
                d="
                          M 189 38.5
                          L 184.5 38.5
                          A 6 6 0 0 0 184.5 46.5
                          L 189 46.5
                          M 185 38.5
                          L 185 38.9166667
                          M 185 46.5
                          L 185 46.08333333"
                stroke="#C8102e"
                fill="#E6F9FF"
                strokeWidth="0.1667"
              />
              <path
                id="right-goal"
                d="
                          M 189 39.5
                          L 191 39.5
                          A 5 5 0 0 1 191 45.5
                          L 189 45.5"
                stroke="black"
                fill="transparent"
                strokeWidth="0.1667"
              />
            </g>
          </g>
          <g id="blue-lines">
            <path
              id="left-blue-line"
              d="M 75 0
                  L 75 85"
              stroke="#0033A0"
              strokeWidth="1"
            />
            <path
              id="right-blue-line"
              d="M 125 0
                  L 125 85"
              stroke="#0033A0"
              strokeWidth="1"
            />
          </g>
          <g id="center-faceoff-spots">
            <circle
              id="top-left-spot"
              cx="80"
              cy="20.5"
              r="1"
              stroke="#C8102e"
              strokeWidth="0.1667"
              fill="transparent"
            />
            <rect x="79.4" y="19.57" width="1.2" height="1.85" fill="#C8102e" />
            <circle
              id="top-right-spot"
              cx="120"
              cy="20.5"
              r="1"
              stroke="#C8102e"
              strokeWidth="0.1667"
              fill="transparent"
            />
            <rect
              x="119.4"
              y="19.57"
              width="1.2"
              height="1.85"
              fill="#C8102e"
            />
            <circle
              id="bottom-left-spot"
              cx="80"
              cy="64.5"
              r="1"
              stroke="#C8102e"
              strokeWidth="0.1667"
              fill="transparent"
            />
            <rect x="79.4" y="63.57" width="1.2" height="1.85" fill="#C8102e" />
            <circle
              id="bottom-right-spot"
              cx="120"
              cy="64.5"
              r="1"
              stroke="#C8102e"
              strokeWidth="0.1667"
              fill="transparent"
            />
            <rect
              x="119.4"
              y="63.57"
              width="1.2"
              height="1.85"
              fill="#C8102e"
            />
          </g>
          <g id="center-circles">
            <circle
              id="outer-center-circle"
              cx="100"
              cy="42.5"
              r="15"
              stroke="#0033A0"
              strokeWidth="0.1666667"
              fill="transparent"
            />
            <circle
              id="middle-center-circle"
              cx="100"
              cy="42.5"
              r=".5"
              fill="#0033A0"
            />
          </g>
          <g id="faceoff-circles">
            <g id="bottom-left-faceoff-circle">
              <circle
                id="center-circle"
                cx="31"
                cy="64.5"
                r="1"
                stroke="#C8102e"
                strokeWidth="0.1667"
                fill="transparent"
              />
              <rect
                x="30.4"
                y="63.57"
                width="1.2"
                height="1.85"
                fill="#C8102e"
              />
              <circle
                id="center-circle"
                cx="31"
                cy="64.5"
                r="15"
                stroke="#C8102e"
                fill="transparent"
                strokeWidth=".16667"
              />
              <path
                d="
                    M 28.125 49.75
                    L 28.125 47.75
                    M 33.875 49.75
                    L 33.875 47.75
                    M 28.125 79.25
                    L 28.125 81.25
                    M 33.875 79.25
                    L 33.875 81.25
                    "
                stroke="#C8102e"
                fill="transparent"
                strokeWidth=".16667"
              />
              <path
                d="M 25 65.3333333
                      L 28.9166667 65.3333333
                      L 28.9166667 68.25
                      M 28.9166667 60.75
                      L 28.9166667 63.6666667
                      L 25 63.6666667
                      M 37 65.3333333
                      L 33.08333333 65.3333333
                      L 33.08333333 68.25
                      M 33.08333333 60.75
                      L 33.08333333 63.6666667
                      L 37 63.6666667
                      "
                stroke="#C8102e"
                fill="transparent"
                strokeWidth=".16667"
              />
            </g>
            <g id="bottom-right-faceoff-circle">
              <circle
                id="center-circle"
                cx="169"
                cy="64.5"
                r="1"
                stroke="#C8102e"
                strokeWidth="0.1667"
                fill="transparent"
              />
              <rect
                x="168.4"
                y="63.57"
                width="1.2"
                height="1.85"
                fill="#C8102e"
              />
              <circle
                id="center-circle"
                cx="169"
                cy="64.5"
                r="15"
                stroke="#C8102e"
                fill="transparent"
                strokeWidth=".16667"
              />
              <path
                d="
                    M 166.125 49.75
                    L 166.125 47.75
                    M 171.875 49.75
                    L 171.875 47.75
                    M 166.125 79.25
                    L 166.125 81.25
                    M 171.875 79.25
                    L 171.875 81.25
                    "
                stroke="#C8102e"
                fill="transparent"
                strokeWidth=".16667"
              />
              <path
                d="M 163 65.3333333
                      L 166.9166667 65.3333333
                      L 166.9166667 68.25
                      M 166.9166667 60.75
                      L 166.9166667 63.6666667
                      L 163 63.6666667
                      M 175 65.3333333
                      L 171.08333333 65.3333333
                      L 171.08333333 68.25
                      M 171.08333333 60.75
                      L 171.08333333 63.6666667
                      L 175 63.6666667
                      "
                stroke="#C8102e"
                fill="transparent"
                strokeWidth=".16667"
              />
            </g>
            <g id="top-right-faceoff-circle">
              <circle
                id="center-circle"
                cx="169"
                cy="20.5"
                r="1"
                stroke="#C8102e"
                strokeWidth="0.1667"
                fill="transparent"
              />
              <rect
                x="168.4"
                y="19.57"
                width="1.2"
                height="1.85"
                fill="#C8102e"
              />
              <circle
                id="center-circle"
                cx="169"
                cy="20.5"
                r="15"
                stroke="#C8102e"
                fill="transparent"
                strokeWidth=".16667"
              />
              <path
                d="
                    M 166.125 5.75
                    L 166.125 3.75
                    M 171.875 5.75
                    L 171.875 3.75
                    M 166.125 35.25
                    L 166.125 37.25
                    M 171.875 35.25
                    L 171.875 37.25
                    "
                stroke="#C8102e"
                fill="transparent"
                strokeWidth=".16667"
              />
              <path
                d="M 163 21.3333333
                      L 166.9166667 21.3333333
                      L 166.9166667 24.25
                      M 166.9166667 16.75
                      L 166.9166667 19.6666667
                      L 163 19.6666667
                      M 175 21.3333333
                      L 171.08333333 21.3333333
                      L 171.08333333 24.25
                      M 171.08333333 16.75
                      L 171.08333333 19.6666667
                      L 175 19.6666667
                      "
                stroke="#C8102e"
                fill="transparent"
                strokeWidth=".16667"
              />
            </g>
            <g id="top-left-faceoff-circle">
              <circle
                id="center-circle"
                cx="31"
                cy="20.5"
                r="1"
                stroke="#C8102e"
                strokeWidth="0.1667"
                fill="transparent"
              />
              <rect
                x="30.4"
                y="19.57"
                width="1.2"
                height="1.85"
                fill="#C8102e"
              />
              <circle
                id="center-circle"
                cx="31"
                cy="20.5"
                r="15"
                stroke="#C8102e"
                fill="transparent"
                strokeWidth=".16667"
              />
              <path
                d="
                    M 28.125 5.75
                    L 28.125 3.75
                    M 33.875 5.75
                    L 33.875 3.75
                    M 28.125 35.25
                    L 28.125 37.25
                    M 33.875 35.25
                    L 33.875 37.25
                    "
                stroke="#C8102e"
                fill="transparent"
                strokeWidth=".16667"
              />
              <path
                d="M 25 21.3333333
                      L 28.9166667 21.3333333
                      L 28.9166667 24.25
                      M 28.9166667 16.75
                      L 28.9166667 19.6666667
                      L 25 19.6666667
                      M 37 21.3333333
                      L 33.08333333 21.3333333
                      L 33.08333333 24.25
                      M 33.08333333 16.75
                      L 33.08333333 19.6666667
                      L 37 19.6666667
                      "
                stroke="#C8102e"
                fill="transparent"
                strokeWidth=".16667"
              />
            </g>
          </g>
          <path
            id="scorekeeper"
            d="M 90 85 A 10 10 0 0 1 110 85"
            strokeWidth="0.16667"
            fill="transparent"
            stroke="#C8102e"
          />
          <path
            id="outside-perimeter"
            d="M 0 28
                A 28 28 0 0 1 28 0
                L 172 0
                A 28 28 0 0 1 200 28
                L 200 57
                A 28 28 0 0 1 172 85
                L 29 85
                A 28 28 0 0 1 0 57
                L 0 28"
            stroke="black"
            fill="transparent"
            strokeWidth="1"
          />
        </g>

        {renderHeatMap()}
        {renderTooltip()}
      </svg>
    </div>
  );
}

export default ShotMap;
