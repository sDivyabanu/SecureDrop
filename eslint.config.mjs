import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated Prisma contract artifacts — never hand-edited, regenerated
    // by `prisma contract emit` / migration self-emit.
    "src/prisma/contract.d.ts",
    "src/prisma/contract.json",
    "migrations/**",
  ]),
]);

export default eslintConfig;
