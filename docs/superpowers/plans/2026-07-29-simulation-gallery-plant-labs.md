# Simulation Gallery and Plant Labs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a modular simulation gallery and four control-oriented plant scenes: spring–mass–damper, DC motor, passive RLC, and active Sallen-Key, while preserving the existing cart-pole control experiment.

**Architecture:** A single experiment catalog drives the gallery. Pure TypeScript plant kernels expose state derivatives, output channels, model summaries, and scene data; a generic React shell owns the clock, playback, signal selection, plotting, and reset behavior. Object-specific parameter panels and SVG scenes plug into the shell without controller interfaces or object-specific branches in shared components.

**Tech Stack:** TypeScript, React 19, Vinext/Vite, SVG, existing `Plot` and `MathFormula` components, Node test runner, existing local matrix utilities.

## Global Constraints

- All code comments are Chinese.
- All simulation calculations remain local in the browser; no cloud server is required.
- Plant labs contain no controller, reference-tracking, closed-loop, PID, LQR, MPC, fuzzy, or neural-control interface.
- The gallery is driven by one registry; shared components contain no object-name conditionals.
- Physics kernels are pure functions and do not import React.
- Animations read normalized scene state and never integrate physics.
- One selected output is emphasized at a time; an input trace may appear only as a subdued reference.
- Parameter or topology changes rebuild the model and reset state.
- Invalid structures or non-finite states pause with a truthful error instead of fabricated data.
- No new runtime dependency is added.

---

## File Structure

**Core and catalog**

- Create `lib/simulation/core/types.ts`: common signal, output, runtime, formula, and experiment-card types.
- Create `lib/simulation/core/signals.ts`: constant, step, sine, pulse, and manual signal evaluation.
- Create `lib/simulation/core/integrate.ts`: reusable RK4 step and finite-state checks.
- Create `lib/simulation/experimentCatalog.ts`: single source of gallery metadata.
- Create `components/simulations/usePlantSimulation.ts`: generic clock/history hook.
- Create `components/simulations/PlantLabShell.tsx`: shared plant-lab layout and controls.
- Create `components/simulations/SimulationGallery.tsx`: two-category gallery.
- Create `components/simulations/SimulationWorkspace.tsx`: gallery/detail routing inside the simulation module.

**Spring lab**

- Create `lib/simulation/plants/springMass.ts`: topology builder, matrix model, outputs, analysis.
- Create `components/simulations/plants/SpringMassLab.tsx`: object adapter and parameters.
- Create `components/simulations/plants/SpringMassScene.tsx`: SVG animation.

**Motor lab**

- Create `lib/simulation/plants/dcMotor.ts`: coupled electrical/mechanical model.
- Create `components/simulations/plants/DcMotorLab.tsx`: object adapter and parameters.
- Create `components/simulations/plants/DcMotorScene.tsx`: rotor/load SVG animation.

**Circuit labs**

- Create `lib/simulation/plants/passiveRlc.ts`: series/parallel RLC models and outputs.
- Create `lib/simulation/plants/sallenKey.ts`: ideal and saturated active-filter model.
- Create `components/simulations/plants/PassiveRlcLab.tsx` and `PassiveRlcScene.tsx`.
- Create `components/simulations/plants/SallenKeyLab.tsx` and `SallenKeyScene.tsx`.

**Integration and tests**

- Modify `app/ControlLab.tsx`: render `SimulationWorkspace` instead of direct cart-pole.
- Modify `components/control-lab/Cover.tsx`: describe the simulation gallery rather than only cart-pole.
- Modify `app/globals.css`: gallery, shell, scene, parameter, responsive, and number-input styles.
- Modify `package.json`: add new test files to `npm test`.
- Create `tests/simulation-core.test.mjs`.
- Create `tests/simulation-catalog.test.mjs`.
- Create `tests/spring-mass.test.mjs`.
- Create `tests/dc-motor.test.mjs`.
- Create `tests/circuit-plants.test.mjs`.
- Create `tests/simulation-ui-contract.test.mjs`.

---

### Task 1: Shared Simulation Core

**Files:**
- Create: `lib/simulation/core/types.ts`
- Create: `lib/simulation/core/signals.ts`
- Create: `lib/simulation/core/integrate.ts`
- Test: `tests/simulation-core.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `PlantSignal`, `signalValue(signal, time, manualValue)`, `rk4Step(state, time, dt, derivative)`, `assertFiniteState(state)`, `PlantOutputChannel`, `PlantModelSummary`.

- [ ] **Step 1: Write the failing core test**

```js
import { signalValue } from "../lib/simulation/core/signals.ts";
import { rk4Step } from "../lib/simulation/core/integrate.ts";

test("共享信号覆盖手动、阶跃、正弦和脉冲", () => {
  assert.equal(signalValue({ kind: "manual" }, 1, -2.5), -2.5);
  assert.equal(signalValue({ kind: "step", amplitude: 3, start: 2 }, 1.9, 0), 0);
  assert.equal(signalValue({ kind: "step", amplitude: 3, start: 2 }, 2, 0), 3);
  assert.ok(Math.abs(signalValue({ kind: "sine", amplitude: 2, frequency: 0.5, phase: 0 }, 0.5, 0) - 2) < 1e-12);
  assert.equal(signalValue({ kind: "pulse", amplitude: 4, start: 1, duration: 0.2 }, 1.1, 0), 4);
});

test("RK4 对一阶衰减保持预期精度", () => {
  const next = rk4Step([1], 0, 0.1, (_t, [x]) => [-x]);
  assert.ok(Math.abs(next[0] - Math.exp(-0.1)) < 1e-6);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --experimental-strip-types --test tests/simulation-core.test.mjs`

Expected: FAIL because `core/signals.ts` and `core/integrate.ts` do not exist.

- [ ] **Step 3: Implement the minimal core**

```ts
export type PlantSignal =
  | { kind: "manual" }
  | { kind: "constant"; amplitude: number }
  | { kind: "step"; amplitude: number; start: number }
  | { kind: "sine"; amplitude: number; frequency: number; phase: number }
  | { kind: "pulse"; amplitude: number; start: number; duration: number };

export type PlantOutputChannel = {
  id: string;
  label: string;
  unit: string;
  read: (state: number[], input: number, derivative: number[]) => number;
};

export type PlantModelSummary = {
  equations: string[];
  metrics: { label: string; value: string }[];
};
```

Implement exact signal boundaries and a vector RK4 integrator. `assertFiniteState` throws `Error("仿真状态出现非有限数值")` when any value is non-finite.

- [ ] **Step 4: Run core tests and verify GREEN**

Run: `node --experimental-strip-types --test tests/simulation-core.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/simulation/core tests/simulation-core.test.mjs package.json
git commit -m "add reusable plant simulation core"
```

### Task 2: Experiment Catalog and Gallery Routing

**Files:**
- Create: `lib/simulation/experimentCatalog.ts`
- Create: `components/simulations/SimulationGallery.tsx`
- Create: `components/simulations/SimulationWorkspace.tsx`
- Modify: `app/ControlLab.tsx`
- Modify: `components/control-lab/Cover.tsx`
- Test: `tests/simulation-catalog.test.mjs`

**Interfaces:**
- Consumes: existing `InvertedPendulumLab`.
- Produces: `SimulationExperimentId`, `SIMULATION_EXPERIMENTS`, `groupExperiments(experiments)`, `experimentsByCategory(category)`, gallery/detail navigation.

- [ ] **Step 1: Write the failing catalog test**

```js
import { SIMULATION_EXPERIMENTS, experimentsByCategory } from "../lib/simulation/experimentCatalog.ts";

test("实验目录按两类注册且标识唯一", () => {
  assert.deepEqual(experimentsByCategory("plant").map(item => item.id), ["spring-mass", "dc-motor", "passive-rlc", "active-sallen-key"]);
  assert.deepEqual(experimentsByCategory("control").map(item => item.id), ["cart-pole"]);
  assert.equal(new Set(SIMULATION_EXPERIMENTS.map(item => item.id)).size, SIMULATION_EXPERIMENTS.length);
});

test("虚拟实验只通过注册即可进入对应分类", () => {
  const virtual = { id: "virtual-plant", category: "plant", index: "TEST", title: "虚拟对象", description: "架构测试", stateLabel: "x" };
  const grouped = groupExperiments([...SIMULATION_EXPERIMENTS, virtual]);
  assert.ok(grouped.plant.some(item => item.id === "virtual-plant"));
});
```

- [ ] **Step 2: Run the catalog test and verify RED**

Run: `node --experimental-strip-types --test tests/simulation-catalog.test.mjs`

Expected: FAIL because the catalog does not exist.

- [ ] **Step 3: Implement the registry and gallery**

```ts
export type SimulationExperimentCategory = "plant" | "control";
export type SimulationExperimentId = "spring-mass" | "dc-motor" | "passive-rlc" | "active-sallen-key" | "cart-pole";
export type SimulationExperimentCard = {
  id: SimulationExperimentId;
  category: SimulationExperimentCategory;
  index: string;
  title: string;
  description: string;
  stateLabel: string;
};
```

`SimulationWorkspace` owns `selected: SimulationExperimentId | null`; null renders the gallery. Every detail receives `onBack` and the existing module navigation callbacks. Do not add experiment ids to `ControlModuleId`.

`SimulationGallery` receives its experiment array as a prop defaulting to `SIMULATION_EXPERIMENTS`; grouping is performed only by `groupExperiments`. The virtual test proves the gallery classification mechanism does not require a new conditional branch.

- [ ] **Step 4: Run catalog and module-navigation tests**

Run: `node --experimental-strip-types --test tests/simulation-catalog.test.mjs tests/module-navigation.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/simulation/experimentCatalog.ts components/simulations/SimulationGallery.tsx components/simulations/SimulationWorkspace.tsx app/ControlLab.tsx components/control-lab/Cover.tsx tests/simulation-catalog.test.mjs
git commit -m "add modular simulation gallery"
```

### Task 3: Generic Plant Runtime and Shell

**Files:**
- Create: `components/simulations/usePlantSimulation.ts`
- Create: `components/simulations/PlantLabShell.tsx`
- Test: `tests/simulation-ui-contract.test.mjs`

**Interfaces:**
- Consumes: `PlantSignal`, `signalValue`, `rk4Step`, `PlantOutputChannel`, `PlantModelSummary`.
- Produces: `usePlantSimulation({ initialState, derivative, signal, manualInput, dt, output })` and `PlantLabShell` slots.

- [ ] **Step 1: Write the failing modularity contract test**

```js
test("公共实验外壳不包含对象专属分支和控制器入口", async () => {
  const shell = await readFile(new URL("../components/simulations/PlantLabShell.tsx", import.meta.url), "utf8");
  for (const forbidden of ["spring-mass", "dc-motor", "passive-rlc", "active-sallen-key", "PID", "LQR", "控制器"]) {
    assert.doesNotMatch(shell, new RegExp(forbidden, "i"));
  }
  assert.match(shell, /selectedOutput/);
  assert.match(shell, /onReset/);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/simulation-ui-contract.test.mjs`

Expected: FAIL because the shell does not exist.

- [ ] **Step 3: Implement the hook and slot-based shell**

```ts
export type PlantLabShellProps = {
  title: string;
  eyebrow: string;
  running: boolean;
  error: string;
  signal: PlantSignal;
  manualInput: number;
  outputs: PlantOutputChannel[];
  selectedOutput: string;
  history: { time: number; output: number; input: number }[];
  summary: PlantModelSummary;
  scene: ReactNode;
  parameters: ReactNode;
  onRunningChange: (running: boolean) => void;
  onSignalChange: (signal: PlantSignal) => void;
  onManualInputChange: (value: number) => void;
  onOutputChange: (id: string) => void;
  onReset: () => void;
  onBack: () => void;
};
```

The hook uses `requestAnimationFrame`, bounded accumulated time, fixed `dt`, and a history cap. It pauses and stores the thrown message on invalid state. It resets when its `modelKey` changes.

- [ ] **Step 4: Run the UI contract test**

Run: `node --test tests/simulation-ui-contract.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/simulations/usePlantSimulation.ts components/simulations/PlantLabShell.tsx tests/simulation-ui-contract.test.mjs
git commit -m "add reusable plant lab runtime"
```

### Task 4: Spring–Mass–Damper Plant

**Files:**
- Create: `lib/simulation/plants/springMass.ts`
- Create: `components/simulations/plants/SpringMassLab.tsx`
- Create: `components/simulations/plants/SpringMassScene.tsx`
- Test: `tests/spring-mass.test.mjs`

**Interfaces:**
- Produces: `SpringMassConfig`, `buildSpringMassModel(config)`, `springMassDerivative(model, time, state, force)`, output metadata, scene positions.

- [ ] **Step 1: Write failing physics tests**

```js
test("单质量无阻尼系统固有频率正确", () => {
  const model = buildSpringMassModel({ masses: [2], links: [{ left: -1, right: 0, spring: 18, damper: 0 }] });
  assert.ok(Math.abs(model.modes[0].omega - 3) < 1e-9);
});

test("双质量连接生成正确维度且力只作用于选中质量", () => {
  const model = buildSpringMassModel(defaultSpringMassConfig(2));
  assert.deepEqual(model.M.length, 2);
  assert.deepEqual(springMassDerivative(model, 0, [0, 0, 0, 0], 5, 1).slice(2), [0, 5 / model.M[1][1]]);
});

test("关闭弹簧和阻尼后拒绝无约束退化结构", () => {
  assert.throws(() => buildSpringMassModel({ masses: [1], links: [] }), /至少需要一个有效连接/);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/spring-mass.test.mjs`

Expected: FAIL because the plant kernel does not exist.

- [ ] **Step 3: Implement matrices and outputs**

Build diagonal `M`, symmetric `C`, and `K` by adding each link contribution. State order is `[x1..xn, v1..vn]`; derivative is `[v, M^-1(Fu-Cv-Kx)]`. Provide displacement, velocity, acceleration, spring-force, and damper-force channels.

- [ ] **Step 4: Implement the lab and SVG scene**

Support one to three masses, legal connection slots, spring/damper enable switches, physical parameters, target-mass force selection, signal inputs, and visual displacement clamping. Pass all shared controls to `PlantLabShell`; do not create a second clock.

- [ ] **Step 5: Run spring and core tests**

Run: `node --experimental-strip-types --test tests/spring-mass.test.mjs tests/simulation-core.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/simulation/plants/springMass.ts components/simulations/plants/SpringMassLab.tsx components/simulations/plants/SpringMassScene.tsx tests/spring-mass.test.mjs
git commit -m "add spring mass damper plant lab"
```

### Task 5: DC Motor Plant

**Files:**
- Create: `lib/simulation/plants/dcMotor.ts`
- Create: `components/simulations/plants/DcMotorLab.tsx`
- Create: `components/simulations/plants/DcMotorScene.tsx`
- Test: `tests/dc-motor.test.mjs`

**Interfaces:**
- Produces: `DcMotorParams`, `dcMotorDerivative(params, time, state, voltage, loadTorque)`, `dcMotorSteadyState`, output channels and model summary.

- [ ] **Step 1: Write failing motor tests**

```js
test("直流电机稳态满足电气和机械平衡", () => {
  const steady = dcMotorSteadyState(DEFAULT_DC_MOTOR_PARAMS, 12, 0.2);
  assert.ok(Math.abs(12 - DEFAULT_DC_MOTOR_PARAMS.R * steady.current - DEFAULT_DC_MOTOR_PARAMS.ke * steady.speed) < 1e-10);
  assert.ok(Math.abs(DEFAULT_DC_MOTOR_PARAMS.kt * steady.current - DEFAULT_DC_MOTOR_PARAMS.b * steady.speed - 0.2) < 1e-10);
});

test("零状态零输入保持静止", () => {
  assert.deepEqual(dcMotorDerivative(DEFAULT_DC_MOTOR_PARAMS, 0, [0, 0, 0], 0, 0), [0, 0, 0]);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/dc-motor.test.mjs`

Expected: FAIL because the motor kernel does not exist.

- [ ] **Step 3: Implement the coupled model**

Use state `[i, omega, theta]` and equations:

```ts
return [
  (voltage - params.R * i - params.ke * omega) / params.L,
  (params.kt * i - params.b * omega - loadTorque) / params.J,
  omega,
];
```

Validate `R,L,ke,kt,J > 0` and `b >= 0`. Provide current, speed, angle, electromagnetic torque, and mechanical power outputs.

- [ ] **Step 4: Implement motor controls and scene**

The main signal drives voltage. A compact secondary editor provides constant, step, or pulse load torque. The scene rotates the shaft modulo one turn while numeric speed remains unbounded and truthful.

- [ ] **Step 5: Run motor tests**

Run: `node --experimental-strip-types --test tests/dc-motor.test.mjs tests/simulation-core.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/simulation/plants/dcMotor.ts components/simulations/plants/DcMotorLab.tsx components/simulations/plants/DcMotorScene.tsx tests/dc-motor.test.mjs
git commit -m "add dc motor plant lab"
```

### Task 6: Passive RLC Plant

**Files:**
- Create: `lib/simulation/plants/passiveRlc.ts`
- Create: `components/simulations/plants/PassiveRlcLab.tsx`
- Create: `components/simulations/plants/PassiveRlcScene.tsx`
- Test: `tests/circuit-plants.test.mjs`

**Interfaces:**
- Produces: `PassiveRlcConfig`, `buildPassiveRlcModel`, derivative functions for series voltage-driven and parallel current-driven presets, output channels.

- [ ] **Step 1: Write failing passive-circuit tests**

```js
test("串联 RLC 极点满足标准特征方程", () => {
  const model = buildPassiveRlcModel({ topology: "series", R: 4, L: 2, C: 0.125 });
  assert.deepEqual(model.denominator.map(value => Number(value.toPrecision(8))), [1, 2, 4]);
});

test("无源零输入响应来自初始储能", () => {
  const derivative = passiveRlcDerivative({ topology: "series", R: 1, L: 1, C: 1 }, 0, [1, 0], 0);
  assert.notDeepEqual(derivative, [0, 0]);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/circuit-plants.test.mjs`

Expected: FAIL because `passiveRlc.ts` does not exist.

- [ ] **Step 3: Implement series and parallel presets**

For series voltage drive use state `[i, vC]`; for parallel current drive use `[v, iL]`. Enabled preset slots reduce to equivalent positive `R`, `L`, and `C`; reject a structure that cannot store energy or forms a singular ideal model. Return selected component voltage/current and total stored energy.

- [ ] **Step 4: Implement circuit controls and scene**

Render valid slots, enable switches, component values, source selection, initial capacitor voltage, and initial inductor current. The scene animates current direction and node voltage color without implying electron-level simulation.

- [ ] **Step 5: Run circuit tests**

Run: `node --experimental-strip-types --test tests/circuit-plants.test.mjs tests/simulation-core.test.mjs`

Expected: PASS for passive tests.

- [ ] **Step 6: Commit**

```bash
git add lib/simulation/plants/passiveRlc.ts components/simulations/plants/PassiveRlcLab.tsx components/simulations/plants/PassiveRlcScene.tsx tests/circuit-plants.test.mjs
git commit -m "add passive rlc plant lab"
```

### Task 7: Active Sallen-Key Plant

**Files:**
- Create: `lib/simulation/plants/sallenKey.ts`
- Create: `components/simulations/plants/SallenKeyLab.tsx`
- Create: `components/simulations/plants/SallenKeyScene.tsx`
- Modify: `tests/circuit-plants.test.mjs`

**Interfaces:**
- Produces: `SallenKeyParams`, `sallenKeyCoefficients`, `sallenKeyDerivative`, `sallenKeyMetrics`, ideal and saturated output channels.

- [ ] **Step 1: Add failing active-circuit tests**

```js
test("等值元件单位增益 Sallen-Key 的自然频率正确", () => {
  const metrics = sallenKeyMetrics({ R1: 10_000, R2: 10_000, C1: 100e-9, C2: 100e-9, gain: 1, saturation: 12 });
  assert.ok(Math.abs(metrics.omegaN - 1000) < 1e-8);
  assert.ok(Math.abs(metrics.dcGain - 1) < 1e-12);
});

test("输出饱和不篡改理想输出通道", () => {
  const output = sallenKeyOutputs({ saturation: 5 }, [8, 2]);
  assert.equal(output.ideal, 8);
  assert.equal(output.actual, 5);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/circuit-plants.test.mjs`

Expected: FAIL because active-filter exports do not exist.

- [ ] **Step 3: Implement active-filter coefficients and state model**

Generate the second-order denominator from `R1,R2,C1,C2,gain`, expose natural frequency, damping ratio, DC gain, poles, and a compact Bode summary. Keep ideal linear state evolution separate from output clipping so the UI can compare both truthfully.

- [ ] **Step 4: Implement Sallen-Key controls and scene**

Use a fixed topology. Parameters are `R1,R2,C1,C2`, feedback gain, saturation enable, and saturation voltage. Render feedback direction, node voltages, and a clear saturation indicator. Do not expose transistor-level fields.

- [ ] **Step 5: Run circuit tests**

Run: `node --experimental-strip-types --test tests/circuit-plants.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/simulation/plants/sallenKey.ts components/simulations/plants/SallenKeyLab.tsx components/simulations/plants/SallenKeyScene.tsx tests/circuit-plants.test.mjs
git commit -m "add active sallen key plant lab"
```

### Task 8: Visual System, Responsive Layout, and Full Verification

**Files:**
- Modify: `app/globals.css`
- Modify: `tests/simulation-ui-contract.test.mjs`
- Modify: `tests/rendered-html.test.mjs`
- Modify: any simulation file only when verification reveals a scoped defect.

**Interfaces:**
- Consumes all prior tasks.
- Produces finished visual system and verified application.

- [ ] **Step 1: Extend UI contract tests before styling**

```js
test("被控对象数值输入隐藏原生步进按钮", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.plant-number input[^}]*appearance:\s*textfield/s);
  assert.match(css, /\.plant-number input::-webkit-inner-spin-button[^}]*appearance:\s*none/s);
});

test("大厅具有两类标题和统一实验卡片", async () => {
  const source = await readFile(new URL("../components/simulations/SimulationGallery.tsx", import.meta.url), "utf8");
  assert.match(source, /被控对象/);
  assert.match(source, /验证算法/);
  assert.match(source, /SIMULATION_EXPERIMENTS/);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/simulation-ui-contract.test.mjs`

Expected: FAIL until final CSS and gallery classes exist.

- [ ] **Step 3: Implement the visual system**

Use the existing near-black palette, fine borders, lime accent, compact typography, and number-field treatment. The gallery must read as a high-level index, while each lab uses a consistent animation/parameter/result hierarchy. Add responsive breakpoints so the sidebar stacks without horizontal scrolling.

- [ ] **Step 4: Run static verification**

Run: `npm run lint`

Expected: exit 0 with no warnings.

Run: `npm test`

Expected: build succeeds and all tests pass.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 5: Run browser verification**

Start: `npm run start -- --port 4173 --ip 127.0.0.1`

Verify:

1. Home → 动力学仿真 opens the gallery.
2. Both category headings render and no horizontal scrollbar appears.
3. Each of four plant cards opens, accepts parameter changes, runs, pauses, resets, changes input, and changes one output channel.
4. Parameter changes reset the clock and update equations/metrics.
5. Cart-pole still opens and its PID/LQR controls remain functional.
6. Browser console has no React, worker, asset, or numerical errors.
7. CSS and JavaScript asset requests return HTTP 200.

- [ ] **Step 6: Commit and push**

```bash
git add app/globals.css tests/simulation-ui-contract.test.mjs tests/rendered-html.test.mjs components/simulations lib/simulation app/ControlLab.tsx components/control-lab/Cover.tsx package.json
git commit -m "complete modular plant simulation gallery"
git push origin main
```
