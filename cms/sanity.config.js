// sanity.config.js

import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import schemas from "./schemas/schema";
import Logo from "./plugins/cms-studio-logo/Logo";

export default defineConfig([
  {
    name: "ProductionEnv",
    title: "fhfhockey-cms",
    projectId: "arjjm1dn",
    dataset: "production",
    basePath: "/studio",
    plugins: [structureTool(), visionTool()],
    schema: {
      types: schemas,
    },
    studio: {
      components: {
        logo: Logo,
      },
    },
    tools: (prev) => {
      // 👇 Uses environment variables set by Vite in development mode
      if (import.meta.env.DEV) {
        return prev;
      }
      return prev.filter((tool) => tool.name !== "vision");
    },
  },
  {
    name: "stagingEnv",
    title: "Staging Environment",
    projectId: "arjjm1dn",
    dataset: "staging",
    basePath: "/staging-studio",
    plugins: [structureTool(), visionTool()],
    schema: {
      types: schemas,
    },
    studio: {
      components: {
        logo: Logo,
      },
    },
    tools: (prev) => {
      // 👇 Uses environment variables set by Vite in development mode
      if (import.meta.env.DEV) {
        return prev;
      }
      return prev.filter((tool) => tool.name !== "vision");
    },
  },
]);
