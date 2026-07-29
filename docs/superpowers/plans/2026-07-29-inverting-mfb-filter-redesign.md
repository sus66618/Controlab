# Inverting MFB Filter Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Sallen-Key plant experiment with a physically consistent inverting second-order MFB low-pass experiment.

**Architecture:** A dedicated `mfbLowPass` model owns coefficients, state dynamics, outputs and summaries. The scene consumes a declarative topology from the shared scene-geometry module, while the experiment registry remains the only navigation source of truth.

**Tech Stack:** TypeScript, React, SVG, Node test runner, CSS.

## Global Constraints

- 所有代码注释使用中文。
- 不新增依赖，不在项目目录外创建项目文件。
- 原理图、公式和仿真必须基于同一组元件参数。
- 饱和限幅可以保留为仿真选项，但不得绘制饱和进度条。

---

### Task 1: MFB 数学模型

**Files:**
- Create: `lib/simulation/plants/mfbLowPass.ts`
- Delete: `lib/simulation/plants/sallenKey.ts`
- Modify: `tests/circuit-plants.test.mjs`

**Interfaces:**
- Produces: `MfbLowPassParams`, `DEFAULT_MFB_LOW_PASS_PARAMS`, `mfbLowPassMetrics`, `mfbLowPassDerivative`, `mfbLowPassOutputs`, `mfbLowPassOutputChannels`, `mfbLowPassSummary`.

- [ ] 写出负直流增益、手算二阶系数和输出限幅测试。
- [ ] 运行测试，确认因新 API 尚不存在而失败。
- [ ] 按设计文档中的传递函数实现模型和参数校验。
- [ ] 运行模型测试，确认通过。

### Task 2: 反相拓扑几何与 SVG 场景

**Files:**
- Modify: `lib/simulation/scenes/geometry.ts`
- Modify: `tests/simulation-scene-geometry.test.mjs`
- Create: `components/simulations/plants/MfbLowPassScene.tsx`
- Delete: `components/simulations/plants/SallenKeyScene.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: `MFB_LOW_PASS_TOPOLOGY` with explicit input, inverting input, grounded non-inverting input, `R3` feedback and `C2` feedback endpoints.

- [ ] 将几何测试改为反相 MFB 的端点约束并运行，确认失败。
- [ ] 实现新拓扑常量和无悬空端点的静态 SVG。
- [ ] 删除场景中的饱和度横条和对应 CSS。
- [ ] 运行几何测试，确认通过。

### Task 3: 实验注册、参数界面与封面

**Files:**
- Create: `components/simulations/plants/MfbLowPassLab.tsx`
- Delete: `components/simulations/plants/SallenKeyLab.tsx`
- Modify: `components/simulations/SimulationWorkspace.tsx`
- Modify: `components/simulations/ExperimentCoverVisual.tsx`
- Modify: `lib/simulation/experimentCatalog.ts`
- Modify: `app/globals.css`
- Modify: `tests/simulation-catalog.test.mjs`
- Modify: `tests/simulation-ui-contract.test.mjs`

**Interfaces:**
- Consumes: Task 1 model API and Task 2 scene.
- Produces: registered experiment ID `active-mfb` and its static cover.

- [ ] 先把目录和 UI 契约测试改为 `active-mfb`，确认旧实现失败。
- [ ] 接入新实验组件，提供 R1、R2、R3、C1、C2 与可选限幅参数。
- [ ] 重画大厅封面并移除旧命名。
- [ ] 运行相关测试，确认通过。

### Task 4: 完整验证与交付

**Files:**
- Verify all changed files.

- [ ] 运行 `npm test`、`npm run lint` 和 `git diff --check`。
- [ ] 在本地浏览器检查实验大厅与 MFB 场景，确认没有断线或饱和横条。
- [ ] 检查控制台错误。
- [ ] 提交并推送 `main`。
