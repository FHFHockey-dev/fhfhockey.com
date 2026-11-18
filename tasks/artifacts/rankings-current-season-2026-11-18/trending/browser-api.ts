import matrix from "pages/api/v1/contextual-rankings/matrix";
import comparison from "pages/api/v1/contextual-rankings/comparison";
import metadata from "pages/api/v1/contextual-rankings/metadata";
import trending from "pages/api/v1/contextual-rankings/trending";
import war from "pages/api/v1/contextual-rankings/war";
import { clearPlayerMatrixSurfaceCachesForTests } from "lib/rankings/playerMatrix";
import { clearEntityMetricRankingReaderCachesForTests } from "lib/rankings/entityMetricRankingReader";
import { clearContextualRankingsQueryCachesForTests } from "lib/rankings/rankingQueries";

export const routes = { matrix, comparison, metadata, trending, war };
export function reset() {
  clearPlayerMatrixSurfaceCachesForTests();
  clearEntityMetricRankingReaderCachesForTests();
  clearContextualRankingsQueryCachesForTests();
}
