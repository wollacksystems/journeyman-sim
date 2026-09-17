# journeyman-sim

Domain-neutral 3D simulation factory: a seeded multi-camera scene rig, a
scripted scenario framework, and a deterministic footage + corpus export
pipeline. Everything is a pure derivation of a seed — the same seed drives
the same avatar, the same scenario states, and the same captured frames.

The library carries no machine-specific content. Host projects (e.g. a CNC
training harness) plug their domain in through two seams:

1. **`CellPort`** — the scenario-driven cell. Hosts implement it over their
   own geometry and inject it into the factory world via `buildCell`.
2. **Scenario templates** — hosts author `ScenarioTemplate`s (failure modes,
   narration banks, cell timelines) and inject the registry through
   `createSimulation`/`planFactory`.

## Usage

```ts
import { createSimulation, generateEnvironment, createFactoryWorld } from "journeyman-sim/factory";
import { createAvatar, applyScenario, driveScenario } from "journeyman-sim";
```

Two package subpaths, two layers:

- `journeyman-sim` — the engine root: avatar, camera rig, clock, scenario
  types + driver, `applyScenario`, `CellPort`, capture batch utils, manifest.
- `journeyman-sim/factory` — the factory API: `createSimulation(spec, deps)`,
  `planFactory`, environment generation, the `ScenarioTemplate` framework,
  corpus artifacts, and the headless ingest readers.

### Minimal host

```ts
// 1. Declare the corpus: seed + shape + injected templates.
const sim = createSimulation(
  { seed: 2026, shape: { envCount: 2, perEnv: 1 } },
  { templates: myTemplates }, // host failure modes
);

// 2. Describe / plan purely (no WebGL anywhere).
const summary = sim.describe();
const plan = sim.plan();

// 3. Render + export through a live world (browser side).
//    const world = createFactoryWorld(rig, LOCKED_ENV, { buildCell });
//    const results = await sim.render(world);
//    const exported = await sim.export(plan, results);
```

## Determinism contract

- `planFactory(rootSeed, opts)` — seed → environments → scenarios; identical
  seeds produce identical plans.
- `buildScenario(env, template, durationSec, slot)` — one scenario from one
  template in one environment; `scenarioSeedFor(env, templateId, slot)` is
  the canonical per-scenario sub-seed.
- Corpus paths and JSON are pure functions of the root seed — re-exporting
  with the same seed overwrites in place with byte-identical documents.

## Install

Consume via git dependency (semver-tagged releases; the `prepare` script
builds `dist/` on install):

```json
{
  "dependencies": {
    "journeyman-sim": "github:wollacksystems/journeyman-sim#v1.0.0"
  }
}
```

## Development

```sh
npm install
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run format      # prettier
npm run verify      # headless engine-seam suite (DI proof, no host content)
npm run build       # tsc + tsup -> dist/ (root + ./factory subpaths)
npm run docs:api    # TypeDoc -> docs/api (CI publishes to GitHub Pages)
```
