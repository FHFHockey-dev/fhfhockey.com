import { createRequire } from "node:module";

import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve("eslint-config-next"));
const nextPlugin = nextRequire("@next/eslint-plugin-next");
const importPlugin = nextRequire("eslint-plugin-import");
const jsxA11yPlugin = nextRequire("eslint-plugin-jsx-a11y");
const reactPlugin = nextRequire("eslint-plugin-react");
const reactHooksPlugin = nextRequire("eslint-plugin-react-hooks");
const nextParser = require("eslint-config-next/parser");

const sharedConfig = {
  files: ["**/*.{js,jsx,ts,tsx}"],
  languageOptions: {
    parser: nextParser,
    parserOptions: {
      requireConfigFile: false,
      sourceType: "module",
      allowImportExportEverywhere: true,
      babelOptions: {
        presets: ["next/babel"],
        caller: {
          supportsTopLevelAwait: true,
        },
      },
    },
    sourceType: "module",
  },
  plugins: {
    "@next/next": nextPlugin,
    "@typescript-eslint": tsPlugin,
    import: importPlugin,
    "jsx-a11y": jsxA11yPlugin,
    react: reactPlugin,
    "react-hooks": reactHooksPlugin,
  },
  rules: {
    ...reactPlugin.configs.recommended.rules,
    ...reactHooksPlugin.configs.recommended.rules,
    ...nextPlugin.configs.recommended.rules,
    ...nextPlugin.configs["core-web-vitals"].rules,
    "import/no-anonymous-default-export": "warn",
    "react/no-unknown-property": "off",
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "jsx-a11y/alt-text": [
      "warn",
      {
        elements: ["img"],
        img: ["Image"],
      },
    ],
    "jsx-a11y/aria-props": "warn",
    "jsx-a11y/aria-proptypes": "warn",
    "jsx-a11y/aria-unsupported-elements": "warn",
    "jsx-a11y/role-has-required-aria-props": "warn",
    "jsx-a11y/role-supports-aria-props": "warn",
    "react/jsx-no-target-blank": "off",
    "@next/next/no-html-link-for-pages": "off",
  },
  settings: {
    react: {
      version: "detect",
    },
    "import/parsers": {
      [require.resolve("@typescript-eslint/parser")]: [
        ".ts",
        ".mts",
        ".cts",
        ".tsx",
        ".d.ts",
      ],
    },
    "import/resolver": {
      [nextRequire.resolve("eslint-import-resolver-node")]: {
        extensions: [".js", ".jsx", ".ts", ".tsx"],
      },
      [nextRequire.resolve("eslint-import-resolver-typescript")]: {
        alwaysTryTypes: true,
      },
    },
  },
};

export default [
  {
    ignores: [
      ".next/**",
      "coverage/**",
      "node_modules/**",
      "out/**",
      "public/**",
    ],
  },
  sharedConfig,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: "module",
      },
    },
  },
];
