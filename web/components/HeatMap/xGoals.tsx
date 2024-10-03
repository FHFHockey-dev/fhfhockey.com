import React, { useEffect, useState, useRef } from "react";
import supabase from "lib/supabase";
import * as d3 from "d3";
import styles from "/styles/teamStats.module.scss";
import HockeyRinkSvg from "../HockeyRinkSvg/HockeyRinkSvg";

const XGoals: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const fetchLeagueData = async () => {
      const { data, error } = await supabase
        .from("shots_goals_by_coord")
        .select("xcoord, ycoord, league_shots, league_goals");

      if (error) {
        console.error("Error fetching league data:", error);
        return;
      }

      setData(data || []);
    };

    fetchLeagueData();
  }, []);

  useEffect(() => {
    if (data.length === 0) return;

    const width = 200; // Hockey rink width
    const height = 85; // Hockey rink height

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear existing content

    // Define a clipPath to limit the heatmap within the rink
    svg
      .append("defs")
      .append("clipPath")
      .attr("id", "rink-clip")
      .append("path")
      .attr(
        "d",
        "M 0 28 A 28 28 0 0 1 28 0 L 172 0 A 28 28 0 0 1 200 28 L 200 57 A 28 28 0 0 1 172 85 L 29 85 A 28 28 0 0 1 0 57 L 0 28"
      ); // Same path as the rink to clip the heatmap

    // Adjust the X and Y coordinate mapping functions for proper alignment
    const mapXCoordinate = (xcoord: number) => {
      return ((xcoord + 100) / 200) * width; // Scale xcoord to the rink width
    };

    const mapYCoordinate = (ycoord: number) => {
      return ((ycoord + 42.5) / 85) * height; // Adjust ycoord based on the rink height
    };

    // Function to transform the coordinates if on the left side
    const processShotCoordinates = (
      xcoord: number,
      ycoord: number
    ): [number, number] => {
      // If xcoord is negative (left side), flip it to the right side
      const transformedX = xcoord < 0 ? -xcoord : xcoord;
      return [transformedX, ycoord]; // Return the new x and original y
    };

    // Prepare shot data points for the heatmap
    const points: [number, number][] = data
      .filter(
        (d) =>
          d.xcoord !== null &&
          d.ycoord !== null &&
          typeof d.xcoord === "number" &&
          typeof d.ycoord === "number"
      )
      .map((d) => processShotCoordinates(d.xcoord, d.ycoord)) // Transform left-side shots
      .map((d) => [mapXCoordinate(d[0]), mapYCoordinate(d[1])]); // Map to the rink's display coordinates

    // Create a density plot using d3.contourDensity
    const density = d3
      .contourDensity<[number, number]>()
      .x((d) => d[0])
      .y((d) => d[1])
      .size([width, height])
      .bandwidth(2.3)(points); // Adjust bandwidth for smoothing

    // Create a color scale for contours
    const color = d3
      .scaleSequential(d3.interpolateTurbo)
      .domain([0, d3.max(density, (d) => d.value) || 1]);

    // Render contours in the SVG, applying the clipPath
    svg
      .append("g")
      .attr("clip-path", "url(#rink-clip)") // Use the clip path to constrain the contours
      .selectAll("path")
      .data(density)
      .enter()
      .append("path")
      .attr("d", d3.geoPath())
      .attr("fill", (d) => color(d.value))
      .attr("stroke", "none")
      .attr("opacity", 0.2); // Adjust opacity for clarity
  }, [data]);

  return (
    <>
      {/* Render the shot heatmap */}
      <HockeyRinkSvg />
      <svg
        ref={svgRef}
        className={styles.heatmapOverlay}
        viewBox={`-5 -10 212 97`} // Adjusted viewBox to match the rink's width and height
        width="100%"
        height="100%"
      ></svg>
    </>
  );
};

export default XGoals;
