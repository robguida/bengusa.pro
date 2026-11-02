// `npm run lint` (in src/) runs ESLint from the repo top with this file, over
// src/, scripts/ and tests/. So paths here are from the repo top. The plugins
// load from src/node_modules, beside this file.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const require = createRequire(import.meta.url);
const SRC = path.dirname(fileURLToPath(import.meta.url));

const eslintConfig = defineConfig([
  ...nextVitals,
  {
    // Next's parser loads its Babel preset (next/babel) from src/.
    languageOptions: { parserOptions: { babelOptions: { cwd: SRC } } },
    settings: {
      // The Next app is in src/, not at the top where ESLint runs.
      next: { rootDir: "src/" },
      // "detect" looks for react from the top, which has no install.
      react: { version: require("react/package.json").version },
    },
  },
  // Skip build and test output, and the test suite's throwaway site copies.
  globalIgnores(["**/.next/", "**/out/", "**/build/", "**/next-env.d.ts",
    "**/test-results/", "**/playwright-report/", "**/blob-report/", "src/.fixture-sites/"]),
]);

export default eslintConfig;
