import { useRouter } from "next/router";
import LinemateMatrix from "components/LinemateMatrix";

export default function Page() {
  const router = useRouter();
  const gameId = Number(router.query.gameId);
  return <LinemateMatrix id={gameId} mode="line-combination" />;
}
