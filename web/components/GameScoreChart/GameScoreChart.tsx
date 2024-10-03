// web/components/GameScoreChart.tsx

import React, { useRef, useEffect } from "react";
import * as d3 from "d3";
import { CombinedGameLog } from "lib/supabase/utils/types";

interface GameScoreChartProps {
  data: CombinedGameLog[];
  width?: number;
  height?: number;
}

const GameScoreChart: React.FC<GameScoreChartProps> = ({
  data,
  width = 800,
  height = 400,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    // Clear the SVG
    d3.select(svgRef.current).selectAll("*").remove();

    // Check if data is available
    if (data.length === 0) {
      return;
    }

    // Set up margins and dimensions
    const margin = { top: 20, right: 30, bottom: 50, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create scales
    const xScale = d3
      .scaleTime()
      .domain(d3.extent(data, (d) => new Date(d.date)) as [Date, Date])
      .range([0, innerWidth]);

    const yMax = d3.max(data, (d) =>
      Math.max(d.gameScore ?? 0, d.predictedGameScore ?? 0)
    )!;
    const yScale = d3
      .scaleLinear()
      .domain([0, yMax * 1.2])
      .range([innerHeight, 0]);

    // Create line generators
    const actualLine = d3
      .line<CombinedGameLog>()
      .x((d) => xScale(new Date(d.date)))
      .y((d) => yScale(d.gameScore ?? 0))
      .curve(d3.curveMonotoneX);

    const predictedLine = d3
      .line<CombinedGameLog>()
      .x((d) => xScale(new Date(d.date)))
      .y((d) => yScale(d.predictedGameScore ?? 0))
      .curve(d3.curveMonotoneX);

    // Create SVG container
    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // Append group element
    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Add actual gameScore line
    g.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#0074d9")
      .attr("stroke-width", 2)
      .attr("d", actualLine)
      .attr("class", "actual-line");

    // Add predicted gameScore line
    g.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#ff4136")
      .attr("stroke-width", 2)
      .attr("d", predictedLine)
      .attr("class", "predicted-line");

    // Add X Axis
    const xAxis = d3
      .axisBottom<Date>(xScale)
      .ticks(6)
      .tickFormat(d3.timeFormat("%b %d") as any);
    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll("text")
      .attr("transform", "rotate(45)")
      .style("text-anchor", "start");

    // Add Y Axis
    const yAxis = d3.axisLeft(yScale);
    g.append("g").call(yAxis);

    // Add X Axis Label
    svg
      .append("text")
      .attr(
        "transform",
        `translate(${width / 2}, ${height - margin.bottom / 2})`
      )
      .style("text-anchor", "middle")
      .text("Date");

    // Add Y Axis Label
    svg
      .append("text")
      .attr(
        "transform",
        `translate(${margin.left / 2}, ${height / 2}) rotate(-90)`
      )
      .style("text-anchor", "middle")
      .text("GameScore");

    // Add Legend
    const legend = svg
      .append("g")
      .attr("transform", `translate(${width - 150}, ${margin.top})`);

    legend
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", 140)
      .attr("height", 50)
      .attr("fill", "white")
      .attr("stroke", "black");

    legend
      .append("line")
      .attr("x1", 10)
      .attr("y1", 15)
      .attr("x2", 30)
      .attr("y2", 15)
      .attr("stroke", "#0074d9")
      .attr("stroke-width", 2);

    legend
      .append("text")
      .attr("x", 40)
      .attr("y", 20)
      .text("Actual GameScore")
      .attr("font-size", "12px");

    legend
      .append("line")
      .attr("x1", 10)
      .attr("y1", 35)
      .attr("x2", 30)
      .attr("y2", 35)
      .attr("stroke", "#ff4136")
      .attr("stroke-width", 2);

    legend
      .append("text")
      .attr("x", 40)
      .attr("y", 40)
      .text("Predicted GameScore")
      .attr("font-size", "12px");
  }, [data, width, height]);

  return <svg ref={svgRef}></svg>;
};

export default GameScoreChart;
