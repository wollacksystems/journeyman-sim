import type { ScenarioBeat, ScenarioCell, ScenarioDef } from "../scenario/types";
import { createRng, hashSeed, type Rng } from "./rng";
import { toWorld, toWorldXZ, type EnvSpec } from "./environment";

/**
 * Failure-mode template framework.
 *
 * A template is a parametric ScenarioDef: beats authored in the machine frame
 * (machine at origin, front toward +Z) are mapped into the environment's
 * world frame at build time, so any template runs in any generated
 * environment unmodified. Templates are host content — the library ships the
 * framework and the deterministic generator, hosts supply the templates.
 *
 * @module
 * @example
 * ```ts
 * import { createRng } from "@/factory/rng.ts";
 * import { generateEnvironment } from "@/factory/environment.ts";
 * import { buildScenario, scenarioSeedFor } from "@/factory/scenario-template.ts";
 *
 * const env = generateEnvironment(31337, 0, createRng(31337));
 * const scenario = buildScenario(env, myTemplate); // myTemplate: ScenarioTemplate
 * scenario.id;            // stable recall identity
 * scenario.lesson;        // ground-truth labels for ingest
 * scenario.beats.length;  // scripted beat timeline
 * ```
 */

/** Generated ScenarioDef plus provenance for manifests and grounding. */
export interface FactoryScenario extends ScenarioDef {
  /** Template the scenario was generated from. */
  templateId: string;
  /** Repeat index of the template within its environment (0 for the first). */
  slot: number;
  /** World position the scenario's active cell state anchors to. */
  faultWorld: readonly [number, number, number];
}

/** Beat durations with seeded jitter, plus the fault onset/clear points. */
export interface Timing {
  tEnd: number;
  /** Failure state appears when the walk ends. */
  failSec: number;
  /** Hands-on (inspect/wipe/reach) beat start + end. */
  handsOnStart: number;
  handsOnEnd: number;
  /** Final watch/verify beat start. */
  verifyStart: number;
  /** Failure state clears mid-verify (locked-corpus shape). */
  clearAt: number;
  /** Signal stack kicks green. */
  greenAt: number;
}

function timing(rng: Rng, tEnd: number): Timing {
  const failSec = 10;
  const listenDur = 10 + rng.range(-1.5, 1.5);
  const handsDur = 12 + rng.range(-1.5, 1.5);
  const verifyDur = 8 + rng.range(-1, 1);
  const handsOnStart = failSec + listenDur;
  const handsOnEnd = handsOnStart + handsDur;
  const verifyStart = handsOnEnd + verifyDur;
  const clearAt = handsOnEnd + verifyDur / 2;
  const greenAt = Math.min(clearAt + 3.5, tEnd - 2);
  return { tEnd, failSec, handsOnStart, handsOnEnd, verifyStart, clearAt, greenAt };
}

/** Narration times for the six standard lines, derived from the timing. */
export type NarrationTimes = readonly [number, number, number, number, number, number];

function narrationTimes(t: Timing): NarrationTimes {
  return [
    2,
    t.failSec + 1,
    t.handsOnStart + 3,
    t.handsOnEnd - 4,
    t.clearAt + 1,
    Math.max(t.greenAt + 2, t.tEnd - 6),
  ];
}

/** Red->amber->green signal timeline shared by the failure/resolution arc. */
export function redAmberGreen(t: Timing): ScenarioCell["signals"] {
  return [
    { tStart: 0, red: 1, amber: 0, green: 0 },
    { tStart: t.clearAt, red: 0, amber: 1, green: 0 },
    { tStart: t.greenAt, red: 0, amber: 0, green: 1 },
  ];
}

export interface ScenarioTemplate {
  id: string;
  title: string;
  role: string;
  /** Fault ground point in machine frame (world-mapped for faultWorld). */
  faultAnchor: readonly [number, number, number];
  /** Machine-frame stand spot for the hands-on beat. */
  handsOnStandXZ: readonly [number, number];
  /** Machine-frame look point for the verify beat. */
  verifyLook: readonly [number, number, number];
  /** Lean + reach for the hands-on beat (hand target is faultAnchor). */
  lean: number;
  hand: "left" | "right";
  /**
   * When set, all lateral (X) anchors mirror to `env.atcSide` at build time —
   * the pod-relative-version of a tool-changer template whose anchors must
   * flip with the environment's changer side.
   */
  mirrorX?: boolean;
  /** Seeded narration from the template's bank. */
  narration(rng: Rng, times: NarrationTimes): Array<{ t: number; text: string }>;
  lesson(rng: Rng): { title: string; body: string };
  /** Seeded cell timeline (fault window + signal stack). */
  cell(rng: Rng, t: Timing): ScenarioCell;
}

function buildBeats(
  template: ScenarioTemplate,
  env: EnvSpec,
  t: Timing,
  spots: {
    approach: [number, number];
    verify: [number, number];
    faultWorld: [number, number, number];
    verifyLookWorld: [number, number, number];
    stackWorld: [number, number, number];
  },
): ScenarioBeat[] {
  const stand = toWorldXZ(env, template.handsOnStandXZ);
  return [
    {
      id: "walk_up",
      label: "Walk up to the cell",
      tStart: 0,
      tEnd: t.failSec,
      cameraHint: "side-a",
      motion: {
        pose: "walk",
        walkFrom: spots.approach,
        walkTo: spots.verify,
        look: spots.faultWorld,
      },
    },
    {
      id: "locate_fault",
      label: "Locate the fault",
      tStart: t.failSec,
      tEnd: t.handsOnStart,
      cameraHint: "head",
      motion: { pose: "stand", standAt: stand, lean: template.lean * 0.55, look: spots.faultWorld },
    },
    {
      id: "hands_on",
      label: "Step in and clear the fault",
      tStart: t.handsOnStart,
      tEnd: t.handsOnEnd,
      cameraHint: "head",
      motion: {
        pose: "wipe",
        standAt: stand,
        lean: template.lean,
        reach: { hand: template.hand, target: spots.faultWorld },
        look: spots.faultWorld,
      },
    },
    {
      id: "verify_clear",
      label: "Back off and verify the fault clears",
      tStart: t.handsOnEnd,
      tEnd: t.verifyStart,
      cameraHint: "chest",
      motion: { pose: "stand", standAt: spots.verify, lean: 0.12, look: spots.verifyLookWorld },
    },
    {
      id: "all_clear",
      label: "Signal stack confirms amber-to-green",
      tStart: t.verifyStart,
      tEnd: t.tEnd,
      cameraHint: "side-b",
      motion: { pose: "stand", standAt: spots.verify, look: spots.stackWorld },
    },
  ];
}

function flipXZ(p: readonly [number, number], side: 1 | -1): [number, number] {
  return [p[0] * side, p[1]];
}

/** Pick an element different from `not` (banks always have >= 2 entries). */
export function pickOther<T>(rng: Rng, items: readonly T[], not: T): T {
  const choice = rng.pick(items);
  if (choice !== not) return choice;
  return items[(items.indexOf(not) + 1) % items.length]!;
}

/**
 * Approach spot: ~2.2 m straight out from the machine front (world-computed)
 * with a small seeded lateral offset, mirroring the locked corpus walk arc in
 * every generated orientation.
 */
function approachSpot(env: EnvSpec, verify: readonly [number, number], rng: Rng): [number, number] {
  const front = toWorldXZ(env, [0, 1]);
  const lateral = toWorldXZ(env, [1, 0]);
  const j = rng.range(-0.4, 0.4);
  return [verify[0] + front[0] * 2.2 + lateral[0] * j, verify[1] + front[1] * 2.2 + lateral[1] * j];
}

/**
 * The canonical per-scenario sub-seed: a pure function of (environment,
 * template id, slot). Generation and corpus export both route through this so
 * exported seeds always reproduce their scenario exactly.
 *
 * @example
 * ```ts
 * // Reproduce one scenario without replanning the whole corpus:
 * const seed = scenarioSeedFor(env, "way-lube", 0);
 * const again = buildScenario(env, template, 50, 0);
 * again.seed === seed; // true — the index's `seed` field matches
 * ```
 */
export function scenarioSeedFor(env: EnvSpec, templateId: string, slot = 0): number {
  return hashSeed(`${env.seed}:${env.id}:${templateId}:${slot}`);
}

/**
 * Build one ScenarioDef deterministically from (env, template, slot): a
 * parametric manifestation of a failure mode expressed through seeded
 * environment binding, narration picks, and beat-timing jitter. Output is a
 * plain ScenarioDef, so the existing drive/apply/capture stack runs generated
 * scenarios unmodified.
 *
 * Scripts are authored in the machine frame (the frame hosts use) and mapped
 * into the environment's world frame, so any template runs in any generated
 * environment. `mirrorX` templates flip their lateral anchors with
 * `env.atcSide` (the mirrored side of a tool-changer pod, for example).
 */
export function buildScenario(
  env: EnvSpec,
  template: ScenarioTemplate,
  durationSec = 50,
  slot = 0,
): FactoryScenario {
  // The slot disambiguates repeated templates within one environment and
  // diversifies their timing/narration.
  const rng = createRng(scenarioSeedFor(env, template.id, slot));
  const t = timing(rng, durationSec);

  // Pod-relative anchors mirror with the environment's side when the template
  // opts in (host mirrors its own geometry to match).
  const side = template.mirrorX ? env.atcSide : 1;
  const flip = (p: readonly [number, number, number]): [number, number, number] => [
    p[0] * side,
    p[1],
    p[2],
  ];
  const faultWorld = toWorld(env, flip(template.faultAnchor));

  const verify = toWorldXZ(env, [0, 0.95]);
  const approach = approachSpot(env, verify, rng);
  const stackWorld = toWorld(env, [-4.6, 2.5, -4.3]);
  const verifyLookWorld = toWorld(env, flip(template.verifyLook));
  const times = narrationTimes(t);

  const beats = buildBeats(
    { ...template, handsOnStandXZ: flipXZ(template.handsOnStandXZ, side) },
    env,
    t,
    { approach, verify, faultWorld, verifyLookWorld, stackWorld },
  );

  return {
    id: slot === 0 ? `${template.id}-${env.id}` : `${template.id}-${env.id}-${slot}`,
    templateId: template.id,
    slot,
    title: template.title,
    role: template.role,
    durationSec: t.tEnd,
    fps: 30,
    cameras: ["side-a", "side-b", "head", "chest"],
    beats,
    narration: template.narration(rng, times),
    lesson: template.lesson(rng),
    cell: template.cell(rng, t),
    faultWorld,
  };
}
