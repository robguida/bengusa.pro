import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // `eslint .` lints the whole folder, so skip build and test output.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts",
    "test-results/**", "playwright-report/**", "blob-report/**"]),
]);

export default eslintConfig;
