import React, { useEffect, useRef, useState } from "react";
import styles from "../../styles/wigoCharts.module.scss";

interface TeamNameSVGProps {
  teamName: string;
  primaryColor: string;
  secondaryColor: string;
}

const TeamNameSVG: React.FC<TeamNameSVGProps> = ({
  teamName,
  primaryColor,
  secondaryColor
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [fontSize, setFontSize] = useState<number>(10);
  const words = teamName.toUpperCase().split(" "); // Ensure words are uppercase
  const textRefs = useRef<(SVGTextElement | null)[]>([]); // Track text elements

  useEffect(() => {
    const adjustTextSize = () => {
      if (!svgRef.current) return;

      const containerWidth = svgRef.current.clientWidth;
      const containerHeight = svgRef.current.clientHeight;
      const totalSpacingFactor = 1.1; // Adjust this to control spacing between lines
      const lineHeight = (containerHeight / words.length) * totalSpacingFactor; // Increase line height
      const calculatedFontSize = lineHeight * 0.9; // Slightly reduce to fit vertically
      setFontSize(calculatedFontSize);

      setTimeout(() => {
        textRefs.current.forEach((textEl) => {
          if (textEl) {
            const bbox = textEl.getBBox();
            const scaleX = containerWidth / bbox.width; // Calculate horizontal stretch factor

            // Center scaling transform
            const centerX = bbox.x + bbox.width / 2;
            const centerY = bbox.y + bbox.height / 2;

            textEl.setAttribute(
              "transform",
              `translate(${centerX}, ${centerY}) scale(${scaleX},1) translate(${-centerX}, ${-centerY})`
            );
          }
        });
      }, 0);
    };

    adjustTextSize();
    window.addEventListener("resize", adjustTextSize);

    return () => {
      window.removeEventListener("resize", adjustTextSize);
    };
  }, [teamName]);

  return (
    <svg ref={svgRef} className={styles.teamNameSVG}>
      {words.map((word, index) => (
        <text
          key={index}
          x="50%" // Center horizontally
          y={`${7 + (index + 0.5) * (90 / words.length)}%`} // Modified
          textAnchor="middle"
          alignmentBaseline="middle"
          fill={secondaryColor}
          fontSize={`${fontSize}px`}
          fontFamily="'Train One', serif"
          fontWeight={900}
          // @ts-ignore
          ref={(el) => (textRefs.current[index] = el)}
        >
          {word}
        </text>
      ))}
    </svg>
  );
};

export default TeamNameSVG;
