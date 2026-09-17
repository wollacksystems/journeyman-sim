import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "factory/index": "src/factory/index.ts",
  },
  format: ["esm"],
  target: "es2022",
  sourcemap: true,
  clean: true,
  dts: true,
  // Runtime deps stay external: consumers resolve three + mediabunny (and
  // their DOM availability) for themselves.
  external: ["three", "mediabunny"],
});
