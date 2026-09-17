import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "node_modules/",
      "dist/",
      "package-lock.json",
      "docs/api/",
      "scripts/verify-engine.bundle.mjs",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,mts}"],
    rules: {
      // Strict typing is enforced by tsc (strict: true); keep lint fast and
      // non-type-aware so `npm run lint` stays cheap.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
