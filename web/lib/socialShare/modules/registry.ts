import type { AnyShareModule } from "./contract";
import { SHARE_POST_SLUG } from "./contract";
import { foundationModules } from "./lanes/foundation";
import { trendModules } from "./lanes/trends";
import { skaterBoardModules } from "./lanes/skaterBoards";
import { comparisonModules } from "./lanes/comparison";
import { scheduleModules } from "./lanes/schedule";
import { creaseAndCategoryModules } from "./lanes/creaseAndCategory";
import { goalieWorkloadModules } from "./lanes/goalieWorkload";
import { goalieInventoryModules } from "./lanes/goalieInventory";

/** Frozen: a lane adds a post in its own barrel under `lanes/`, never here. */
export const LANE_MODULES: readonly (readonly AnyShareModule[])[] = [foundationModules, trendModules, skaterBoardModules, comparisonModules, scheduleModules, creaseAndCategoryModules, goalieWorkloadModules, goalieInventoryModules];

export function buildRegistry(lanes: readonly (readonly AnyShareModule[])[]): ReadonlyMap<string, AnyShareModule> {
  const registry = new Map<string, AnyShareModule>();
  for (const entry of lanes.flat()) {
    if (!SHARE_POST_SLUG.test(entry.id)) throw new Error(`Invalid share post id: ${entry.id}`);
    if (registry.has(entry.id)) throw new Error(`Duplicate share post id: ${entry.id}`);
    registry.set(entry.id, entry);
  }
  return registry;
}
export const SHARE_MODULES = buildRegistry(LANE_MODULES);
export const shareModule = (id: string) => SHARE_MODULES.get(id);
