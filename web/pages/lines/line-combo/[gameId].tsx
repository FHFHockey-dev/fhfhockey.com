import ProjectedLineups from "components/LineCombinations/ProjectedLineups";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import LinemateMatrix from "components/LinemateMatrix";

export default function Page() {
  const router = useRouter();
  const gameId = Number(router.query.gameId);
  if (!Number.isSafeInteger(gameId) || gameId <= 0) return null;
  return <main style={{ padding: 24 }}>
    <ProjectedLineups gameId={gameId} />
    <section aria-label="Observed shared ice time">
      <h2>Observed shared ice time</h2>
      <LinemateMatrix id={gameId} mode="line-combination" />
    </section>
  </main>;
}

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {}
});
