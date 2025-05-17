import * as d3 from "d3";

interface DrawHockeyRinkOptions {
  width?: number; // in pixels
  height?: number; // in pixels
  halfRink?: boolean;
}

/**
 * Draws a detailed NHL hockey rink in the specified container using D3.
 * @param containerSelector - A CSS selector string or HTMLElement for the container.
 * @param options - Optional settings: width, height, halfRink.
 */
export function drawHockeyRink(
  containerSelector: string | HTMLElement,
  options: DrawHockeyRinkOptions = {}
) {
  // Logical rink size (feet)
  const rinkFtW = 200;
  const rinkFtH = 85;
  const cornerRadius = 28;
  const margin = 2; // feet, for border visibility
  // Default canvas size (pixels)
  const pxW = options.width || 1300;
  const pxH = options.height || 552.5;
  const scale = pxW / rinkFtW;
  const halfRink = options.halfRink || false;

  // Remove any previous SVGs
  const container = d3.select(containerSelector as any);
  container.selectAll<SVGSVGElement, unknown>("svg").remove();

  // Adjusted viewBox to include margin
  const viewBoxW = (halfRink ? rinkFtW / 2 : rinkFtW) + 2 * margin;
  const viewBoxH = rinkFtH + 2 * margin;
  const svg = container
    .append<SVGSVGElement>("svg")
    .attr("width", halfRink ? pxW / 2 : pxW)
    .attr("height", pxH)
    .attr(
      "viewBox",
      halfRink
        ? `${-margin} ${-margin} ${rinkFtW / 2 + 2 * margin} ${rinkFtH + 2 * margin}`
        : `${-margin} ${-margin} ${rinkFtW + 2 * margin} ${rinkFtH + 2 * margin}`
    );

  // Helper for shifting all features by margin
  const shiftX = (x: number) => x;
  const shiftY = (y: number) => y;

  // Rink outline (rounded rectangle, with black border)
  svg
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", halfRink ? rinkFtW / 2 : rinkFtW)
    .attr("height", rinkFtH)
    .attr("rx", cornerRadius)
    .attr("ry", cornerRadius)
    .style("fill", "white")
    .style("stroke", "black")
    .style("stroke-width", 2);

  // Center line
  if (!halfRink) {
    svg
      .append("line")
      .attr("x1", 100)
      .attr("y1", 0)
      .attr("x2", 100)
      .attr("y2", rinkFtH)
      .style("stroke", "#C8102E")
      .style("stroke-width", 1);
  }

  // Blue lines
  svg
    .append("line")
    .attr("x1", 75)
    .attr("y1", 0)
    .attr("x2", 75)
    .attr("y2", rinkFtH)
    .style("stroke", "#0033A0")
    .style("stroke-width", 1);
  if (!halfRink) {
    svg
      .append("line")
      .attr("x1", 125)
      .attr("y1", 0)
      .attr("x2", 125)
      .attr("y2", rinkFtH)
      .style("stroke", "#0033A0")
      .style("stroke-width", 1);
  }

  // Goal lines (draw only within the straight part of the rink, not into the rounded corners)
  const outlineStroke = 2; // matches .style("stroke-width", 2)
  const goalLineY1 = 0 + outlineStroke * 2.5;
  const goalLineY2 = rinkFtH - outlineStroke * 2.5;
  svg
    .append("line")
    .attr("x1", 11)
    .attr("y1", goalLineY1)
    .attr("x2", 11)
    .attr("y2", goalLineY2)
    .style("stroke", "#C8102E")
    .style("stroke-width", 0.1667);
  if (!halfRink) {
    svg
      .append("line")
      .attr("x1", 189)
      .attr("y1", goalLineY1)
      .attr("x2", 189)
      .attr("y2", goalLineY2)
      .style("stroke", "#C8102E")
      .style("stroke-width", 0.1667);
  }

  // Center circle and dot
  if (!halfRink) {
    svg
      .append("circle")
      .attr("cx", 100)
      .attr("cy", 42.5)
      .attr("r", 15)
      .style("stroke", "#0033A0")
      .style("stroke-width", 0.1667)
      .style("fill", "transparent");
    svg
      .append("circle")
      .attr("cx", 100)
      .attr("cy", 42.5)
      .attr("r", 1)
      .style("fill", "#0033A0");
  }

  // Neutral zone faceoff dots and decorations
  const neutralDots = [
    { x: 80, y: 20.5 },
    { x: 120, y: 20.5 },
    { x: 80, y: 64.5 },
    { x: 120, y: 64.5 }
  ];
  neutralDots.forEach((dot) => {
    svg
      .append("circle")
      .attr("cx", dot.x)
      .attr("cy", dot.y)
      .attr("r", 1)
      .style("fill", "#C8102E");
    svg
      .append("rect")
      .attr("x", dot.x - 0.6)
      .attr("y", dot.y - 0.925)
      .attr("width", 1.2)
      .attr("height", 1.85)
      .style("fill", "#C8102E");
  });

  // End zone faceoff circles and dots
  const endCircles = [
    { x: 31, y: 20.5 },
    { x: 31, y: 64.5 },
    { x: 169, y: 20.5 },
    { x: 169, y: 64.5 }
  ];
  endCircles.forEach((circle) => {
    svg
      .append("circle")
      .attr("cx", circle.x)
      .attr("cy", circle.y)
      .attr("r", 15)
      .style("stroke", "#C8102E")
      .style("stroke-width", 0.1667)
      .style("fill", "transparent");
    svg
      .append("circle")
      .attr("cx", circle.x)
      .attr("cy", circle.y)
      .attr("r", 1)
      .style("fill", "#C8102E");
  });

  // Double faceoff restraining lines (vertical hash marks)
  const faceoffRestrainingLines = [
    // Left end zone, top
    [
      { x1: 29.125, y1: 5.5, x2: 29.125, y2: 3.5 },
      { x1: 32.875, y1: 5.5, x2: 32.875, y2: 3.5 },
      { x1: 29.125, y1: 35.5, x2: 29.125, y2: 37.5 },
      { x1: 32.875, y1: 35.5, x2: 32.875, y2: 37.5 }
    ],
    // Left end zone, bottom
    [
      { x1: 29.125, y1: 49.5, x2: 29.125, y2: 47.5 },
      { x1: 32.875, y1: 49.5, x2: 32.875, y2: 47.5 },
      { x1: 29.125, y1: 79.5, x2: 29.125, y2: 81.5 },
      { x1: 32.875, y1: 79.5, x2: 32.875, y2: 81.5 }
    ],
    // Right end zone, top
    [
      { x1: 167.125, y1: 5.5, x2: 167.125, y2: 3.5 },
      { x1: 170.875, y1: 5.5, x2: 170.875, y2: 3.5 },
      { x1: 167.125, y1: 35.5, x2: 167.125, y2: 37.5 },
      { x1: 170.875, y1: 35.5, x2: 170.875, y2: 37.5 }
    ],
    // Right end zone, bottom
    [
      { x1: 167.125, y1: 49.5, x2: 167.125, y2: 47.5 },
      { x1: 170.875, y1: 49.5, x2: 170.875, y2: 47.5 },
      { x1: 167.125, y1: 79.5, x2: 167.125, y2: 81.5 },
      { x1: 170.875, y1: 79.5, x2: 170.875, y2: 81.5 }
    ]
  ];
  faceoffRestrainingLines.forEach((group) => {
    group.forEach((line) => {
      svg
        .append("line")
        .attr("x1", line.x1)
        .attr("y1", line.y1)
        .attr("x2", line.x2)
        .attr("y2", line.y2)
        .style("stroke", "#C8102E")
        .style("stroke-width", 0.167);
    });
  });

  // Goal creases (simplified as arcs)
  // Left
  svg
    .append("path")
    .attr("d", `M 11,38.5 L 17,38.5 A 6,6 0 0 1 17,46.5 L 11,46.5`)
    .style("fill", "#E6F9FF")
    .style("stroke", "#C8102E")
    .style("stroke-width", 0.1667);
  // Right
  if (!halfRink) {
    svg
      .append("path")
      .attr("d", `M 189,38.5 L 183,38.5 A 6,6 0 0 0 183,46.5 L 189,46.5`)
      .style("fill", "#E6F9FF")
      .style("stroke", "#C8102E")
      .style("stroke-width", 0.1667);
  }

  // Goal posts (arcs)
  // Left
  svg
    .append("path")
    .attr("d", `M 11,39.5 L 9,39.5 A 5,5 0 0 0 9,45.5 L 11,45.5`)
    .style("fill", "transparent")
    .style("stroke", "black")
    .style("stroke-width", 0.1667);
  // Right
  if (!halfRink) {
    svg
      .append("path")
      .attr("d", `M 189,39.5 L 191,39.5 A 5,5 0 0 1 191,45.5 L 189,45.5`)
      .style("fill", "transparent")
      .style("stroke", "black")
      .style("stroke-width", 0.1667);
  }

  // Trapezoids behind the goals
  // Left
  svg
    .append("polygon")
    .attr("points", "11,31.5 11,53.5 0,57 0,28")
    .style("fill", "transparent")
    .style("stroke", "#C8102E")
    .style("stroke-width", 0.1667);
  // Right
  if (!halfRink) {
    svg
      .append("polygon")
      .attr("points", "189,31.5 189,53.5 200,57 200,28")
      .style("fill", "transparent")
      .style("stroke", "#C8102E")
      .style("stroke-width", 0.1667);
  }

  // Scorekeeper cutout (bottom center)
  svg
    .append("path")
    .attr("d", `M 90,85 A 10,10 0 0 1 110,85`)
    .style("fill", "transparent")
    .style("stroke", "#C8102E")
    .style("stroke-width", 0.1667);

  // Rink outline (draw last, transparent fill, black border only)
  svg
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", halfRink ? rinkFtW / 2 : rinkFtW)
    .attr("height", rinkFtH)
    .attr("rx", cornerRadius)
    .attr("ry", cornerRadius)
    .style("fill", "transparent")
    .style("stroke", "black")
    .style("stroke-width", 2);
}
