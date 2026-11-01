import { bshBoardModule } from "../bshBoard";
import { categoryBlueprintModule } from "../categoryBlueprint";
import type { AnyShareModule } from "../contract";
import { lastNightsStandoutsModule } from "../lastNightsStandouts";
import { multiCatStarsModule } from "../multiCatStars";
import { nightlyFloorModule } from "../nightlyFloor";

/** BSH, Category Blueprint, Nightly Floor (SS 3.0, 7.0), Top Multi-Cat Stars, Last Nights Standouts. Owned by this lane alone; add its posts here. */
export const skaterBoardModules: readonly AnyShareModule[] = [bshBoardModule, categoryBlueprintModule, nightlyFloorModule, multiCatStarsModule, lastNightsStandoutsModule];
