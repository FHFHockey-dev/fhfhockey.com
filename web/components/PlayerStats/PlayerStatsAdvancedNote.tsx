import React, { useState } from "react";
import styles from "./PlayerStats.module.scss";

interface PlayerStatsAdvancedNoteProps {
  showAdvanced?: boolean;
}

export function PlayerStatsAdvancedNote({
  showAdvanced = false
}: PlayerStatsAdvancedNoteProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!showAdvanced) return null;

  return (
    <div className={styles.insightsGrid}>
      <div className={`${styles.insightCard} ${styles.neutral}`}>
        <div className={styles.insightLabel}>Advanced Statistics</div>
        <div className={styles.insightValue}>Enhanced Analytics</div>
        <div className={styles.insightDescription}>
          <strong>NST Data:</strong> Possession metrics (CF%, xGF%, HDCF%), zone
          entries, and individual impact measurements.
          <br />
          <strong>Key Metrics:</strong> Per-60 minute rates that normalize for
          ice time and provide deeper insights beyond traditional stats.
          <button
            className={styles.advancedNoteToggle}
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              marginTop: "12px",
              background: "none",
              border: "1px solid #374151",
              color: "#9ca3af",
              padding: "8px 12px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.875rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%"
            }}
          >
            <span>View Statistics Glossary</span>
            <span
              className={`${styles.toggleIcon} ${isExpanded ? styles.expanded : ""}`}
              style={{
                transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s"
              }}
            >
              ▼
            </span>
          </button>
          {isExpanded && (
            <div
              className={styles.advancedNoteContent}
              style={{ marginTop: "12px" }}
            >
              <ul
                className={styles.advancedGlossary}
                style={{
                  margin: 0,
                  paddingLeft: "16px",
                  fontSize: "0.75rem",
                  lineHeight: "1.4"
                }}
              >
                <li style={{ marginBottom: "6px" }}>
                  <strong>CF%:</strong> Corsi For Percentage - Shot attempts for
                  vs total shot attempts while on ice
                </li>
                <li style={{ marginBottom: "6px" }}>
                  <strong>FF%:</strong> Fenwick For Percentage - Unblocked shot
                  attempts for vs total while on ice
                </li>
                <li style={{ marginBottom: "6px" }}>
                  <strong>xGF%:</strong> Expected Goals For Percentage -
                  Expected goals for vs total while on ice
                </li>
                <li style={{ marginBottom: "6px" }}>
                  <strong>HDCF%:</strong> High Danger Corsi For Percentage -
                  High danger shot attempts for vs total
                </li>
                <li style={{ marginBottom: "6px" }}>
                  <strong>Per 60 stats:</strong> Individual stats projected per
                  60 minutes of ice time
                </li>
                <li style={{ marginBottom: "6px" }}>
                  <strong>PDO:</strong> On-ice shooting percentage + on-ice save
                  percentage (luck indicator)
                </li>
                <li style={{ marginBottom: "0" }}>
                  <strong>Zone Start%:</strong> Percentage of shifts starting in
                  offensive/defensive zones
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
