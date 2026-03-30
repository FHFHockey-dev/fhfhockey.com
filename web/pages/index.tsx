// /Users/tim/Desktop/FHFH/fhfhockey.com/web/pages/index.tsx
// @ts-nocheck
import type { NextPage } from "next";
import Head from "next/head";
import { NextSeo } from "next-seo";
import moment from "moment";
import "moment-timezone"; // Import moment-timezone

import Banner from "../components/Banner";
import SocialMedias from "components/SocialMedias";
import Container from "components/Layout/Container";
import ClientOnly from "components/ClientOnly";
import styles from "../styles/Home.module.scss";
import HomepageGamesSection from "components/HomePage/HomepageGamesSection";
import HomepageStandingsInjuriesSection from "components/HomePage/HomepageStandingsInjuriesSection";
import { useHomepageGames } from "components/HomePage/useHomepageGames";

import { fetchCurrentSeason } from "utils/fetchCurrentSeason";
import { checkIsOffseason } from "../hooks/useOffseason";
import Fetch from "lib/cors-fetch";

// Import our chart component
import TeamStandingsChart from "components/TeamStandingsChart/TeamStandingsChart";
import TransactionTrends from "components/TransactionTrends/TransactionTrends";

// Shared debug logger for both server and client
const debugLog = (...args: any[]) => {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};

// DEV NOTE:
// Integrate Live Period/Time Clock instead of just displaying "LIVE" for live games

const Home: NextPage = ({
  initialGames,
  initialInjuries,
  initialStandings,
  nextGameDate,
  homepageSnapshotGeneratedAt,
  standingsLoadError,
  injuriesLoadError
}) => {
  const { currentDate, games, gamesHeaderText, changeDate, loading, error, lastUpdatedAt } =
    useHomepageGames({
      initialGames,
      nextGameDate
    });

  return (
    <Container>
      <NextSeo
        title="FHFH | Home"
        description="Five Hole Fantasy Hockey Podcast Home page."
        openGraph={{
          images: [
            {
              url: `${process.env.NEXT_PUBLIC_SITE_URL}/pictures/circle.png`,
              alt: "logo"
            }
          ]
        }}
      />
      <Head>
        <meta
          name="google-site-verification"
          content="ilj1AkBDPlpfcKH8A0zBJUdKtcUjE8TKIyCLa6buHxk"
        />
      </Head>
      <Banner className={styles.socialMedia}>
        <SocialMedias />
      </Banner>

      <div className={styles.homepage}>
        <HomepageGamesSection
          currentDate={currentDate}
          games={games}
          gamesHeaderText={gamesHeaderText}
          onChangeDate={changeDate}
          loading={loading}
          error={error}
          lastUpdatedAt={lastUpdatedAt}
        />
        <ClientOnly>
          <TransactionTrends />
        </ClientOnly>

        <div className={styles.chartContainer}>
          <TeamStandingsChart />
        </div>

        <HomepageStandingsInjuriesSection
          standings={initialStandings}
          injuries={initialInjuries}
          snapshotGeneratedAt={homepageSnapshotGeneratedAt}
          standingsError={standingsLoadError}
          injuriesError={injuriesLoadError}
        />
      </div>
    </Container>
  );
};

export async function getServerSideProps({ req, res }) {
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=60, stale-while-revalidate=120" // Cache for 60s, allow stale for 2 min
  );

  const fetchJson = async (url: string) => {
    const response = await Fetch(url);
    const text = await response.text();

    if (!response.ok) {
      throw new Error(
        `Request failed (${response.status})${text ? `: ${text.slice(0, 200)}` : ""}`
      );
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Expected JSON response but received: ${text.slice(0, 120)}`);
    }
  };

  const fetchGames = async (date: string) => {
    try {
      const scheduleUrl = `https://api-web.nhle.com/v1/schedule/${date}`;
      const response = await fetchJson(scheduleUrl);
      return {
        games: response?.gameWeek?.[0]?.games || [],
        failed: false
      };
    } catch (error) {
      console.error(`Error fetching games for ${date}: `, error.message);
      return {
        games: [],
        failed: true
      };
    }
  };

  const fetchInjuries = async () => {
    try {
      const response = await fetchJson(
        `https://stats.sports.bellmedia.ca/sports/hockey/leagues/nhl/playerInjuries?brand=tsn&type=json`
      );

      if (!Array.isArray(response)) {
        console.error("Unexpected injuries API response format:", response);
        return {
          data: [],
          error: "Injury updates are unavailable right now."
        };
      }

      let injuriesData = response.flatMap((team) =>
        team.playerInjuries && Array.isArray(team.playerInjuries)
          ? team.playerInjuries.map((injury) => ({
              ...injury,
              team: team.competitor?.shortName ?? "N/A", // Added null check
              date: injury.date
                ? moment(injury.date).format("YYYY-MM-DD")
                : "N/A" // Format date
            }))
          : []
      );

      // Sort injuriesData by date, most recent first
      injuriesData = injuriesData.sort((a, b) =>
        moment(b.date).diff(moment(a.date))
      );

      return {
        data: injuriesData,
        error: null
      };
    } catch (error) {
      console.error("Error fetching injuries: ", error.message);
      return {
        data: [],
        error: "Injury updates could not be loaded."
      };
    }
  };

  const fetchStandings = async () => {
    try {
      const currentSeason = await fetchCurrentSeason(); // Assuming this returns valid start/end dates
      const now = new Date();
      let dateForStandings = moment().utc().format("YYYY-MM-DD"); // Use UTC for server

      if (currentSeason && currentSeason.startDate && currentSeason.endDate) {
        const seasonStart = new Date(currentSeason.startDate);
        const seasonEnd = new Date(currentSeason.endDate);

        // Check if current date is outside the regular season range
        if (now < seasonStart || now > seasonEnd) {
          // Attempt to get the end date of the season if outside
          dateForStandings = moment(seasonEnd).format("YYYY-MM-DD");
          console.log(
            `Outside regular season. Fetching standings for season end date: ${dateForStandings}`
          );
        }
      } else {
        console.warn(
          "Could not determine current season dates accurately. Defaulting to today for standings."
        );
      }

      const response = await fetchJson(`https://api-web.nhle.com/v1/standings/${dateForStandings}`);

      if (!response || !Array.isArray(response.standings)) {
        console.error(
          "Standings data not available or in unexpected format for date:",
          dateForStandings,
          response
        );
        return {
          data: [],
          error: "Standings are unavailable right now."
        };
      }

      // Map directly if the structure is already flat
      const standingsData = response.standings.map((team: any) => ({
        leagueSequence: team.leagueSequence ?? 99, // Provide default
        teamName: team.teamName?.default ?? "Unknown Team", // Provide default
        wins: team.wins ?? 0,
        losses: team.losses ?? 0,
        otLosses: team.otLosses ?? 0,
        points: team.points ?? 0,
        teamLogo:
          team.teamLogo ??
          `https://assets.nhle.com/logos/nhl/svg/${
            team.teamAbbrev?.default ?? "NHL"
          }_light.svg` // Default logo
      }));

      // Sort by leagueSequence ascending after mapping
      standingsData.sort((a, b) => a.leagueSequence - b.leagueSequence);

      return {
        data: standingsData,
        error: null
      };
    } catch (error) {
      console.error("Error fetching standings: ", error.message);
      return {
        data: [],
        error: "Standings could not be loaded."
      };
    }
  };

  // Check if we're in the offseason first
  const isOffseason = await checkIsOffseason();

  const today = moment().format("YYYY-MM-DD");
  let gamesToday = [];
  let nextGameDateFound = today;

  if (isOffseason) {
    console.log("Currently in offseason - skipping game search");
    // During offseason, don't search for games as there won't be any
    // Just use empty array and today's date
    gamesToday = [];
    nextGameDateFound = today;
  } else {
    // Only search for games during the regular season or playoffs
    const todayGamesResult = await fetchGames(today);
    gamesToday = todayGamesResult.games;
    nextGameDateFound = today;

    if (gamesToday.length === 0 && !todayGamesResult.failed) {
      debugLog(
        `No games found for today (${today}), searching for next available date...`
      );
      let nextDay = moment(today).add(1, "days");
      let attempts = 0;
      const maxAttempts = 7; // Reduce from 30 to 7 days during season

      while (gamesToday.length === 0 && attempts < maxAttempts) {
        const dateStr = nextDay.format("YYYY-MM-DD");
        debugLog(`Checking for games on ${dateStr}...`);
        const nextGamesResult = await fetchGames(dateStr);
        gamesToday = nextGamesResult.games;
        if (nextGamesResult.failed) {
          console.warn(
            `Stopping future game search after upstream failure on ${dateStr}.`
          );
          break;
        }
        if (gamesToday.length > 0) {
          nextGameDateFound = dateStr;
          debugLog(`Found next games on ${nextGameDateFound}`);
          break;
        }
        nextDay.add(1, "days");
        attempts++;
      }
      if (gamesToday.length === 0) {
        console.warn(
          `Could not find games within the next ${maxAttempts} days.`
        );
      }
    } else {
      debugLog(`Found games for today (${today})`);
    }
  }

  const injuriesResult = await fetchInjuries();
  const standingsResult = await fetchStandings();

  return {
    props: {
      initialGames: gamesToday,
      initialInjuries: injuriesResult.data,
      initialStandings: standingsResult.data,
      nextGameDate: nextGameDateFound,
      isOffseason,
      homepageSnapshotGeneratedAt: new Date().toISOString(),
      standingsLoadError: standingsResult.error,
      injuriesLoadError: injuriesResult.error
    }
  };
}

export default Home;
