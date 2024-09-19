// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\SkoDashboard\StockChart.tsx

import React, { useEffect, useRef, useState } from "react";
import { Paper, Typography, CircularProgress } from "@mui/material";
import * as d3 from "d3";
import supabase from "lib/supabase";
import { format, parseISO } from "date-fns";
import ResizeObserver from "resize-observer-polyfill"; // Import if using polyfill

// Define the structure of your chart data
interface ChartDataPoint {
  date: string;
  ema_sko: number;
  rolling_avg_sko: number;
  bayesian_sko: number;
}

interface ParsedChartDataPoint {
  date: Date;
  ema_sko: number;
  rolling_avg_sko: number;
  bayesian_sko: number;
}

const StockChart: React.FC = () => {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Function to render the chart
  const renderChart = (
    parsedData: ParsedChartDataPoint[],
    width: number,
    height: number
  ) => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear existing content

    // Set up chart dimensions
    const margin = { top: 20, right: 30, bottom: 50, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Append a group element
    const chart = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Set the ranges
    const x = d3
      .scaleTime()
      .domain(d3.extent(parsedData, (d) => d.date) as [Date, Date])
      .range([0, innerWidth]);

    const y = d3
      .scaleLinear()
      .domain([
        d3.min(parsedData, (d) =>
          Math.min(d.ema_sko, d.rolling_avg_sko, d.bayesian_sko)
        ) || 0,
        d3.max(parsedData, (d) =>
          Math.max(d.ema_sko, d.rolling_avg_sko, d.bayesian_sko)
        ) || 100,
      ])
      .range([innerHeight, 0]);

    // Add the X Axis
    chart
      .append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end");

    // Add the Y Axis
    chart.append("g").call(d3.axisLeft(y));

    // Add gridlines
    chart
      .append("g")
      .attr("class", "grid")
      .call(
        d3
          .axisLeft(y)
          .tickSize(-innerWidth)
          .tickFormat(() => "")
      )
      .style("stroke-opacity", 0.1);

    // Define the lines
    const lineEMA = d3
      .line<ParsedChartDataPoint>()
      .x((d) => x(d.date))
      .y((d) => y(d.ema_sko))
      .curve(d3.curveMonotoneX); // Smooth curve

    const lineRollingAvg = d3
      .line<ParsedChartDataPoint>()
      .x((d) => x(d.date))
      .y((d) => y(d.rolling_avg_sko))
      .curve(d3.curveMonotoneX);

    const lineBayesian = d3
      .line<ParsedChartDataPoint>()
      .x((d) => x(d.date))
      .y((d) => y(d.bayesian_sko))
      .curve(d3.curveMonotoneX);

    // Add the lines
    chart
      .append("path")
      .datum(parsedData)
      .attr("fill", "none")
      .attr("stroke", "#8884d8")
      .attr("stroke-width", 2)
      .attr("d", lineEMA(parsedData)); // Invoke the line generator

    chart
      .append("path")
      .datum(parsedData)
      .attr("fill", "none")
      .attr("stroke", "#82ca9d")
      .attr("stroke-width", 2)
      .attr("d", lineRollingAvg(parsedData)); // Invoke the line generator

    chart
      .append("path")
      .datum(parsedData)
      .attr("fill", "none")
      .attr("stroke", "#ffc658")
      .attr("stroke-width", 2)
      .attr("d", lineBayesian(parsedData)); // Invoke the line generator

    // Add legend
    const legendData = [
      { name: "EMA sKO", color: "#8884d8" },
      { name: "Rolling Avg sKO", color: "#82ca9d" },
      { name: "Bayesian sKO", color: "#ffc658" },
    ];

    const legend = chart
      .selectAll(".legend")
      .data(legendData)
      .enter()
      .append("g")
      .attr("class", "legend")
      .attr("transform", (d, i) => `translate(0,${i * 20})`);

    legend
      .append("rect")
      .attr("x", innerWidth - 18)
      .attr("width", 18)
      .attr("height", 18)
      .style("fill", (d: any) => d.color);

    legend
      .append("text")
      .attr("x", innerWidth - 24)
      .attr("y", 9)
      .attr("dy", ".35em")
      .style("text-anchor", "end")
      .text((d: any) => d.name);
  };

  // Fetch data on mount
  useEffect(() => {
    const fetchChartData = async () => {
      try {
        const { data: chartData, error } = await supabase
          .from("sko_trends")
          .select("date, ema_sko, rolling_avg_sko, bayesian_sko") // Adjust fields as needed
          .order("date", { ascending: true });

        if (error) throw error;

        // Format dates and ensure numerical values are present
        const formattedData: ChartDataPoint[] = chartData.map((item: any) => ({
          date: format(parseISO(item.date), "MM/dd/yyyy"),
          ema_sko: item.ema_sko || 0,
          rolling_avg_sko: item.rolling_avg_sko || 0,
          bayesian_sko: item.bayesian_sko || 0,
        }));

        setData(formattedData);
      } catch (error) {
        console.error("Error fetching chart data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, []);

  // Render chart when data is ready
  useEffect(() => {
    if (loading || data.length === 0) return;

    // Parse data
    const parseDate = d3.timeParse("%m/%d/%Y");
    const parsedData: ParsedChartDataPoint[] = data.map((d) => ({
      date: parseDate(d.date) as Date,
      ema_sko: d.ema_sko,
      rolling_avg_sko: d.rolling_avg_sko,
      bayesian_sko: d.bayesian_sko,
    }));

    // Get container dimensions
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = 500; // Or make it dynamic

    renderChart(parsedData, width, height);
  }, [loading, data]);

  // Initialize ResizeObserver in a separate useEffect
  useEffect(() => {
    if (loading || data.length === 0) return;

    const resizeObserver = new ResizeObserver(() => {
      // Re-render chart on resize
      const parseDate = d3.timeParse("%m/%d/%Y");
      const parsedData: ParsedChartDataPoint[] = data.map((d) => ({
        date: parseDate(d.date) as Date,
        ema_sko: d.ema_sko,
        rolling_avg_sko: d.rolling_avg_sko,
        bayesian_sko: d.bayesian_sko,
      }));

      const container = containerRef.current;
      if (!container) return;

      const width = container.clientWidth;
      const height = 500;

      renderChart(parsedData, width, height);
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
    };
  }, [data, loading]);

  if (loading) {
    return (
      <Paper
        sx={{
          p: 2,
          display: "flex",
          flexDirection: "column",
          height: 500,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <CircularProgress />
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2, display: "flex", flexDirection: "column", height: 500 }}>
      <Typography variant="h6" gutterBottom>
        sKO Trends
      </Typography>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
        <svg ref={svgRef}></svg>
      </div>
    </Paper>
  );
};

export default StockChart;
