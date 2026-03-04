import { useMemo, useState } from "react";
import type { ChangeEvent, NextPage } from "next";
import Head from "next/head";

import styles from "styles/ForgeDashboard.module.scss";

const ForgeDashboardPage: NextPage = () => {
  const todayEt = useMemo(() => {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(now);

    const y = parts.find((part) => part.type === "year")?.value ?? "1970";
    const m = parts.find((part) => part.type === "month")?.value ?? "01";
    const d = parts.find((part) => part.type === "day")?.value ?? "01";
    return `${y}-${m}-${d}`;
  }, []);
  const [selectedDate, setSelectedDate] = useState(todayEt);
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [selectedPosition, setSelectedPosition] = useState("all");

  const handleDateChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(event.target.value);
  };

  const handleTeamChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedTeam(event.target.value);
  };

  const handlePositionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedPosition(event.target.value);
  };

  return (
    <>
      <Head>
        <title>Forge Dashboard | FHFHockey</title>
        <meta
          name="description"
          content="Single-screen fantasy hockey command center for team power, sustainability, streaks, and goalie decisions."
        />
      </Head>

      <main className={styles.page}>
        <div className={styles.container}>
          <header className={styles.header}>
            <h1 className={styles.title}>Forge Dashboard</h1>
            <p className={styles.subtitle}>
              Daily fantasy hockey command center.
            </p>
          </header>

          <section className={styles.filterBar} aria-label="Global dashboard filters">
            <label className={styles.filterItem}>
              <span>Date</span>
              <input
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                className={styles.filterInput}
              />
            </label>

            <label className={styles.filterItem}>
              <span>Team</span>
              <select
                value={selectedTeam}
                onChange={handleTeamChange}
                className={styles.filterInput}
              >
                <option value="all">All Teams</option>
              </select>
            </label>

            <label className={styles.filterItem}>
              <span>Position</span>
              <select
                value={selectedPosition}
                onChange={handlePositionChange}
                className={styles.filterInput}
              >
                <option value="all">All Positions</option>
                <option value="f">Forwards</option>
                <option value="d">Defense</option>
                <option value="g">Goalies</option>
              </select>
            </label>
          </section>

          <nav className={styles.quickLinks} aria-label="Forge dashboard quick links">
            <a href="/FORGE" className={styles.quickLink}>
              Open Legacy FORGE
            </a>
            <a href="/trends" className={styles.quickLink}>
              Open Trends Dashboard
            </a>
          </nav>

          <section className={styles.dashboardGrid} aria-label="Forge dashboard">
            <div className={styles.panel}>Team Power</div>
            <div className={styles.panel}>Sustainability</div>
            <div className={styles.panel}>Goalie Risk</div>
            <div className={styles.panel}>Hot / Cold</div>
            <div className={styles.panel}>Slate Strip</div>
            <div className={styles.panel}>Top Movers</div>
          </section>
        </div>
      </main>
    </>
  );
};

export default ForgeDashboardPage;
