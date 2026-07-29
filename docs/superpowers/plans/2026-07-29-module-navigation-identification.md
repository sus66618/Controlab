# Module Navigation and Identification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一四大模块导航，并把系统辨识改造成清楚的三步教学实验。

**Architecture:** `lib/moduleCatalog.ts` 是模块名称与顺序的唯一来源，`ModuleNav` 负责生成各模块页的快捷入口。系统辨识沿用现有计算函数，新增纯展示转换函数并重排组件结构。

**Tech Stack:** React 19、TypeScript、KaTeX、Node test runner、CSS

## Global Constraints

- 代码注释使用中文。
- 顶部模块名称必须与首页一致。
- 闭环控制开关只显示在系统分析模块。
- 不新增运行时依赖。

---

### Task 1: 中央模块目录

**Files:**
- Create: `lib/moduleCatalog.ts`
- Create: `components/control-lab/ModuleNav.tsx`
- Test: `tests/module-navigation.test.mjs`

**Interfaces:**
- Produces: `CONTROL_MODULES`、`ControlModuleId`、`otherControlModules(current)`、`moduleLabel(id)`。
- Produces: `<ModuleNav current onNavigate />`。

- [ ] 写入失败测试，验证当前模块被排除且其余模块保持首页顺序。
- [ ] 运行测试，确认因目录模块不存在而失败。
- [ ] 实现目录与导航组件。
- [ ] 运行测试，确认通过。

### Task 2: 接入全部页面

**Files:**
- Modify: `app/ControlLab.tsx`
- Modify: `components/control-lab/Cover.tsx`
- Modify: `components/control-lab/Workbench.tsx`
- Modify: `components/modern-control/StateSpaceLab.tsx`
- Modify: `components/identification/SystemIdentificationLab.tsx`
- Modify: `components/simulations/InvertedPendulumLab.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `ControlModuleId` 与 `ModuleNav`。
- Produces: 单一 `onNavigate(moduleId)` 页面切换入口。

- [ ] 将页面状态收敛为 `cover | ControlModuleId`，删除伪模块 `closed-loop`。
- [ ] 首页名称读取中央目录。
- [ ] 四个模块页使用 `ModuleNav`，系统分析额外保留闭环开关。
- [ ] 调整窄屏导航样式，保证按钮可横向浏览。

### Task 3: 系统辨识教学流程

**Files:**
- Modify: `lib/systemIdentification.ts`
- Modify: `components/identification/SystemIdentificationLab.tsx`
- Modify: `app/globals.css`
- Test: `tests/system-identification.test.mjs`

**Interfaces:**
- Produces: `arxPolynomialsLatex(result): { a: string; b: string; model: string }`。

- [ ] 写入失败测试，以手算系数验证多项式符号、阶次和输入延迟。
- [ ] 运行测试，确认缺少展示转换函数。
- [ ] 实现纯展示转换函数。
- [ ] 将辨识页重排为数据、结构、验证三步，并分行展示模型。
- [ ] 运行辨识与导航测试。

### Task 4: 完整验证与交付

**Files:**
- Modify: `package.json`

- [ ] 将导航测试加入标准测试命令。
- [ ] 运行 lint、完整测试和差异检查。
- [ ] 启动本地预览并验证首页请求返回成功。
- [ ] 提交并推送当前分支。
