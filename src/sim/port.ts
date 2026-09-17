import type { Object3D } from "three";
import type { ScenarioState } from "../scenario/drive";

/**
 * The scenario-driven cell seam.
 *
 * The engine applies avatar motion generically and delegates every cell-side
 * visual to this port, so the library stays free of machine-specific geometry.
 * Host projects (e.g. a CNC machine cell) implement the port from their own
 * meshes and hand it to the factory world through {@link FactoryWorldOptions.buildCell}.
 */
export interface CellPort {
  /** Root object mounted in the shared factory scene (host geometry). */
  readonly object3d: Object3D;
  /** Apply one deterministic scenario state to the cell. */
  apply(state: ScenarioState): void;
}
