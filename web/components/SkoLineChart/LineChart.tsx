// web/components/LineChart.tsx

import React, { useRef, useEffect } from "react";
import * as d3 from "d3";

interface ChartDataPoint {
  date: Date;
  sumOfZScores: number;
}

interface LineChartProps {
  data: ChartDataPoint[];
  thresholds?: { T1: number; T2: number };
  width?: number;
  height?: number;
}

const LineChart: React.FC<LineChartProps> = ({
  data,
  thresholds,
  width = 800,
  height = 400,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    // Clear the SVG
    d3.select(svgRef.current).selectAll("*").remove();

    // Filter out invalid data points
    const validData = data.filter(
      (d) => Number.isFinite(d.sumOfZScores) && !isNaN(d.sumOfZScores)
    );

    // Check if validData is empty
    if (validData.length === 0) {
      console.warn("No valid data points to display in the chart.");
      return;
    }

    // Set up margins and dimensions
    const margin = { top: 20, right: 30, bottom: 50, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create scales
    let yMin = d3.min(validData, (d) => d.sumOfZScores)!;
    let yMax = d3.max(validData, (d) => d.sumOfZScores)!;

    if (thresholds) {
      yMin = Math.min(yMin, thresholds.T1, thresholds.T2);
      yMax = Math.max(yMax, thresholds.T1, thresholds.T2);
    }

    // Prevent yMin and yMax from being equal
    if (yMin === yMax) {
      yMin = yMin - 1;
      yMax = yMax + 1;
    }

    const xScale = d3
      .scaleTime()
      .domain(d3.extent(validData, (d) => d.date) as [Date, Date])
      .range([0, innerWidth]);

    const yScale = d3
      .scaleLinear()
      .domain([yMin, yMax])
      .range([innerHeight, 0]);

    // Create line generator
    const line = d3
      .line<ChartDataPoint>()
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.sumOfZScores))
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

    // Draw shaded regions
    if (thresholds) {
      // Characteristic zone (sum <= T1)
      g.append("rect")
        .attr("x", 0)
        .attr("y", yScale(thresholds.T1))
        .attr("width", innerWidth)
        .attr("height", Math.abs(yScale(yMin) - yScale(thresholds.T1)))
        .attr("fill", "green")
        .attr("opacity", 0.1);

      // Moderately characteristic zone (T1 < sum <= T2)
      g.append("rect")
        .attr("x", 0)
        .attr("y", yScale(thresholds.T2))
        .attr("width", innerWidth)
        .attr("height", Math.abs(yScale(thresholds.T1) - yScale(thresholds.T2)))
        .attr("fill", "yellow")
        .attr("opacity", 0.1);

      // Uncharacteristic zone (sum > T2)
      g.append("rect")
        .attr("x", 0)
        .attr("y", yScale(yMax))
        .attr("width", innerWidth)
        .attr("height", Math.abs(yScale(thresholds.T2) - yScale(yMax)))
        .attr("fill", "red")
        .attr("opacity", 0.1);

      // Draw threshold lines
      [thresholds.T1, thresholds.T2].forEach((threshold) => {
        g.append("line")
          .attr("x1", 0)
          .attr("y1", yScale(threshold))
          .attr("x2", innerWidth)
          .attr("y2", yScale(threshold))
          .attr("stroke", "black")
          .attr("stroke-dasharray", "4");

        // Add text labels
        g.append("text")
          .attr("x", innerWidth - 5)
          .attr("y", yScale(threshold) - 5)
          .attr("text-anchor", "end")
          .attr("font-size", "12px")
          .text(`T${threshold === thresholds.T1 ? "1" : "2"}`);
      });
    }

    // Add the line path
    g.append("path")
      .datum(validData)
      .attr("fill", "none")
      .attr("stroke", "#0074d9")
      .attr("stroke-width", 2)
      .attr("d", line);

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
      .text("Sum of Weighted Squared Z-Scores");
  }, [data, thresholds, width, height]);

  return <svg ref={svgRef}></svg>;
};

export default LineChart;
