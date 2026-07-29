# Identification File Import and MIMO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为系统辨识增加 CSV/XLSX 文件导入和自动维度识别，并用 VARX 支持多输入多输出辨识。

**Architecture:** `identificationData.ts` 将二维表统一为带通道名的矩阵数据集；`systemIdentification.ts` 负责纯数学 VARX 拟合与仿真；`identificationFile.ts` 只负责浏览器文件读取。页面消费统一数据集并按当前输出通道可视化。

**Tech Stack:** React 19、TypeScript、read-excel-file、KaTeX、Node test runner

## Global Constraints

- 支持 `.csv` 与 `.xlsx`，最大 10 MB，不支持 `.xls`。
- 文件只在浏览器本地读取，不上传服务器；XLSX 在 Web Worker 中解析。
- 多变量模型使用统一 `na / nb / nk`。
- 保留现有 SISO API 与示例行为。
- 依赖缓存位于 E 盘项目目录。

---

### Task 1: 表格归一化

**Files:**
- Create: `lib/identificationData.ts`
- Test: `tests/identification-data.test.mjs`

**Interfaces:**
- Produces: `IdentificationDataset`、`parseIdentificationTable(rows)`、`parseIdentificationCsvDataset(text)`。

- [ ] 写失败测试，输入 `time,u1,u2,y1,y2` 二维表并断言通道名、维度与数值。
- [ ] 写失败测试，断言缺少输入列、非数字单元格和非递增时间会给出明确错误。
- [ ] 运行测试，确认因函数不存在而失败。
- [ ] 实现表头分类、数值验证和旧三列粘贴兼容。
- [ ] 运行测试，确认通过。

### Task 2: VARX 数学核心

**Files:**
- Modify: `lib/systemIdentification.ts`
- Test: `tests/system-identification.test.mjs`

**Interfaces:**
- Produces: `fitVarx(dataset, orders)`、`simulateVarx(dataset, model)`、`VarxResult`。
- Consumes: `IdentificationDataset`。

- [ ] 写失败测试，用手工递推的二输入二输出耦合系统验证系数和拟合度。
- [ ] 运行测试，确认新接口不存在。
- [ ] 实现多通道回归矩阵、可复用 QR 分解、秩检查与同步自由仿真。
- [ ] 保留 `fitArx` 与 `simulateArx` 兼容包装。
- [ ] 运行新旧辨识测试。

### Task 3: 浏览器文件读取

**Files:**
- Create: `lib/identificationFile.ts`
- Create: `lib/identificationXlsx.worker.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `readIdentificationFile(file): Promise<IdentificationDataset>`。
- Consumes: `parseIdentificationTable` 与 `parseIdentificationCsvDataset`。

- [ ] 安装 `read-excel-file`，npm 缓存指定到项目内 `.npm-cache`。
- [ ] 实现扩展名、10 MB 大小校验和 XLSX Worker 读取。
- [ ] 运行构建确认浏览器包兼容。

### Task 4: 多通道辨识页面

**Files:**
- Modify: `components/identification/SystemIdentificationLab.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `IdentificationDataset`、`VarxResult`、`readIdentificationFile`。

- [ ] 增加文件选择与拖放区，导入后立即执行辨识。
- [ ] 显示文件名、样本数、输入维度和输出维度。
- [ ] 增加输出通道选择器并按视图生成多通道曲线。
- [ ] SISO 显示标量公式，MIMO 显示矩阵关系和当前输出系数。
- [ ] 保留示例、粘贴 CSV、阶次与错误信息。

### Task 5: 完整验证与交付

**Files:**
- Modify: `package.json`

- [ ] 将数据测试加入标准测试命令。
- [ ] 运行 lint、完整测试和 `git diff --check`。
- [ ] 启动本地预览并验证 HTTP 200。
- [ ] 提交并推送 `main`。
