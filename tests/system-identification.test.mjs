import test from "node:test";
import assert from "node:assert/strict";
import { fitArx, identificationMetrics, parseIdentificationCsv, simulateArx } from "../lib/systemIdentification.ts";

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
