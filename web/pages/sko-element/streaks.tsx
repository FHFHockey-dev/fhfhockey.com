import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import StreakChart from "components/skoElement/StreakChart";
import styles from "components/skoElement/SkoElement.module.scss";
import { readStreakHistory, type StreakGame, type StreakPlayer } from "lib/skoElement/streakHistory";

interface Props { players: StreakPlayer[]; player: StreakPlayer | null; games: StreakGame[]; initialCutoff: number | null; invalidCutoff?: boolean }
export const getServerSideProps: GetServerSideProps<Props> = async ({ query, res }) => {
  if (process.env.NODE_ENV !== "development") return { notFound: true };
  const histories = await readStreakHistory().catch((err: NodeJS.ErrnoException) => {
    if (err.code === "ENOENT") return [];
    throw err;
  });
  const players = histories.map(({ id, name, season }) => ({ id, name, season }));
  const key = (p: StreakPlayer) => p.id + "/" + p.season;
  const player = query.player ? players.find(p => key(p) === query.player) : players.find(p => p.name === "Alex DeBrincat") ?? players[0];
  const games = histories.find(p => player && key(p) === key(player))?.games ?? [];
  const initialCutoff = query.through === undefined ? null : games.findIndex(g => g.id === query.through);
  if (initialCutoff !== null && (!query.player || initialCutoff < 0)) {
    res.statusCode = 404;
    return { props: { players: [], player: null, games: [], initialCutoff: null, invalidCutoff: true } };
  }
  if (query.player && !player) return { notFound: true };
  return { props: { players, player: player ?? null, games: initialCutoff === null ? games : games.slice(0, initialCutoff + 1), initialCutoff } };
};

export default function StreakPage({ players, player, games, initialCutoff, invalidCutoff }: Props) {
  const router = useRouter();
  return <main className={styles.page}><Head><title>Player scoring streaks | The Sko Element</title>
    <meta name="robots" content="noindex,nofollow" /></Head>
    <div className={styles.container}>
      <Link href="/sko-element/preview">← The Sko Element</Link>
      <header><h1 className={styles.title}>Player scoring streaks</h1>
        <p>Retained development history · NHL points per played appearance</p></header>
      {invalidCutoff ? <p role="alert">The requested game does not match a retained appearance for this player and season. <Link href="/sko-element/streaks">Choose a player</Link></p> : player ? <>
        <label className={styles.control}>Player and season<select value={player.id + "/" + player.season}
          onChange={event => void router.push({ pathname: router.pathname, query: { player: event.target.value } })}>
          {players.map(p => <option key={p.id + p.season} value={p.id + "/" + p.season}>{p.name} · {p.season}</option>)}
        </select></label>
        {initialCutoff !== null && <p>Frozen through {games[initialCutoff].date}. <Link href={{ pathname: router.pathname, query: { player: player.id + "/" + player.season } }} prefetch={false}>Open {player.name}’s full historical season</Link></p>}
        <StreakChart key={player.id + player.season + "/" + initialCutoff} player={player} games={games} initialCutoff={initialCutoff} />
      </> : <p>Retained history is unavailable. Generate parent-v1/games.csv.gz with the local study pipeline.</p>}
    </div></main>;
}
