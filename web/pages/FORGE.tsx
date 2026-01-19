import { useState, useEffect, useMemo } from "react";
import type { NextPage } from "next";
import Head from "next/head";
import Image from "next/image";
import styles from "styles/Forge.module.scss";
import classNames from "classnames";

type StatUncertainty = {
  p10: number;
  p50: number;
  p90: number;
};

type PlayerProjection = {
  player_id: number;
  player_name: string;
  team_name: string;
  position: string;
  g: number;
  a: number;
  pts: number;
  ppp: number;
  sog: number;
  hit: number;
  blk: number;
  fw: number;
  fl: number;
  uncertainty: {
    g?: StatUncertainty;
    a?: StatUncertainty;
    pts?: StatUncertainty;
    ppp?: StatUncertainty;
    sog?: StatUncertainty;
    hit?: StatUncertainty;
    blk?: StatUncertainty;
    fw?: StatUncertainty;
    fl?: StatUncertainty;
  };
};

const getPositionClass = (position: string) => {
  switch (position) {
    case "C":
      return styles["pos-C"];
    case "L":
    case "LW":
      return styles["pos-LW"];
    case "R":
    case "RW":
      return styles["pos-RW"];
    case "D":
      return styles["pos-D"];
    case "G":
      return styles["pos-G"];
    default:
      return "";
  }
};

const FORGEPage: NextPage = () => {
  const [projections, setProjections] = useState<PlayerProjection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("");

  useEffect(() => {
    const fetchProjections = async () => {
      try {
        const res = await fetch("/api/v1/forge/players");
        if (!res.ok) {
          throw new Error("Failed to fetch projections");
        }
        const data = await res.json();
        // Normalize positions (L->LW, R->RW)
        const normalizedData = data.data.map((p: PlayerProjection) => ({
          ...p,
          position:
            p.position === "L" ? "LW" : p.position === "R" ? "RW" : p.position
        }));
        setProjections(normalizedData);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("An unknown error occurred");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProjections();
  }, []);

  const uniqueTeams = useMemo(() => {
    const teams = new Set(projections.map((p) => p.team_name));
    return Array.from(teams).sort();
  }, [projections]);

  const filteredProjections = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return projections
      .filter((p) => {
        // 1. Filter for active players (simple heuristic: projected points > 0 or goalie)
        // Adjust this logic if "active" means something else in your domain
        const isActive = p.pts > 0 || p.position === "G";
        if (!isActive) return false;

        // 2. Search filter (Player Name)
        if (query && !p.player_name.toLowerCase().includes(query)) {
          return false;
        }

        // 3. Team Filter
        if (selectedTeam && p.team_name !== selectedTeam) {
          return false;
        }

        // 4. Position Filter
        if (selectedPosition && p.position !== selectedPosition) {
          return false;
        }

        return true;
      })
      .sort((a, b) => b.pts - a.pts); // 5. Sort by highest totals (Points)
  }, [projections, searchQuery, selectedTeam, selectedPosition]);

  return (
    <div className={styles.container}>
      <Head>
        <title>FORGE Player Projections | FHFHockey</title>
        <meta
          name="description"
          content="FORGE Player Projections for the upcoming games."
        />
      </Head>

      <main className={styles.main}>
        <div style={{ marginBottom: "1rem" }}>
          <a href="/trends">Visit the unified dashboard →</a>
        </div>
        <div className={styles.header}>
          {/* 3. Logo */}
          <div className={styles.logoContainer}>
            <Image
              src="/pictures/FORGE.png"
              alt="FORGE Logo"
              width={400}
              height={100}
              objectFit="contain"
            />
          </div>

          {/* 5. Highlighted Title */}
          <h1 className={styles.title}>
            <span className={styles.highlight}>F</span>orecasting &{" "}
            <span className={styles.highlight}>O</span>utcome{" "}
            <span className={styles.highlight}>R</span>econciliation{" "}
            <span className={styles.highlight}>G</span>ame{" "}
            <span className={styles.highlight}>E</span>ngine
          </h1>
        </div>

        {/* 2. Search UI */}
        <div className={styles.controlsContainer}>
          {/* Player Search */}
          <div className={styles.filterGroup}>
            <input
              type="text"
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          {/* Team Search */}
          <div className={styles.filterGroup}>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className={styles.teamSelect}
            >
              <option value="">All Teams</option>
              {uniqueTeams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </div>

          {/* Position Search */}
          <div className={styles.filterGroup}>
            <div className={styles.positionButtons}>
              {["C", "LW", "RW", "D", "G"].map((pos) => (
                <button
                  key={pos}
                  className={classNames(styles.positionButton, {
                    [styles.active]: selectedPosition === pos
                  })}
                  onClick={() =>
                    setSelectedPosition(selectedPosition === pos ? "" : pos)
                  }
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading && <p>Loading projections...</p>}
        {error && <p>Error: {error}</p>}

        {!loading && !error && (
          <div className={styles.grid}>
            {filteredProjections.map((p) => (
              <div
                key={p.player_id}
                className={classNames(
                  styles.card,
                  getPositionClass(p.position)
                )}
              >
                <h2>{p.player_name}</h2>
                <p>
                  {p.position} - {p.team_name}
                </p>
                <ul>
                  <li>
                    <span>Points</span>
                    <span>{p.pts?.toFixed(2)}</span>
                  </li>
                  <li>
                    <span>Goals</span>
                    <span>{p.g?.toFixed(2)}</span>
                  </li>
                  <li>
                    <span>Assists</span>
                    <span>{p.a?.toFixed(2)}</span>
                  </li>
                  <li>
                    <span>SOG</span>
                    <span>{p.sog?.toFixed(2)}</span>
                  </li>
                  <li>
                    <span>PPP</span>
                    <span>{p.ppp?.toFixed(2)}</span>
                  </li>
                  <li>
                    <span>Hits</span>
                    <span>{p.hit?.toFixed(2)}</span>
                  </li>
                  <li>
                    <span>Blocks</span>
                    <span>{p.blk?.toFixed(2)}</span>
                  </li>
                </ul>
                {p.uncertainty && (
                  <div className={styles.uncertainty}>
                    <h3>Uncertainty (P10 - P50 - P90)</h3>
                    {p.uncertainty.pts && (
                      <ul>
                        <li>
                          <span>Points</span>
                          <span>
                            {p.uncertainty.pts.p10} - {p.uncertainty.pts.p50} -{" "}
                            {p.uncertainty.pts.p90}
                          </span>
                        </li>
                      </ul>
                    )}
                    {p.uncertainty.g && (
                      <ul>
                        <li>
                          <span>Goals</span>
                          <span>
                            {p.uncertainty.g.p10} - {p.uncertainty.g.p50} -{" "}
                            {p.uncertainty.g.p90}
                          </span>
                        </li>
                      </ul>
                    )}
                    {p.uncertainty.a && (
                      <ul>
                        <li>
                          <span>Assists</span>
                          <span>
                            {p.uncertainty.a.p10} - {p.uncertainty.a.p50} -{" "}
                            {p.uncertainty.a.p90}
                          </span>
                        </li>
                      </ul>
                    )}
                    {p.uncertainty.sog && (
                      <ul>
                        <li>
                          <span>SOG</span>
                          <span>
                            {p.uncertainty.sog.p10} - {p.uncertainty.sog.p50} -{" "}
                            {p.uncertainty.sog.p90}
                          </span>
                        </li>
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default FORGEPage;
