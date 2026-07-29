# System Identification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增独立的系统辨识模块，并把首页重排为系统分析、现代控制、系统辨识和仿真四块。

**Architecture:** `lib/systemIdentification.ts` 提供纯数值 ARX 工作流；独立页面负责数据输入、模型阶次和验证图。导航只传递页面切换回调，不让系统辨识依赖传函或现代控制状态。

**Tech Stack:** TypeScript、React、现有 SVG Plot、Node test runner

## Global Constraints

- CSV 使用 `t,u,y` 三列。
- ARX 阶次限制为 1–4，延迟限制为 0–4。
- 默认数据在浏览器本地生成，不增加上传服务或数据库。
- 首页不再出现“闭环控制”主卡片。

---

### Task 1: ARX 数值内核

**Files:**
- Create: `lib/systemIdentification.ts`
- Create: `tests/system-identification.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `parseIdentificationCsv(text): IdentificationSample[]`
- Produces: `fitArx(samples, orders): ArxResult`
- Produces: `simulateArx(samples, model): number[]`
- Produces: `identificationMetrics(measured, estimated): { rmse, fitPercent }`
- Produces: `IDENTIFICATION_EXAMPLES`

- [ ] Write tests for CSV headers, known ARX coefficient recovery, free simulation and fit percentage.
- [ ] Run the targeted test and confirm failure because the module is absent.
- [ ] Implement parsing, normal-equation least squares with pivoting, ARX free simulation and deterministic noisy examples.
- [ ] Rerun the targeted test and confirm all assertions pass.

### Task 2: Independent identification page

**Files:**
- Create: `components/identification/SystemIdentificationLab.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: Task 1 exports and `Plot`.
- Produces: `<SystemIdentificationLab onHome onAnalysis onModern />`.

- [ ] Implement source selector, CSV editor, na/nb/nk controls and explicit “开始辨识” action.
- [ ] Implement data, fitted response and residual tabs with one large plot.
- [ ] Show equation, coefficients, RMSE, fit percentage and sample count in a compact result rail.
- [ ] Add responsive styling consistent with the matrix studio.

### Task 3: Four-module navigation

**Files:**
- Modify: `app/ControlLab.tsx`
- Modify: `components/control-lab/Cover.tsx`
- Modify: `app/globals.css`
- Modify: `README.md`

- [ ] Add the `identification` surface and page callbacks.
- [ ] Replace the cover's closed-loop card with modern control and add system identification as module 03; simulation becomes module 04.
- [ ] Keep classic closed-loop controls inside the system-analysis workbench.
- [ ] Update cover grid styling and README capability list.
- [ ] Run `npm run lint`, `npm test` and `git diff --check`; expected exit code 0.
