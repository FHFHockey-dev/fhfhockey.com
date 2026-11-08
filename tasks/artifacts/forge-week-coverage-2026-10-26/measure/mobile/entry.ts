// Browser bundle for the mobile measurement: the exact client decode and the workspace pack/unpack used by RSO.
import { expandBridgeForecasts, packPlanningSnapshots, unpackPlanningSnapshots } from "/Users/tim/Code/fhfhockey.com/web/lib/rosterScheduleData/bridgeForecastWire";
(globalThis as Record<string, unknown>).rso = { expandBridgeForecasts, packPlanningSnapshots, unpackPlanningSnapshots };
