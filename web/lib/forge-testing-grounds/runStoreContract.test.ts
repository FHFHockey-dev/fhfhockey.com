// @vitest-environment node
import { MemoryExperimentRunStore } from "./memoryRunStore";
import { describeRunStoreContract } from "./runStoreContract.testkit";

// Future durable adapters register here against isolated synthetic instances only.
describeRunStoreContract("memory reference", () => new MemoryExperimentRunStore({ maxQueuedRuns: 4, maxConcurrentLeases: 1 }));
