# System Identification Methods Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将系统辨识页扩展为支持 ARX、FIR、正则化 ARX、ARMAX、OE、严格训练/验证评估及自动阶次搜索的真实计算工作台。

**Architecture:** 把当前单文件辨识算法拆为纯函数核心：数据预处理与划分、回归求解、各方法实现、预测评估和搜索互相独立。UI 只持有配置并消费统一结果对象；耗时搜索通过 Web Worker 调用同一套纯函数，展示值不进行二次计算或修饰。

**Tech Stack:** TypeScript、React 19、Vinext/Vite Web Worker、Node `node:test`、现有 SVG Plot 与 KaTeX 组件；不新增运行时依赖。

## Global Constraints

- 代码注释使用中文。
- 所有曲线、系数和指标必须来自真实算法输出，拟合度不截断。
- 训练与验证按时间划分；预处理参数只从训练段估计。
- 手动导入样例继续放在 `test/`，自动化测试放在 `tests/`。
- OE 首版仅支持 SISO；ARMAX 的 MIMO 噪声模型明确标记为对角结构。
- 单次自动搜索最多评估 180 个候选，允许取消且不得覆盖原结果。

---

### Task 1: 公共类型、数据划分与诚实指标

**Files:**
- Create: `lib/identification/types.ts`
- Create: `lib/identification/preprocess.ts`
- Create: `lib/identification/evaluate.ts`
- Create: `tests/identification-evaluation.test.mjs`
- Modify: `lib/systemIdentification.ts`

**Interfaces:**
- Produces: `IdentificationConfig`、`IdentificationModel`、`IdentificationResult`、`splitAndPreprocess(dataset, config)`、`evaluateModel(dataset, split, model)`。
- Consumes: 现有 `IdentificationDataset`。

- [ ] **Step 1: 写训练/验证隔离的失败测试**

```js
test("验证段改值不会改变训练预处理统计量", () => {
  const base = dataset([0, 1, 2, 3, 4, 5], [0, 1, 2, 3, 40, 50]);
  const changed = dataset([0, 1, 2, 3, 4, 5], [0, 1, 2, 3, -400, -500]);
  assert.deepEqual(
    splitAndPreprocess(base, { trainRatio: 2 / 3, preprocess: "demean" }).transform,
    splitAndPreprocess(changed, { trainRatio: 2 / 3, preprocess: "demean" }).transform,
  );
});

test("拟合度允许为负数且不进行美化", () => {
  assert.equal(metrics([0, 1, 2], [10, 10, 10]).fitPercent < 0, true);
});
```

- [ ] **Step 2: 运行测试并确认因模块不存在而失败**

Run: `node --experimental-strip-types --test tests/identification-evaluation.test.mjs`

Expected: FAIL，提示无法导入 `lib/identification/preprocess.ts` 或导出不存在。

- [ ] **Step 3: 定义统一类型和只用训练段拟合的预处理**

```ts
export type IdentificationMethod = "arx" | "fir" | "ridge-arx" | "armax" | "oe";
export type PreprocessMode = "none" | "demean" | "detrend";
export type IdentificationConfig = {
  method: IdentificationMethod;
  na: number; nb: number; nk: number; nc: number; nf: number;
  lambda: number; includeBias: boolean;
  maxIterations: number; tolerance: number;
  trainRatio: number; preprocess: PreprocessMode;
};
export type FitMetrics = { rmse: number; fitPercent: number; aic: number; bic: number };
export type EvaluationPair = { oneStep: FitMetrics; simulation: FitMetrics };
```

`splitAndPreprocess` 必须按 `Math.floor(sampleCount * trainRatio)` 划分；去均值或线性趋势的系数仅从 `[0, splitIndex)` 计算，再应用到整段数据。`restoreOutputs` 将预测值恢复为原量纲后再计算 RMSE 和拟合度。

- [ ] **Step 4: 增加自由仿真禁止读取验证输出的失败测试**

```js
test("自由仿真不会把验证输出作为下一步输入", () => {
  const first = simulateFreeRun(model, original, splitIndex);
  const poisoned = structuredClone(original);
  poisoned.outputs[splitIndex + 2][0] = 999999;
  assert.deepEqual(simulateFreeRun(model, poisoned, splitIndex), first);
});
```

- [ ] **Step 5: 实现一步预测、自由仿真、AIC/BIC 与残差自相关**

`oneStepPredict` 使用历史实测输出；`simulateFreeRun` 只允许分割点之前的实测历史参与初始化。AIC/BIC 使用训练一步预测残差：`N * log(SSE / N) + 2k` 与 `N * log(SSE / N) + k * log(N)`。自相关返回 lag 0–20 的归一化值。

- [ ] **Step 6: 运行新测试和现有辨识测试**

Run: `node --experimental-strip-types --test tests/identification-evaluation.test.mjs tests/system-identification.test.mjs`

Expected: PASS，0 failures。

- [ ] **Step 7: 提交公共评估核心**

```powershell
git add lib/identification lib/systemIdentification.ts tests/identification-evaluation.test.mjs
git commit -m "add honest identification evaluation core"
```

---

### Task 2: FIR、ARX 与正则化 ARX

**Files:**
- Create: `lib/identification/regression.ts`
- Create: `lib/identification/methods/linear.ts`
- Create: `tests/identification-linear-methods.test.mjs`
- Modify: `lib/systemIdentification.ts`

**Interfaces:**
- Consumes: `IdentificationDataset`、`IdentificationConfig` 和 Task 1 的评估类型。
- Produces: `fitIdentification(dataset, config): IdentificationResult` 统一分派入口、`fitLinearMethod(dataset, config): IdentificationResult`、`solveQr(rows, targets)`、`solveRidge(rows, targets, lambda, unpenalizedColumns)`。

- [ ] **Step 1: 写 FIR 真实脉冲响应恢复的失败测试**

```js
test("FIR 恢复独立生成数据的三个脉冲响应系数", () => {
  const data = loadLiteralFirFixture();
  const result = fitIdentification(data, config({ method: "fir", nb: 3, nk: 1 }));
  closeTo(result.model.b[0][0][0], 0.4, 0.015);
  closeTo(result.model.b[0][1][0], -0.15, 0.015);
  closeTo(result.model.b[0][2][0], 0.05, 0.015);
});
```

测试夹具使用固定字面量输入与输出，预期系数由手工方程推导，不调用生产模拟器生成断言。

- [ ] **Step 2: 运行并确认 `fir` 方法尚未实现**

Run: `node --experimental-strip-types --test tests/identification-linear-methods.test.mjs`

Expected: FAIL，提示不支持方法 `fir`。

- [ ] **Step 3: 提取 QR 求解器并实现统一线性回归矩阵**

回归列顺序固定为偏置、历史输出、历史输入。FIR 不创建历史输出列；ARX 保持现有 VARX 耦合输出结构。模型结果保存 `parameterCount`，供 AIC/BIC 使用。

- [ ] **Step 4: 写正则化抑制病态参数的失败测试**

```js
test("岭回归降低共线高阶模型参数范数", () => {
  const plain = fitIdentification(collinearFixture, config({ method: "arx", na: 4, nb: 4 }));
  const ridge = fitIdentification(collinearFixture, config({ method: "ridge-arx", na: 4, nb: 4, lambda: 0.1 }));
  assert.ok(parameterNorm(ridge.model) < parameterNorm(plain.model));
  assert.equal(Number.isFinite(ridge.evaluation.validation.simulation.rmse), true);
});
```

- [ ] **Step 5: 实现增广矩阵岭回归**

向训练回归矩阵追加 `sqrt(lambda) * I` 和零目标行；偏置列的追加系数为零。`lambda = 0` 必须与普通 ARX 在数值容差内一致。

- [ ] **Step 6: 运行线性方法及原有回归测试**

Run: `node --experimental-strip-types --test tests/identification-linear-methods.test.mjs tests/system-identification.test.mjs`

Expected: PASS，0 failures。

- [ ] **Step 7: 提交线性辨识方法**

```powershell
git add lib/identification lib/systemIdentification.ts tests/identification-linear-methods.test.mjs
git commit -m "add fir and regularized arx identification"
```

---

### Task 3: ARMAX 迭代扩展最小二乘

**Files:**
- Create: `lib/identification/methods/armax.ts`
- Create: `tests/identification-armax.test.mjs`
- Modify: `lib/systemIdentification.ts`

**Interfaces:**
- Consumes: Task 2 的回归矩阵与 QR 求解器。
- Produces: `fitArmax(dataset, config): IdentificationResult`，结果包含 `iterations`、`converged`、`noiseCoefficients` 和 `methodNote`。

- [ ] **Step 1: 写带相关噪声数据的一步预测失败测试**

```js
test("ARMAX 在相关噪声数据上的验证预测优于同阶 ARX", () => {
  const arx = fitIdentification(correlatedNoiseFixture, config({ method: "arx", na: 2, nb: 2, nk: 1 }));
  const armax = fitIdentification(correlatedNoiseFixture, config({ method: "armax", na: 2, nb: 2, nk: 1, nc: 1 }));
  assert.ok(armax.evaluation.validation.oneStep.rmse < arx.evaluation.validation.oneStep.rmse);
  assert.equal(armax.iterations > 0, true);
});
```

夹具将确定性系统响应与独立固定噪声序列组合，断言不使用 ARMAX 生产函数生成数据。

- [ ] **Step 2: 运行并确认 ARMAX 分支缺失**

Run: `node --experimental-strip-types --test tests/identification-armax.test.mjs`

Expected: FAIL，提示不支持方法 `armax`。

- [ ] **Step 3: 实现 ELS 迭代和真实收敛状态**

初始残差来自同阶 ARX；每轮将每个输出自身过去 `nc` 个残差加入对应方程。以参数向量相对变化 `< tolerance` 判定收敛；达到上限返回 `converged: false`，不得改写为成功。

- [ ] **Step 4: 写 MIMO 对角噪声能力与样本不足测试**

```js
test("VARMAX 为每个输出返回独立噪声多项式", () => {
  const result = fitIdentification(mimoFixture, config({ method: "armax", nc: 2 }));
  assert.deepEqual(result.model.c.map((rows) => rows.length), [2, 2]);
  assert.match(result.methodNote, /对角噪声模型/);
});
```

- [ ] **Step 5: 运行 ARMAX 和公共评估测试**

Run: `node --experimental-strip-types --test tests/identification-armax.test.mjs tests/identification-evaluation.test.mjs`

Expected: PASS，0 failures。

- [ ] **Step 6: 提交 ARMAX**

```powershell
git add lib/identification lib/systemIdentification.ts tests/identification-armax.test.mjs
git commit -m "add iterative armax identification"
```

---

### Task 4: SISO 输出误差法

**Files:**
- Create: `lib/identification/methods/oe.ts`
- Create: `tests/identification-oe.test.mjs`
- Modify: `lib/systemIdentification.ts`

**Interfaces:**
- Consumes: Task 1 的自由仿真器与 Task 2 的线性初值。
- Produces: `fitOutputError(dataset, config, initialModel?): IdentificationResult` 和 `isStableDiscreteDenominator(coefficients): boolean`。

- [ ] **Step 1: 写 OE 只支持 SISO 和稳定性约束的失败测试**

```js
test("OE 明确拒绝 MIMO 数据", () => {
  assert.throws(() => fitIdentification(mimoFixture, config({ method: "oe" })), /仅支持单输入单输出/);
});

test("OE 返回稳定分母且报告真实迭代状态", () => {
  const result = fitIdentification(noisySecondOrderFixture, config({ method: "oe", nf: 2, nb: 2, nk: 1 }));
  assert.equal(isStableDiscreteDenominator(result.model.f), true);
  assert.equal(typeof result.converged, "boolean");
  assert.ok(result.iterations <= result.config.maxIterations);
});
```

- [ ] **Step 2: 运行并确认 OE API 缺失**

Run: `node --experimental-strip-types --test tests/identification-oe.test.mjs`

Expected: FAIL，提示不支持方法 `oe` 或稳定性函数不存在。

- [ ] **Step 3: 实现带阻尼数值 Gauss–Newton**

用中心有限差分计算自由仿真残差 Jacobian，求解 `(JᵀJ + μI)Δ = Jᵀe`。候选损失下降且分母稳定时接受并减小 `μ`，否则拒绝并增大 `μ`。连续 8 次拒绝或矩阵奇异时返回明确失败原因。

- [ ] **Step 4: 写验证自由仿真改善的失败测试**

```js
test("OE 优化降低独立二阶夹具的验证自由仿真误差", () => {
  const initial = fitIdentification(noisySecondOrderFixture, config({ method: "arx", na: 2, nb: 2 }));
  const oe = fitIdentification(noisySecondOrderFixture, config({ method: "oe", nf: 2, nb: 2 }));
  assert.ok(oe.evaluation.validation.simulation.rmse < initial.evaluation.validation.simulation.rmse);
});
```

- [ ] **Step 5: 运行 OE、线性方法和公共评估测试**

Run: `node --experimental-strip-types --test tests/identification-oe.test.mjs tests/identification-linear-methods.test.mjs tests/identification-evaluation.test.mjs`

Expected: PASS，0 failures。

- [ ] **Step 6: 提交 OE**

```powershell
git add lib/identification lib/systemIdentification.ts tests/identification-oe.test.mjs
git commit -m "add output error identification"
```

---

### Task 5: 自动阶次搜索与 Worker 协议

**Files:**
- Create: `lib/identification/search.ts`
- Create: `lib/identification/workerProtocol.ts`
- Create: `components/identification/identification.worker.ts`
- Create: `tests/identification-search.test.mjs`

**Interfaces:**
- Produces: `searchOrders(dataset, request, onProgress?, signal?): Promise<SearchResult>`；Worker 消息 `start`、`progress`、`complete`、`error`、`cancel`。
- Consumes: `fitIdentification` 和所有方法配置。

- [ ] **Step 1: 写候选上限和稳定排序的失败测试**

```js
test("搜索拒绝超过 180 个候选的范围", () => {
  assert.throws(() => buildCandidates(oversizedRange), /最多 180/);
});

test("BIC 相同时使用较少参数模型优先", () => {
  const ranked = rankCandidates([{ bic: 10, parameterCount: 8 }, { bic: 10, parameterCount: 4 }], "bic");
  assert.equal(ranked[0].parameterCount, 4);
});
```

- [ ] **Step 2: 运行并确认搜索模块不存在**

Run: `node --experimental-strip-types --test tests/identification-search.test.mjs`

Expected: FAIL，无法导入 `lib/identification/search.ts`。

- [ ] **Step 3: 实现候选生成、过滤、排名和取消**

验证拟合度按降序，AIC/BIC 按升序；无效或不收敛候选记录原因但不进入前三。OE 先按 ARX 验证指标选择最多 5 个初值，再执行 OE。每完成一个候选向事件循环让出控制权，使 Worker 能及时处理取消消息。

- [ ] **Step 4: 实现 Worker 适配层**

Worker 只转发纯函数结果。每完成一个候选发送 `{ type: "progress", completed, total }`；收到 `cancel` 后设置 `AbortController`，返回 `{ type: "cancelled" }`，不发半成品模型。

- [ ] **Step 5: 运行搜索测试及 TypeScript 构建**

Run: `node --experimental-strip-types --test tests/identification-search.test.mjs && npm run build`

Expected: 两条命令退出码均为 0。

- [ ] **Step 6: 提交搜索与 Worker**

```powershell
git add lib/identification components/identification/identification.worker.ts tests/identification-search.test.mjs
git commit -m "add identification order search"
```

---

### Task 6: 动态方法参数与真实验证界面

**Files:**
- Create: `components/identification/MethodSelector.tsx`
- Create: `components/identification/IdentificationParameters.tsx`
- Create: `components/identification/EvaluationSummary.tsx`
- Create: `components/identification/OrderSearchPanel.tsx`
- Modify: `components/identification/SystemIdentificationLab.tsx`
- Modify: `app/globals.css`
- Modify: `tests/ui-contract.test.mjs`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: 统一 `IdentificationConfig`、`IdentificationResult` 与 Worker 搜索协议。
- Produces: 方法切换、动态字段、训练/验证与预测/仿真视图、残差自相关页签和前三候选应用操作。

- [ ] **Step 1: 写用户可见行为的失败测试**

```js
test("系统辨识页提供五种真实方法并解释 OE 维度限制", async () => {
  const html = await renderAppPath("/", { openModule: "identification" });
  for (const label of ["ARX", "FIR", "正则化 ARX", "ARMAX", "OE"]) assert.match(html, new RegExp(label));
  assert.match(html, /OE 首版仅支持单输入单输出/);
});
```

UI 契约测试还需验证 ARMAX 显示 `nc`、OE 显示 `nf`、正则化显示 `λ`，并且数字输入隐藏原生微调箭头。

- [ ] **Step 2: 运行 UI 测试并确认因组件尚未提供方法切换而失败**

Run: `node --experimental-strip-types --test tests/ui-contract.test.mjs tests/rendered-html.test.mjs`

Expected: FAIL，缺少方法标签或参数字段。

- [ ] **Step 3: 拆分并接入方法选择和动态参数组件**

方法按钮使用现有暗色分段控件语言。字段由方法映射生成：ARX=`na,nb,nk`，FIR=`nb,nk`，正则化=`na,nb,nk,lambda`，ARMAX=`na,nb,nk,nc,maxIterations,tolerance`，OE=`nf,nb,nk,maxIterations,tolerance`。公共预处理、偏置和训练比例折叠在“验证设置”中。

- [ ] **Step 4: 接入真实结果视图**

增加“训练/验证”和“一步预测/自由仿真”两组紧凑切换；图线直接读取 `result.predictions`。摘要卡读取相同结果中的 RMSE、拟合度、AIC、BIC、迭代和收敛状态。残差自相关以 lag 为横轴，不绘制虚构置信区间。

- [ ] **Step 5: 接入自动搜索面板**

显示搜索范围、准则、进度与取消按钮；完成后列出前三名。只有用户点击某一候选的“应用”才更新配置并重新辨识。

- [ ] **Step 6: 运行 UI 测试、lint 和构建**

Run: `node --experimental-strip-types --test tests/ui-contract.test.mjs tests/rendered-html.test.mjs && npm run lint && npm run build`

Expected: 全部退出码为 0。

- [ ] **Step 7: 提交界面重构**

```powershell
git add components/identification app/globals.css tests/ui-contract.test.mjs tests/rendered-html.test.mjs
git commit -m "expand identification method workspace"
```

---

### Task 7: 真实数据基准、全量回归与浏览器验收

**Files:**
- Create: `tests/identification-benchmark.test.mjs`

**Interfaces:**
- Consumes: 用户手动测试 CSV 与最终公开辨识 API。
- Produces: 可复现的基准报告和完整验收证据。

- [ ] **Step 1: 写基准测试验证文件通过真实导入链路**

```js
test("项目 SISO 实验 CSV 可由公开入口完成多方法辨识", async () => {
  const dataset = parseIdentificationCsvDataset(await readFile(samplePath, "utf8"), "system_identification_siso_experiment.csv");
  for (const method of ["arx", "fir", "ridge-arx", "armax", "oe"]) {
    const result = fitIdentification(dataset, benchmarkConfig(method));
    assert.equal(result.method, method);
    assert.equal(Number.isFinite(result.evaluation.validation.simulation.rmse), true);
  }
});
```

该测试只要求算法完成并返回有限真实指标，不为任何方法规定“必须达到某个漂亮百分比”。

- [ ] **Step 2: 运行基准并记录各方法指标**

Run: `node --experimental-strip-types --test tests/identification-benchmark.test.mjs`

Expected: PASS，并由测试诊断输出记录各方法训练/验证、预测/仿真指标。

- [ ] **Step 3: 运行全量测试**

Run: `npm test`

Expected: 退出码 0，所有测试通过。

- [ ] **Step 4: 运行 lint 和生产构建**

Run: `npm run lint && npm run build`

Expected: 两条命令退出码均为 0，无 ESLint error。

- [ ] **Step 5: 在本地浏览器验收关键流程**

打开系统辨识页并导入 `test/system_identification_siso_experiment.csv`，依次检查五种方法、动态参数、训练/验证切换、预测/仿真切换、残差页和自动搜索取消。确认页面无横向白色原生滚动条、无原生数字箭头、控制台无错误。

- [ ] **Step 6: 检查工作树和差异**

Run: `git diff --check && git status --short`

Expected: `git diff --check` 无输出；状态只包含本计划范围文件。

- [ ] **Step 7: 提交并推送完整功能**

```powershell
git add lib/identification lib/systemIdentification.ts components/identification app/globals.css tests
git commit -m "complete identification methods expansion"
git push origin main
```
