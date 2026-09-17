/**
 * Public API of the journeyman-sim factory: a declarative TypeScript package
 * for generating seeded simulation footage corpora.
 *
 * A {@link Simulation} is a pure, seed-complete program: the same spec +
 * injected deps yield the identical corpus on every machine, which is the
 * contract the ingest pipeline depends on. Host projects supply the
 * domain-neural boundary — failure-mode templates (via `templates`) and the
 * machine cell port (via `FactoryWorldOptions.buildCell`) — while the library
 * stays free of machine-specific content.
 *
 * Ships as a package subpath: `journeyman-sim/factory`.
 *
 * @module
 * @example Read a corpus back and stream ground-truth tuples (headless-safe):
 * ```ts
 * import {
 *   iterTrainingTuples,
 *   readCorpusIndex,
 *   readScenarioScript,
 *   validateCorpusIndex,
 * } from "journeyman-sim/factory";
 * import type { CorpusFilesystem } from "journeyman-sim/factory";
 *
 * declare const fs: CorpusFilesystem;
 * const raw = await fs.readFile("corpora/0000002026/index.json");
 * const validation = validateCorpusIndex(raw);
 * if (validation.ok && validation.index) {
 *   for (const tuple of iterTrainingTuples(validation.index)) {
 *     await readScenarioScript(fs, tuple); // provenance-checked
 *     tuple.clips; // camera -> clip path, relative to the corpus root
 *   }
 * }
 * ```
 *
 * Layer map (who may depend on what):
 * - **public (this module)**: the simulation handle, plan data, env/spec
 *   types, corpus artifacts, and the template-extension surface.
 * - **internal**: `world.ts`, `render.ts`, `corpus-save.ts`, `rng.ts`, and
 *   the browser-only capture pipeline — reachable only through the handle's
 *   effectful methods (`render`, `export`, `renderAndExport`), which load
 *   their engine modules lazily so pure stages never import WebGL.
 *
 * Every export here carries TSDoc and is part of the semver contract; if
 * it lives in an internal module and is not re-exported here, it is not
 * public API.
 */
export { createSimulation } from "./simulation";
export type {
  Simulation,
  SimulationDeps,
  SimulationSpec,
  SimulationSummary,
  SimulationRenderResult,
  SimulationRenderOptions,
} from "./simulation";

// Declaration layer: seed-complete plan data (pure, headless-safe).
export { planFactory, DEFAULT_FACTORY_OPTIONS } from "./plan";
export type { FactoryJob, FactoryOptions, FactoryPlan, TemplateId } from "./plan";

// Environment layer: what a generated world is (spec + provenance).
export type { EnvSpec, EnvPalette } from "./environment";
export { ENV_PALETTES, LOCKED_ENV, generateEnvironment } from "./environment";

// Template layer: the host-authorable failure-mode template registry.
export { buildScenario, pickOther, redAmberGreen, scenarioSeedFor } from "./scenario-template";
export type {
  FactoryScenario,
  NarrationTimes,
  ScenarioTemplate,
  Timing,
} from "./scenario-template";

// Cell port: the host-implemented scenario-driven cell seam.
export type { CellPort } from "../sim/port";

// Corpus artifacts: the stable on-disk contract with ingest.
export {
  buildCorpusIndex,
  buildScenarioScriptDoc,
  corpusDirName,
  corpusIndexPath,
  corpusJson,
  corpusRootPath,
  clipManifestPath,
  clipPath,
  envSpecPath,
  scenarioScriptPath,
} from "./corpus";
export type {
  CorpusIndex,
  CorpusIndexEnvironment,
  CorpusIndexScenario,
  ScenarioScriptDoc,
} from "./corpus";
export type { FactoryCaptureManifest } from "./manifest";
export type { CorpusExportSummary } from "./corpus-save";

// Ingest reader: validate + stream corpora (headless-safe, DOM-free).
export {
  iterTrainingTuples,
  readCorpusIndex,
  readScenarioScript,
  validateCorpusIndex,
} from "./corpus-read";
export type {
  CorpusFilesystem,
  CorpusProblem,
  CorpusValidation,
  TrainingTuple,
} from "./corpus-read";

// Corpus index JSON Schema: the reusable, tool-readable declaration of the
// index contract.
export { corpusIndexJsonSchema } from "./corpus-schema";

// Execution types (the values are internal; see the layer map above).
export type { FactoryCaptureResult, FactoryRenderOptions } from "./render";
export type { FactoryWorld, FactoryWorldOptions } from "./world";
export type { Rng } from "./rng";
export { createRng, hashSeed } from "./rng";
