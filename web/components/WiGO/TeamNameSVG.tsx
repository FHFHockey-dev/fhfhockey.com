// web/components/WiGO/TeamNameSVG.tsx

import React, { useEffect, useRef, useState, useLayoutEffect } from "react";
import styles from "../../styles/wigoCharts.module.scss";

interface TeamNameSVGProps {
  teamName: string;
  primaryColor: string; // This isn't used for rendering text, maybe for background?
  secondaryColor: string; // Used for text fill color
}

const TeamNameSVG: React.FC<TeamNameSVGProps> = ({
  teamName,
  // primaryColor, // Not actively used in this component's text rendering
  secondaryColor
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [fontSize, setFontSize] = useState<number>(10);
  // State to store the calculated width for the right half
  const [rightHalfWidth, setRightHalfWidth] = useState<number>(100);

  const words = teamName.toUpperCase().split(" ");
  // textRefs might not be strictly necessary with textLength, but kept for potential future use
  const textRefs = useRef<(SVGTextElement | null)[]>([]);

  // Use useLayoutEffect for DOM measurements to run sync before paint
  useLayoutEffect(() => {
    const adjustSizes = () => {
      if (!svgRef.current) return;

      const svgElement = svgRef.current;
      const containerWidth = svgElement.clientWidth;
      const containerHeight = svgElement.clientHeight;

      // --- Calculate width for the right half ---
      const calculatedRightHalfWidth = containerWidth / 2;
      setRightHalfWidth(calculatedRightHalfWidth);

      // --- Calculate font size based on available height ---
      // Adjust these factors to control vertical spacing and padding
      const verticalPaddingFactor = 0.05; // e.g., 10% top/bottom padding
      const availableHeight = containerHeight * (1 - 2 * verticalPaddingFactor);
      const numLines = words.length || 1;
      const lineHeight = availableHeight / numLines;
      // Adjust the multiplier (e.g., 0.8) to fine-tune how much of the line height the font occupies
      const calculatedFontSize = Math.max(1, lineHeight); // Ensure font size is at least 1
      setFontSize(calculatedFontSize);
    };

    // Run initially
    adjustSizes();

    // Re-run on resize
    window.addEventListener("resize", adjustSizes);
    return () => window.removeEventListener("resize", adjustSizes);
  }, [teamName, words.length]); // Rerun if teamName changes

  return (
    <svg
      ref={svgRef}
      className={styles.teamNameSVG}
      // Ensure SVG itself fills the container
      width="100%"
      height="100%"
      // Preserve aspect ratio maybe not needed if text fills, but can add if desired
      // preserveAspectRatio="xMidYMid meet"
    >
      {words.map((word, index) => {
        // Calculate vertical position for each line, centering the block
        const numLines = words.length || 1;
        const verticalPaddingFactor = 0.005;
        const availableHeightPercent = 100 * (1 - 2 * verticalPaddingFactor);
        const verticalStartPercent = 100 * 0.5 - availableHeightPercent / 2;
        // Calculate the vertical center % for this specific line's slot
        const lineYPercent =
          verticalStartPercent +
          (index + 0.55) * (availableHeightPercent / numLines);

        return (
          <text
            key={index}
            // --- Center text anchor in the RIGHT half (75% of total width) ---
            x="75%"
            // --- Position text line vertically ---
            y={`${lineYPercent}%`}
            // --- Text alignment ---
            textAnchor="middle" // Horizontally center text around x="75%"
            alignmentBaseline="middle" // Vertically center text around y
            // --- Styling ---
            fill={secondaryColor} // Text color
            outline={`1px solid ${secondaryColor}`} // Optional outline
            fontSize={`${fontSize}px`} // Calculated font size
            fontFamily="'Train One', serif" // Your specific font
            fontWeight={900}
            // --- Horizontal Stretching/Compressing ---
            // Set the desired length to the width of the right half
            textLength={rightHalfWidth > 0 ? rightHalfWidth : undefined} // Only apply if width is positive
            // Adjust spacing and glyphs to fit the textLength
            lengthAdjust="spacingAndGlyphs"
            // @ts-ignore - Ref type assignment is okay here
            ref={(el) => (textRefs.current[index] = el)}
          >
            {word}
          </text>
        );
      })}
    </svg>
  );
};

export default TeamNameSVG;
