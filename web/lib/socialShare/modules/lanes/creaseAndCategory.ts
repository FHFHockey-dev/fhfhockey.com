import type { AnyShareModule } from "../contract";
import { creaseShiftModule } from "../creaseShift";
import { goalieGsaxModule } from "../goalieGsax";
import { goaliePeriodModule } from "../goaliePeriod";

/** Crease Shift, Goalie of the Week and Month, GSAx (SS 8.0, 9.0). Owned by this lane alone; add its posts here. */
export const creaseAndCategoryModules: readonly AnyShareModule[] = [creaseShiftModule, goaliePeriodModule, goalieGsaxModule];
