/**
 * journeyman-sim: the domain-neutral simulation library behind a seeded
 * factory footage pipeline.
 *
 * Everything here is a pure derivation of a seed: the same seed drives the
 * same avatar, the same scenario states, and the same captured frames.
 * Machine-specific content (cell geometry, failure-mode templates, footage
 * encoding hooks) stays in host projects, which plug in through two seams:
 * the {@link CellPort} (scenario-driven cell visuals) and the factory's
 * injected template registry (`journeyman-sim/factory`).
 *
 * Ships as the package root; the factory API is the `journeyman-sim/factory`
 * subpath.
 *
 * @module
 * @example Drive a scenario headlessly (three vector math only — no WebGL):
 * ```ts
 * import { applyScenario, driveScenario, createAvatar } from "journeyman-sim";
 * import type { ScenarioDef } from "journeyman-sim";
 *
 * const avatar = createAvatar();
 * const state = driveScenario(def, t); // def: ScenarioDef
 * applyScenario(state, avatar, cellPort); // cellPort: CellPort
 * ```
 */
export { createAvatar, ARM_UPPER, ARM_FOREARM } from "./avatar";
export type { Arm, Avatar } from "./avatar";

export { CameraRig, VIEWPORT_GRID } from "./rig";
export type { CameraId, Viewport } from "./rig";

export { FrameClock } from "./clock";
export type { ClockState } from "./clock";

export { ENGINE_VERSION } from "./version";

export { buildCaptureManifest } from "./manifest";
export type { CameraIntrinsic, CaptureManifest } from "./manifest";

// Escape-hatch surface used by the factory app (headless-safe).
export { captureBatch, downloadBlob, CAPTURE_WIDTH, CAPTURE_HEIGHT } from "./capture/batch";
export type { BatchOptions, BatchProgress, BatchResult } from "./capture/batch";

export { applyScenario } from "./sim/apply";
export type { CellPort } from "./sim/port";

export { driveScenario } from "./scenario/drive";
export type { ScenarioState } from "./scenario/drive";
export { beatAt, clamp01, lerp, smoothstep, validateScenario } from "./scenario/types";
export type {
  NarrationLine,
  ReachPose,
  ScenarioBeat,
  ScenarioBeatMotion,
  ScenarioCell,
  ScenarioDef,
  ScenarioLesson,
  ScenarioPose,
  SignalState,
} from "./scenario/types";

// The factory API (also importable as the `journeyman-sim/factory` subpath).
export * from "./factory/index";
