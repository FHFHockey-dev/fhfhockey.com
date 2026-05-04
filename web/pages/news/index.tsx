import { useMemo, useState } from "react";
import type { GetServerSideProps, InferGetServerSidePropsType, NextPage } from "next";
import { NextSeo } from "next-seo";

import Container from "components/Layout/Container";
import NewsCard from "components/NewsFeed/NewsCard";
import { fetchNewsFeedItems, getTeamOptions, type NewsFeedItem } from "lib/newsFeed";
import serverClient from "lib/supabase/server";

import styles from "./index.module.scss";

type NewsPageProps = {
  items: NewsFeedItem[];
  teamOptions: Array<{ abbreviation: string; name: string }>;
};

const NewsPage: NextPage<InferGetServerSidePropsType<typeof getServerSideProps>> = ({
  items,
  teamOptions,
}: NewsPageProps) => {
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const categories = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.category))).sort((left, right) =>
        left.localeCompare(right)
      ),
    [items]
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      if (teamFilter !== "ALL" && item.team_abbreviation !== teamFilter) return false;
      if (categoryFilter !== "ALL" && item.category !== categoryFilter) return false;
      if (!normalizedQuery) return true;

      const haystack = [
        item.headline,
        item.blurb,
        item.category,
        item.subcategory,
        item.team_abbreviation,
        ...item.players.map((player) => player.player_name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [categoryFilter, items, query, teamFilter]);

  return (
    <Container className={styles.page}>
      <NextSeo title="FHFH | News" description="Distilled NHL news feed from tweet-sourced updates." />

      <div className={styles.shell}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>FHFH distilled updates</p>
          <h1 className={styles.title}>Fantasy Hockey News Feed</h1>
          <p className={styles.subtitle}>
            Reviewed updates from CCC, GDL, and future sources, normalized into reusable player and
            team news cards for injuries, returns, goalie starts, roster moves, and line changes.
          </p>
          <div className={styles.summaryRow}>
            <span className={styles.summaryChip}>{items.length} published cards</span>
            <span className={styles.summaryChip}>{teamOptions.length} teams covered</span>
            <span className={styles.summaryChip}>{categories.length} update categories</span>
          </div>
        </header>

        <section className={styles.toolbar}>
          <label className={styles.control}>
            Search
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search player, team, blurb, or category"
            />
          </label>

          <label className={styles.control}>
            Team
            <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}>
              <option value="ALL">All teams</option>
              {teamOptions.map((team) => (
                <option key={team.abbreviation} value={team.abbreviation}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.control}>
            Category
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="ALL">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className={styles.feed}>
          {filteredItems.length === 0 ? (
            <div className={styles.empty}>No news cards match the current filters.</div>
          ) : (
            filteredItems.map((item) => <NewsCard key={item.id} item={item} />)
          )}
        </section>
      </div>
    </Container>
  );
};

export const getServerSideProps: GetServerSideProps<NewsPageProps> = async () => {
  const items = await fetchNewsFeedItems({
    supabase: serverClient,
    status: "published",
    limit: 150,
  });

  return {
    props: {
      items,
      teamOptions: getTeamOptions().map((team) => ({
        abbreviation: team.abbreviation,
        name: team.name,
      })),
    },
  };
};

export default NewsPage;
