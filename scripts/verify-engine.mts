// Headless engine verification: proves the library's seam contract end to end
// with ZERO host content — a synthetic template registry + a stub CellPort are
// the injected deps, so every assertion below demonstrates domain-neutrality
// and determinism rather than any single machine's shape.
//
// Run: npm run verify  (bundled with esbuild then executed by node)

import * as THREE from "three";
import { createAvatar } from "../src/avatar.ts";
import { applyScenario } from "../src/sim/apply.ts";
import { createFactoryWorld } from "../src/factory/world.ts";
import { createRng, type Rng } from "../src/factory/rng.ts";
import { generateEnvironment, LOCKED_ENV, type EnvSpec } from "../src/factory/environment.ts";
import type { ScenarioCell, ScenarioDef } from "../src/scenario/types.ts";
import { validateScenario } from "../src/scenario/types.ts";
import { driveScenario, type ScenarioState } from "../src/scenario/drive.ts";
import {
  buildScenario,
  pickOther,
  redAmberGreen,
  scenarioSeedFor,
} from "../src/factory/scenario-template.ts";
import type { NarrationTimes, ScenarioTemplate, Timing } from "../src/factory/scenario-template.ts";
import { planFactory } from "../src/factory/plan.ts";
import { createSimulation } from "../src/factory/simulation.ts";
import { buildCorpusIndex, buildScenarioScriptDoc, corpusJson } from "../src/factory/corpus.ts";
import type { CellPort } from "../src/sim/port.ts";
import { ENGINE_VERSION } from "../src/version.ts";

function ok(cond: boolean, label: string): void {
  if (!cond) throw new Error(`verify-engine: ${label}`);
  console.log(`  ok: ${label}`);
}

function section(title: string): void {
  console.log(`\n${title}`);
}

function makeTemplate(id: string, title: string, opts?: { mirrorX?: boolean }): ScenarioTemplate {
  return {
    id,
    title,
    role: "equipment-operator",
    faultAnchor: [0.4, 1.3, 0.0],
    handsOnStandXZ: [-0.8, 1.1],
    verifyLook: [0, 1.2, -1.5],
    lean: 0.85,
    hand: "left",
    ...(opts?.mirrorX ? { mirrorX: true } : {}),
    narration(_rng: Rng, times: NarrationTimes) {
      return [
        { t: times[0], text: `${title}: walk to the cell.` },
        { t: times[1], text: `${title}: observe the indicator.` },
        { t: times[2], text: `${title}: step in on the stand.` },
        { t: times[3], text: `${title}: clear the condition.` },
        { t: times[4], text: `${title}: condition clears.` },
        { t: times[5], text: `${title}: stack is green.` },
      ];
    },
    lesson(_rng: Rng) {
      return { title: `${title} lesson`, body: "Synthetic template lesson body." };
    },
    cell(_rng: Rng, t: Timing) {
      return {
        dust: { appearsAt: t.failSec, clearedAt: t.clearAt },
        wayLube: null,
        atc: null,
        signals: redAmberGreen(t),
      } satisfies ScenarioCell;
    },
  };
}

const templates = {
  "fail-a": makeTemplate("fail-a", "Sensor fault"),
  "fail-b": makeTemplate("fail-b", "Carousel jam"),
};
const ids = Object.keys(templates);

section("RNG determinism");
{
  const a = createRng(2026);
  const b = createRng(2026);
  const seqA = [a.pick(ids), a.int(0, 100), a.range(0, 1)];
  const seqB = [b.pick(ids), b.int(0, 100), b.range(0, 1)];
  ok(JSON.stringify(seqA) === JSON.stringify(seqB), "same seed, same sequence");
  const c = createRng(7);
  const seqC = [c.pick(ids), c.int(0, 100), c.range(0, 1)];
  ok(JSON.stringify(seqC) !== JSON.stringify(seqA), "different seed diverges");
}

section("planFactory: deterministic, template-agnostic planning");
{
  const plan = planFactory(31337, { templates, envCount: 2, perEnv: 3 });
  ok(plan.jobs.length === 6, "envCount x perEnv jobs");
  ok(plan.jobs[0]!.scenario.templateId === "fail-a", "cycle starts at first template");
  ok(plan.jobs[1]!.scenario.templateId === "fail-b", "cycle advances per slot");
  ok(plan.jobs[2]!.scenario.templateId === "fail-a", "cycle wraps past the registry");
  ok(plan.jobs[2]!.scenario.slot === 1, "wrapped template advances its slot");
  ok(plan.jobs[2]!.scenario.id.endsWith("-1"), "slot is encoded in the scenario id");

  const replan = planFactory(31337, { templates, envCount: 2, perEnv: 3 });
  ok(
    corpusJson(replan.jobs.map((j) => j.scenario)) === corpusJson(plan.jobs.map((j) => j.scenario)),
    "same seed, byte-identical scenarios",
  );

  const otherSeed = planFactory(42, { templates, envCount: 2, perEnv: 3 });
  ok(
    otherSeed.jobs[0]!.env.seed !== plan.jobs[0]!.env.seed,
    "different root seed picks a different first environment",
  );

  const onlyB = planFactory(31337, { templates, templateIds: ["fail-b"], perEnv: 2 });
  ok(
    onlyB.jobs.every((j) => j.scenario.templateId === "fail-b"),
    "templateIds override the cycle order",
  );

  let generatedCalls = 0;
  const injectedEnv = (seed: number, index: number, rng: Rng): EnvSpec => {
    generatedCalls++;
    return generateEnvironment(seed, index, rng);
  };
  const custom = planFactory(9, {
    templates,
    envCount: 3,
    perEnv: 1,
    generateEnv: injectedEnv,
  });
  ok(generatedCalls === 3, "generateEnv injection honored once per environment");
  ok(custom.jobs.length === 3, "custom env generator still produces one job per environment");

  let threw = false;
  try {
    planFactory(1, {});
  } catch {
    threw = true;
  }
  ok(threw, "planFactory rejects an empty template registry");
}

section("buildScenario: parametrization + mirrorX seam");
{
  const env = generateEnvironment(9001, 0, createRng(9001));
  const sc = buildScenario(env, templates["fail-a"]!, 60, 0);
  ok(sc.id === `fail-a-${env.id}`, "id = template + env");
  ok(sc.templateId === "fail-a" && sc.slot === 0, "provenance fields carried");
  ok(sc.durationSec === 60, "duration respected");
  ok(
    scenarioSeedFor(env, "fail-a", 0) === scenarioSeedFor(env, "fail-a", 0) &&
      scenarioSeedFor(env, "fail-a", 0) !== scenarioSeedFor(env, "fail-b", 0) &&
      scenarioSeedFor(env, "fail-a", 0) !== scenarioSeedFor(env, "fail-a", 1),
    "canonical sub-seed is stable and distinct per (template, slot)",
  );
  ok(validateScenario(sc).length === 0, "scenario is well-formed (beats/narration/overlap)");
  ok(sc.narration.length === 6, "narration bank fully authored");

  const sc2 = buildScenario(env, templates["fail-a"]!, 60, 0);
  ok(
    corpusJson(sc2.beats) === corpusJson(sc.beats) && corpusJson(sc2.cell) === corpusJson(sc2.cell),
    "rebuild is byte-identical",
  );
  ok(
    corpusJson(buildScenario(env, templates["fail-a"]!, 60, 1).beats) !== corpusJson(sc.beats),
    "slot changes the generated scenario",
  );

  const leftEnv: EnvSpec = { ...LOCKED_ENV, atcSide: 1 };
  const rightEnv: EnvSpec = { ...LOCKED_ENV, atcSide: -1 };
  const plain = makeTemplate("fail-plain", "Plain fault");
  const plainLeft = buildScenario(leftEnv, plain).faultWorld;
  const plainRight = buildScenario(rightEnv, plain).faultWorld;
  ok(plainLeft[0] === plainRight[0], "non-mirrorX anchor is side-independent");

  const mirror = makeTemplate("fail-mirror", "Mirrored fault", { mirrorX: true });
  const mirrorLeft = buildScenario(leftEnv, mirror).faultWorld[0];
  const mirrorRight = buildScenario(rightEnv, mirror).faultWorld[0];
  ok(mirrorLeft === 0.4 && mirrorRight === -0.4, "mirrorX flips the anchor with env.atcSide");
}

section("CellPort seam: domain-neutral state application");
{
  const env = generateEnvironment(9001, 0, createRng(9001));
  const applied: Array<{ t: number; cell: unknown }> = [];
  const port: CellPort = {
    object3d: new THREE.Object3D(),
    apply(state: ScenarioState) {
      applied.push({ t: state.t, cell: state.cell });
    },
  };
  const avatar = createAvatar();
  const sc: ScenarioDef = buildScenario(env, templates["fail-a"]!, 50, 0);
  const state = driveScenario(sc, 12);
  applyScenario(state, avatar, port);

  ok(
    applied.length === 1 && applied[0]!.t === state.t,
    "port.apply called once with the driven state",
  );
  ok(
    avatar.root.position.x === state.avatar.position[0] &&
      avatar.root.position.z === state.avatar.position[1],
    "avatar root follows the state position",
  );
}

section("createSimulation facade: spec + injected deps");
{
  const sim = createSimulation({ seed: 2026, shape: { envCount: 2, perEnv: 2 } }, { templates });
  ok(sim.plan().jobs.length === 4, "plan honors the spec shape");
  const d1 = sim.describe();
  const d2 = sim.describe();
  ok(corpusJson(d1) === corpusJson(d2), "describe is deterministic");
  ok(d1.envCount === 2 && d1.scenarioCount === 4, "summary counts match the plan");
  ok(
    d1.environments.every((e) => e.scenarios.length === 2),
    "scenarios grouped per environment",
  );

  const onlyB = createSimulation(
    { seed: 2026, shape: { envCount: 1, perEnv: 2 } },
    { templates, templateIds: ["fail-b"] },
  );
  ok(
    onlyB.plan().jobs.every((j) => j.scenario.templateId === "fail-b"),
    "templateIds passthrough",
  );

  let injectedCalls = 0;
  const sim3 = createSimulation(
    { seed: 2026, shape: { envCount: 2, perEnv: 1 } },
    {
      templates,
      generateEnv: (seed, index, rng) => {
        injectedCalls++;
        return generateEnvironment(seed, index, rng);
      },
    },
  );
  ok(sim3.describe().envCount === 2, "describe runs the injected generator");
  ok(injectedCalls === 2, "generateEnv injection honored through the facade");
}

section("Corpus artifacts: stable provenance documents");
{
  const plan = planFactory(31337, { templates, envCount: 2, perEnv: 3 });
  const job = plan.jobs[0]!;
  const doc1 = buildScenarioScriptDoc(job, plan.rootSeed);
  const doc2 = buildScenarioScriptDoc(job, plan.rootSeed);
  ok(corpusJson(doc1) === corpusJson(doc2), "script docs are byte-stable");
  ok(doc1.provenance.rootSeed === plan.rootSeed, "root seed provenance");
  ok(doc1.provenance.engineVersion === ENGINE_VERSION, "engine version provenance matches");

  const exportedUtc = "2026-01-01T00:00:00.000Z";
  const clipsByScenario: Record<string, string[]> = {};
  for (const j of plan.jobs) clipsByScenario[j.scenario.id] = [...j.scenario.cameras];
  const index1 = buildCorpusIndex({ plan, clipsByScenario, exportedUtc });
  const index2 = buildCorpusIndex({ plan, clipsByScenario, exportedUtc });
  ok(corpusJson(index1) === corpusJson(index2), "index is byte-stable");
  ok(index1.environments.length === 2 && index1.scenarios.length === 6, "index mirrors the plan");

  const indexByScenario = new Map(index1.scenarios.map((s) => [s.scenarioId, s]));
  for (const j of plan.jobs) {
    const entry = indexByScenario.get(j.scenario.id);
    if (!entry) throw new Error(`verify-engine: index missing scenario ${j.scenario.id}`);
    ok(
      entry.seed === buildScenarioScriptDoc(j, plan.rootSeed).provenance.seed,
      `index seed matches script provenance (${j.scenario.id})`,
    );
  }
}

section("pickOther: alternating picks never return the excluded element");
{
  const rng = createRng(555);
  for (let i = 0; i < 20; i++) {
    const pick = pickOther(rng, ids, "fail-a");
    if (pick === "fail-a")
      throw new Error(`verify-engine: pickOther returned the excluded element (run ${i})`);
  }
  ok(true, "pickOther stays on the alternates");
}

section("World seam export contract (type-level)");
{
  // createFactoryWorld requires a buildCell returning a CellPort; exercising
  // it here requires a DOM canvas, so the type surface is the contract. The
  // export chain (FactoryWorldBuilder -> CellPort.stub) is validated at type
  // time by `tsc --noEmit` (npm run typecheck).
  const _world = createFactoryWorld; // referenced so the import is used
  ok(typeof _world === "function", "createFactoryWorld export present");
}

console.log(`\nverify-engine: all checks passed (engine v${ENGINE_VERSION})`);
