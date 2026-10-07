import { defineConfig, globalIgnores } from "eslint/config";
import nextPlugin from "@next/eslint-plugin-next";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  nextPlugin.configs["core-web-vitals"],
  ...nextTypeScript,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
