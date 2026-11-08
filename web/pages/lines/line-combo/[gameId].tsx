import ProjectedLineups from "components/LineCombinations/ProjectedLineups";
import type { GetStaticPaths, GetStaticProps } from "next";
import { NextSeo } from "next-seo";
import { useRouter } from "next/router";
import Container from "components/Layout/Container";
import PageTitle from "components/PageTitle";
import LinemateMatrix from "components/LinemateMatrix";
import { getTeamAbbreviationById } from "lib/teamsInfo";
import supabase from "lib/supabase";
import styles from "styles/Lines.module.scss";

type GameContext = {
  startTime: string | null;
  home: string | null;
  away: string | null;
};

type Props = { game: GameContext | null };

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "America/New_York"
});

export default function Page({ game }: Props) {
  const router = useRouter();
  const gameId = Number(router.query.gameId);
  if (!Number.isSafeInteger(gameId) || gameId <= 0) return null;

  const matchup =
    game?.home && game?.away ? `${game.away} at ${game.home}` : `Game ${gameId}`;
  const date = game?.startTime
    ? dateFormatter.format(new Date(game.startTime))
    : null;

  return (
    <Container className={styles.gamePage}>
      <NextSeo
        title={`FHFH | ${matchup} Lines${date ? ` · ${date}` : ""}`}
        description={`${matchup} line combinations: game-entry lineups, in-game updates and shared ice time.`}
      />
      <header className={styles.gameHeader}>
        <PageTitle className={styles.gameTitle}>
          {matchup} <PageTitle.Highlight>LINES</PageTitle.Highlight>
        </PageTitle>
        {date ? <p className={styles.gameContext}>{date}</p> : null}
      </header>
      <ProjectedLineups
        gameId={gameId}
        onGameChange={(id) => {
          void router.push(`/lines/line-combo/${id}`);
        }}
      />
      <section className={styles.gamePanel} aria-labelledby="game-shared-ice">
        <h2 id="game-shared-ice" className={styles.gameSectionTitle}>
          Shared ice time
        </h2>
        <LinemateMatrix
          id={gameId}
          mode="line-combination"
          headingLevel="h3"
          labelGrid
          wideNames
          controlsAlign="start"
          sideBySide
        />
      </section>
    </Container>
  );
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [],
  fallback: "blocking"
});

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const gameId = Number(params?.gameId);
  if (!Number.isSafeInteger(gameId) || gameId <= 0) {
    return { props: { game: null }, revalidate: 300 };
  }
  try {
    const { data } = await supabase
      .from("games")
      .select("startTime, homeTeamId, awayTeamId")
      .eq("id", gameId)
      .maybeSingle();
    const game: GameContext | null = data
      ? {
          startTime: data.startTime ?? null,
          home: getTeamAbbreviationById(data.homeTeamId) ?? null,
          away: getTeamAbbreviationById(data.awayTeamId) ?? null
        }
      : null;
    return { props: { game }, revalidate: 300 };
  } catch (error) {
    console.error(`line-combo: failed to load game ${gameId}`, error);
    return { props: { game: null }, revalidate: 60 };
  }
};
