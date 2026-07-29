# Matrix Scrollbar and Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一状态空间页面的横向滚动条视觉，并让“重置”恢复首次进入页面时的完整状态。

**Architecture:** 在状态空间模型模块提供唯一的初始模型工厂，组件首次加载和重置共同调用它，避免两套默认值漂移。滚动条仅使用 CSS 原生伪元素和 `scrollbar-color`，不引入自制滚动组件。

**Tech Stack:** React、TypeScript、CSS、Node.js test runner

## Global Constraints

- 滚动条轨道与深色容器融合，滑块悬停时适度提亮。
- 保留浏览器原生滚动、触控板和键盘行为。
- 重置恢复默认模型、状态响应页签、收起分析、关闭粘贴面板并清空粘贴状态。
- 不增加依赖。

---

### Task 1: 统一初始模型与重置行为

**Files:**
- Modify: `lib/stateSpace.ts`
- Modify: `components/modern-control/StateSpaceLab.tsx`
- Test: `tests/control-math.test.mjs`

**Interfaces:**
- Produces: `createInitialStateSpaceModel(): StateSpacePreset`
- Consumes: `STATE_SPACE_PRESETS[0]` 与 `clonePreset`

- [ ] **Step 1: Write the failing test**

```js
test("状态空间重置会返回独立的初始模型快照", () => {
  const first = createInitialStateSpaceModel();
  first.A[0][0] = 99;
  const reset = createInitialStateSpaceModel();
  assert.deepEqual(reset, STATE_SPACE_PRESETS[0]);
  assert.notEqual(first.A, reset.A);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/control-math.test.mjs`
Expected: FAIL because `createInitialStateSpaceModel` is not exported.

- [ ] **Step 3: Write minimal implementation**

```ts
export function createInitialStateSpaceModel() {
  return clonePreset(STATE_SPACE_PRESETS[0]);
}
```

组件初始化调用该函数；`resetWorkspace` 同时恢复 `model`、`view`、`detail`、`pasteTarget`、`pasteText` 和 `pasteError`，按钮文案改为“重置”。

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/control-math.test.mjs`
Expected: all tests PASS.

### Task 2: 统一横向滚动条视觉

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `.matrix-cell-grid`、`.controller-equation`、`.model-formula .math-display`、`.matrix`、`.equation-list .math-formula`、`.studio-matrix-readout`、`.visualizer-tabs`
- Produces: `.controlab-scroll-region` 共享滚动条选择器规则

- [ ] **Step 1: Add shared native scrollbar styling**

使用 `scrollbar-width: thin`、`scrollbar-color` 以及 WebKit `::-webkit-scrollbar` 伪元素；轨道透明，滑块 `#34414c`，悬停 `#52616d`，厚度 `6px`。

- [ ] **Step 2: Verify production quality**

Run: `npm run lint && npm test && git diff --check`
Expected: exit code 0，全部测试通过，构建成功，无空白错误。

- [ ] **Step 3: Commit and push**

```bash
git add app/globals.css components/modern-control/StateSpaceLab.tsx lib/stateSpace.ts tests/control-math.test.mjs docs/superpowers/plans/2026-07-29-matrix-scrollbar-reset.md
git commit -m "polish matrix scrolling and reset"
git push origin main
```
