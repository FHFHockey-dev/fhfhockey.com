import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
export default defineConfig({plugins:[tsconfigPaths(),react()],cacheDir:"/var/folders/g2/b33dwc153kbd_vhg6cfbn8bm0000gn/T/fhfh-p07-task10-review-fosogs3g/vite-cache",test:{environment:"jsdom",setupFiles:["./__tests__/vitest.setup.js","./audit.offline.setup.ts"],pool:"threads",maxWorkers:1,minWorkers:1,exclude:["**/node_modules/**","**/e2e/**","**/.next/**"]}});
