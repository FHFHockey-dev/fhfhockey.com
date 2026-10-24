import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
export default defineConfig({plugins:[tsconfigPaths(),react()],cacheDir:"/tmp/fhfh-p07-r2-review-n7g6bsdg/vite-cache",test:{environment:"jsdom",setupFiles:["./__tests__/vitest.setup.js","./audit.offline.setup.ts"],pool:"threads",maxWorkers:1,minWorkers:1,exclude:["**/node_modules/**","**/e2e/**","**/.next/**"]}});
