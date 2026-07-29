# Modern Control Chain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有状态空间模块中加入状态反馈、极点配置、LQR、观测器、卡尔曼滤波和输出反馈仿真。

**Architecture:** 数值设计与仿真集中在 `lib/modernControl.ts`；React 组件只编辑参数并消费统一结果。`StateSpaceLab` 继续持有唯一模型状态，通过一级页签切换矩阵工作台和控制设计器。

**Tech Stack:** TypeScript、React、现有 SVG Plot、Node test runner

## Global Constraints

- 不增加依赖，不增加后端。
- SISO 极点配置仅在条件满足时执行。
- 代码注释使用中文。
- 页面保持紧凑，不增加大面积说明文字。

---

### Task 1: 现代控制数值内核

**Files:**
- Create: `lib/modernControl.ts`
- Test: `tests/modern-control.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `placeSisoPoles(A, B, poles): number[][]`
- Produces: `designDiscreteLqr(A, B, q, r, dt?): number[][]`
- Produces: `placeObserverPoles(A, C, poles): number[][]`
- Produces: `designKalmanGain(A, C, processNoise, measurementNoise, dt?): number[][]`
- Produces: `simulateOutputFeedback(config): ModernControlSimulation`

- [ ] Write tests proving pole placement gives requested eigenvalues, LQR stabilizes an unstable controllable plant, observer error converges, and Kalman gain has `n×p` dimensions.
- [ ] Run `node --experimental-strip-types --test tests/modern-control.test.mjs` and confirm failure because the module is absent.
- [ ] Implement matrix helpers, Ackermann pole placement, discrete Riccati iteration, dual observer design and output-feedback simulation.
- [ ] Rerun the targeted test and confirm all assertions pass.

### Task 2: 反馈与估计设计器

**Files:**
- Create: `components/modern-control/ModernControlDesigner.tsx`
- Modify: `components/modern-control/StateSpaceLab.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `StateSpacePreset` and all Task 1 functions.
- Produces: `<ModernControlDesigner model={model} />`.

- [ ] Add a compact “状态空间 / 反馈与估计” switch to `StateSpaceLab`.
- [ ] Implement controller modes `lqr | poles | manual` and estimator modes `kalman | poles | full-state`.
- [ ] Render gain editors, requested poles, Q/R noise weights, true/estimated state plots, error plot, input plot and pole summary.
- [ ] Add responsive styles without nested vertical scrolling.
- [ ] Run `npm run lint` and correct type or accessibility failures.

### Task 3: Integration verification

**Files:**
- Modify: `README.md`

- [ ] Document the completed modern-control path.
- [ ] Run `npm test` and `git diff --check`; expected exit code 0.

