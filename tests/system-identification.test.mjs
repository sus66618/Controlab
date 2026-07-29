import test from "node:test";
import assert from "node:assert/strict";
import { arxPolynomialsLatex, fitArx, fitVarx, identificationMetrics, parseIdentificationCsv, simulateArx } from "../lib/systemIdentification.ts";

const closeTo = (actual, expected, tolerance = 1e-3) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} 应接近 ${expected}`);

test("CSV 解析接受表头并忽略空行", () => {
  const samples = parseIdentificationCsv("t,u,y\n0,0,0\n\n0.1,1,0.3\n0.2,1,0.51");
  assert.equal(samples.length, 3);
  assert.deepEqual(samples[1], { t: 0.1, u: 1, y: 0.3 });
});

test("ARX 最小二乘恢复已知一阶模型", () => {
  const samples = [];
  let y = 0;
  let previousInput = 0;
  for (let index = 0; index < 180; index += 1) {
    const u = index % 13 < 6 ? 1 : -0.5;
    y = 0.7 * y + 0.3 * previousInput;
    samples.push({ t: index * 0.1, u, y });
    previousInput = u;
  }
  const result = fitArx(samples, { na: 1, nb: 1, nk: 1 });
  closeTo(result.a[0], -0.7);
  closeTo(result.b[0], 0.3);
  assert.ok(result.fitPercent > 99.9);
});

test("ARX 自由仿真按递推方程生成输出", () => {
  const samples = Array.from({ length: 8 }, (_, index) => ({ t: index, u: index >= 1 ? 1 : 0, y: index === 0 ? 0 : 1 - 0.5 ** index }));
  const output = simulateArx(samples, { a: [-0.5], b: [0.5], na: 1, nb: 1, nk: 1 });
  closeTo(output[3], 0.75);
  closeTo(output[5], 0.9375);
});

test("辨识指标在完全拟合时返回 100%", () => {
  const metrics = identificationMetrics([0, 1, 2, 3], [0, 1, 2, 3]);
  closeTo(metrics.rmse, 0);
  closeTo(metrics.fitPercent, 100);
});

test("ARX 展示公式分开表达输出记忆、输入记忆和纯延迟", () => {
  const latex = arxPolynomialsLatex({ a: [-1.2, 0.35], b: [0.08, -0.02], na: 2, nb: 2, nk: 1 });
  assert.deepEqual(latex, {
    a: "A(q^{-1})=1-1.2q^{-1}+0.35q^{-2}",
    b: "B(q^{-1})=0.08-0.02q^{-1}",
    model: "A(q^{-1})y(k)=q^{-1}B(q^{-1})u(k)+e(k)",
  });
});

test("VARX 恢复二输入二输出系统的交叉耦合", () => {
  const time = [];
  const inputs = [];
  const outputs = [];
  let previous = [0, 0];
  for (let index = 0; index < 320; index += 1) {
    const input = [Math.sin(index * 0.31) + (index % 7) * 0.08, Math.cos(index * 0.17) - (index % 5) * 0.06];
    const delayed = inputs[index - 1] ?? [0, 0];
    const output = [0.6 * previous[0] + 0.1 * previous[1] + 0.2 * delayed[0], -0.05 * previous[0] + 0.7 * previous[1] + 0.3 * delayed[1]];
    time.push(index * 0.1);
    inputs.push(input);
    outputs.push(output);
    previous = output;
  }
  const result = fitVarx({ time, inputs, outputs, inputNames: ["u1", "u2"], outputNames: ["y1", "y2"] }, { na: 1, nb: 1, nk: 1 });
  closeTo(result.a[0][0][0], -0.6, 2e-3);
  closeTo(result.a[0][0][1], -0.1, 2e-3);
  closeTo(result.a[1][0][0], 0.05, 2e-3);
  closeTo(result.b[0][0][0], 0.2, 2e-3);
  closeTo(result.b[1][0][1], 0.3, 2e-3);
  assert.ok(result.channels.every((channel) => channel.fitPercent > 99.9));
});

test("VARX 拒绝维度不一致、非有限数据和非整数阶次", () => {
  const base = { time: [0, 1, 2, 3, 4, 5], inputs: [[0], [1], [0], [1], [0], [1]], outputs: [[0], [0.2], [0.1], [0.3], [0.2], [0.4]], inputNames: ["u"], outputNames: ["y"] };
  assert.throws(() => fitVarx({ ...base, inputs: base.inputs.slice(1) }, { na: 1, nb: 1, nk: 1 }), /行数/);
  assert.throws(() => fitVarx({ ...base, outputs: base.outputs.map((row, index) => index === 3 ? [Number.NaN] : row) }, { na: 1, nb: 1, nk: 1 }), /有限数值/);
  assert.throws(() => fitVarx(base, { na: 1.5, nb: 1, nk: 1 }), /整数/);
});

test("VARX 对完全共线的输入明确报告激励不足", () => {
  const time = Array.from({ length: 40 }, (_, index) => index * 0.1);
  const inputs = time.map((_, index) => [index % 3, (index % 3) * 2]);
  const outputs = time.map((_, index) => [index === 0 ? 0 : (index % 3) * 0.2]);
  assert.throws(() => fitVarx({ time, inputs, outputs, inputNames: ["u1", "u2"], outputNames: ["y"] }, { na: 1, nb: 1, nk: 1 }), /激励不足/);
});
