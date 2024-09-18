import React, { useEffect, useState, useRef } from "react";
import supabase from "web/lib/supabase";
import { teamsInfo } from "lib/teamsInfo";
import styles from "../../styles/teamStats.module.scss";
import * as d3 from "d3";
import HockeyRinkSvg from "../HockeyRinkSvg/HockeyRinkSvg";

type HeatMapProps = {
  teamAbbreviation: string;
};

const HeatMap: React.FC<HeatMapProps> = ({ teamAbbreviation }) => {
  const [shots, setShots] = useState<any[]>([]);
  const [selectedSeasons, setSelectedSeasons] = useState<string[]>([
    "20222023",
    "20232024",
  ]);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const fetchShotData = async () => {
      const teamInfo = teamsInfo[teamAbbreviation];

      if (!teamInfo) return;

      const { data: gamesData, error: gamesError } = await supabase
        .from("pbp_games")
        .select("id")
        .or(
          `hometeamabbrev.eq.${teamAbbreviation},awayteamabbrev.eq.${teamAbbreviation}`
        )
        .in("season", selectedSeasons);

      if (gamesError) {
        console.error("Error fetching games:", gamesError);
        return;
      }

      const gameIds = gamesData?.map((game: any) => game.id) || [];

      if (gameIds.length > 0) {
        const { data: playsData, error: playsError } = await supabase
          .from("pbp_plays")
          .select("*")
          .in("gameid", gameIds)
          .or("typedesckey.eq.shot-on-goal,typedesckey.eq.goal")
          .eq("eventownerteamid", teamInfo.id);

        if (playsError) {
          console.error("Error fetching plays:", playsError);
          return;
        }

        setShots(playsData || []);
      }
    };

    fetchShotData();
  }, [teamAbbreviation, selectedSeasons]);

  useEffect(() => {
    if (shots.length === 0) return;

    const width = 212; // Width of the hockey rink SVG
    const height = 97; // Height of the hockey rink SVG

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear existing contents

    // Create a clipPath to limit the contours within the rink
    svg
      .append("defs")
      .append("clipPath")
      .attr("id", "rink-clip")
      .append("path")
      .attr(
        "d",
        "M 0 28 A 28 28 0 0 1 28 0 L 172 0 A 28 28 0 0 1 200 28 L 200 57 A 28 28 0 0 1 172 85 L 29 85 A 28 28 0 0 1 0 57 L 0 28"
      ); // Path for the rink

    const mapXCoordinate = (xcoord: number) => {
      return ((xcoord + 100) / 200) * 200; // Map xcoord to the rink width
    };

    const mapYCoordinate = (ycoord: number) => {
      return ((ycoord + 42.5) / 85) * 85; // Full rink height is 58 units, with a y-offset of 28 units
    };

    // Prepare shot data points in [x, y] format, ensuring no undefined values
    const points: [number, number][] = shots
      .filter(
        (shot) =>
          shot.xcoord !== null &&
          shot.ycoord !== null &&
          typeof shot.xcoord === "number" &&
          typeof shot.ycoord === "number"
      )
      .map((shot) => [
        mapXCoordinate(shot.xcoord),
        mapYCoordinate(shot.ycoord),
      ]) as [number, number][]; // Ensuring points are strictly [number, number] pairs

    // Create a density plot using d3.contourDensity
    const density = d3
      .contourDensity<[number, number]>()
      .x((d) => d[0]) // X coordinate
      .y((d) => d[1]) // Y coordinate
      .size([width, height]) // Set width and height of the plot
      .bandwidth(2.3)(points); // Bandwidth determines the smoothing level of contours

    // Create a color scale for contours
    const color = d3
      .scaleSequential(d3.interpolateTurbo)
      .domain([0, d3.max(density, (d) => d.value) || 1]);

    // Render contours in the SVG
    svg
      .append("g")
      .attr("clip-path", "url(#rink-clip)") // Use the clip path to constrain the contours
      .selectAll("path")
      .data(density)
      .enter()
      .append("path")
      .attr("d", d3.geoPath())
      .attr("fill", (d) => color(d.value)) // Color based on density value
      .attr("stroke", "none")
      .attr("opacity", 0.1); // Reduced opacity for better visibility of rink
  }, [shots]);

  const handleSeasonToggle = (season: string) => {
    setSelectedSeasons((prevSeasons) =>
      prevSeasons.includes(season)
        ? prevSeasons.filter((s) => s !== season)
        : [...prevSeasons, season]
    );
  };

  return (
    <>
      {/* Dropdown to select seasons */}
      <div className={styles.seasonDropdown}>
        <label>
          <input
            type="checkbox"
            checked={selectedSeasons.includes("20222023")}
            onChange={() => handleSeasonToggle("20222023")}
          />
          2022-23
        </label>
        <label>
          <input
            type="checkbox"
            checked={selectedSeasons.includes("20232024")}
            onChange={() => handleSeasonToggle("20232024")}
          />
          2023-24
        </label>
      </div>

      {/* Render the shot heatmap */}
      <HockeyRinkSvg />
      <svg
        ref={svgRef}
        className={styles.heatmapOverlay}
        viewBox={`-5 -5 212 97`}
        width="100%"
        height="100%"
      ></svg>
    </>
  );
};

export default HeatMap;
