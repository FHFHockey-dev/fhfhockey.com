import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import NewsCard from "components/NewsFeed/NewsCard";
import TeamStandingsChart from "components/TeamStandingsChart/TeamStandingsChart";
import ClientOnly from "components/ClientOnly";
import home from "styles/Home.module.scss";
import news from "pages/news/index.module.scss";
import { items } from "./data";
import "./fixture.css";

function App() {
  const [expanded, setExpanded] = useState<number | null>(null);
  return <main>
    <p className="fixture-note">Offline presentation fixture · Synthetic standings and snapshot player names</p>
    {location.search.includes("full") ? <div className={news.shell}>
      <h1>News grid fixtures</h1>
      <div className={news.feed}>{items.map((item, index) => <NewsCard key={index} item={item} />)}</div>
    </div> : <section className={home.insightsGrid} aria-label="League news and trends">
      <div className={home.newsPanel}>
        <div className={home.compactPanelHeader}><h2>Latest <span>News</span></h2><a href="/?full">View all</a></div>
        <div className={home.compactNewsList}>{items.map((item, index) => <NewsCard key={index} item={item} compact rail
          expanded={expanded === index} onExpandedChange={(open) => setExpanded(open ? index : null)} />)}</div>
      </div>
      <div className={home.leagueChartPanel}><ClientOnly><TeamStandingsChart compact /></ClientOnly></div>
    </section>}
  </main>;
}
createRoot(document.getElementById("root")!).render(<App />);
