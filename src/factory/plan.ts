import { createRng, type Rng } from "./rng";
import { generateEnvironment, type EnvSpec } from "./environment";
import { buildScenario, type FactoryScenario, type ScenarioTemplate } from "./scenario-template";

/**
 * Factory corpus planner.
 *
 * A single root seed fans out deterministically: one seeded environment per
 * slot, then one generated scenario per (environment, template) pair using a
 * per-scenario sub-seed derived from the environment's own RNG stream. Two
 * factory runs with the same root seed yield identical specs end to end.
 *
 * The failure-mode templates are host content, injected from outside the
 * library; a host can also override the environment generator. The planner's
 * determinism is untouched by which templates are injected.
 *
 * @module
 * @example
 * ```ts
 * import { planFactory } from "@/factory/plan.ts";
 *
 * const plan = planFactory(2026, {
 *   envCount: 2,
 *   perEnv: 3,
 *   templates: myTemplates,
 * });
 * plan.jobs.length; // 6 — one job per (environment, template) pair
 * for (const job of plan.jobs) {
 *   console.log(job.env.id, job.scenario.templateId, job.scenario.id);
 * }
 * ```
 */
export type TemplateId = string;

export interface FactoryOptions {
  /** Number of distinct generated environments. */
  envCount: number;
  /** Scenarios per environment (templates cycled by index). */
  perEnv: number;
  /** Host-injected failure-mode templates, keyed by template id. */
  templates: Record<TemplateId, ScenarioTemplate>;
  /** Template ids in canonical cycle order; defaults to `Object.keys(templates)`. */
  templateIds?: readonly TemplateId[];
  /** Environment generator; defaults to the library's {@link generateEnvironment}. */
  generateEnv?: (seed: number, index: number, rng: Rng) => EnvSpec;
}

export const DEFAULT_FACTORY_OPTIONS: Pick<FactoryOptions, "envCount" | "perEnv"> = {
  envCount: 2,
  perEnv: 1,
};

export interface FactoryJob {
  env: EnvSpec;
  scenario: FactoryScenario;
}

export interface FactoryPlan {
  rootSeed: number;
  envCount: number;
  perEnv: number;
  jobs: FactoryJob[];
}

/**
 * Deterministically plan a factory run: seed -> environments -> scenarios.
 * Pure data — no DOM, no WebGL — so it is unit-testable headlessly.
 *
 * @param rootSeed - Root of the seed tree: every environment and scenario
 *   sub-seed derives from it, so the plan is identical for identical seeds.
 * @param options - Shape override + the injected template registry; unset
 *   fields fall back to {@link DEFAULT_FACTORY_OPTIONS}.
 * @example
 * ```ts
 * const plan = planFactory(7, {
 *   envCount: 1,
 *   perEnv: 1,
 *   templates: myTemplates,
 * });
 * // plan.jobs[0].env.seed and plan.jobs[0].scenario.seed are now fixed:
 * // replanning with seed 7 reproduces both exactly.
 * ```
 */
export function planFactory(rootSeed: number, options?: Partial<FactoryOptions>): FactoryPlan {
  const opts: FactoryOptions = {
    ...DEFAULT_FACTORY_OPTIONS,
    ...options,
    // Required by contract even though Partial; fail loudly on forgetful hosts.
    templates: options?.templates ?? {},
  };
  const templateIds = opts.templateIds ?? Object.keys(opts.templates);
  if (templateIds.length === 0) {
    throw new Error("planFactory requires at least one template (pass deps.templates)");
  }
  const generateEnv = opts.generateEnv ?? generateEnvironment;
  const rng: Rng = createRng(rootSeed >>> 0);
  const jobs: FactoryJob[] = [];

  for (let ei = 0; ei < opts.envCount; ei++) {
    const envSeed = rng.int(1, 0x7fffffff);
    const env = generateEnv(envSeed, ei, createRng(envSeed));
    for (let si = 0; si < opts.perEnv; si++) {
      const templateId = templateIds[si % templateIds.length]!;
      const template = opts.templates[templateId];
      if (!template) throw new Error(`planFactory: template "${templateId}" not in deps.templates`);
      // Slot = cycle index so repeated templates within an environment (perEnv
      // > templateIds.length) still generate distinct, deterministic scenarios.
      const slot = Math.floor(si / templateIds.length);
      const scenario: FactoryScenario = buildScenario(env, template, 50, slot);
      jobs.push({ env, scenario });
    }
  }

  return { rootSeed: rootSeed >>> 0, envCount: opts.envCount, perEnv: opts.perEnv, jobs };
}
