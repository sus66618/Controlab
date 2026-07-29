import test from "node:test";
import assert from "node:assert/strict";
import { fitIdentification } from "../lib/identification/fit.ts";

const closeTo = (actual, expected, tolerance = 0.02) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} 应接近 ${expected}`);

function dynamicDataset(count = 260) {
  const time = [], inputs = [], outputs = [];
  let y = 0;
  let seed = 4173;
  for (let index = 0; index < count; index += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const u = (seed / 2 ** 32) * 2 - 1;
    const delayed = inputs[index - 1]?.[0] ?? 0;
    y = 0.65 * y + 0.28 * delayed;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const noise = ((seed / 2 ** 32) * 2 - 1) * 0.01;
    time.push(index * 0.1); inputs.push([u]); outputs.push([y + noise]);
  }
  return { time, inputs, outputs, inputNames: ["u"], outputNames: ["y"] };
}

function firDataset(count = 220) {
  const time = [], inputs = [], outputs = [];
  for (let index = 0; index < count; index += 1) {
    const u = Math.sin(index * 0.71) + (index % 9) * 0.08;
    inputs.push([u]); time.push(index * 0.05);
    outputs.push([0.4 * (inputs[index - 1]?.[0] ?? 0) - 0.15 * (inputs[index - 2]?.[0] ?? 0) + 0.05 * (inputs[index - 3]?.[0] ?? 0)]);
  }
  return { time, inputs, outputs, inputNames: ["u"], outputNames: ["y"] };
}

const config = (overrides) => ({ method: "arx", na: 1, nb: 1, nk: 1, nc: 1, nf: 2, lambda: 0.1, includeBias: false, maxIterations: 20, tolerance: 1e-6, trainRatio: 0.7, preprocess: "none", ...overrides });

test("FIR 恢复三个脉冲响应系数", () => {
  const result = fitIdentification(firDataset(), config({ method: "fir", na: 0, nb: 3 }));
  closeTo(result.model.b[0][0][0], 0.4);
  closeTo(result.model.b[0][1][0], -0.15);
  closeTo(result.model.b[0][2][0], 0.05);
  assert.ok(result.channels[0].validation.simulation.fitPercent > 99.9);
});

test("ARX 的验证自由仿真不读取验证段实测输出", () => {
  const source = dynamicDataset();
  const first = fitIdentification(source, config({ method: "arx" }));
  const poisoned = structuredClone(source);
  poisoned.outputs[first.splitIndex + 4][0] += 500;
  const second = fitIdentification(poisoned, config({ method: "arx" }));
  assert.deepEqual(second.predictions.simulation.slice(first.splitIndex), first.predictions.simulation.slice(first.splitIndex));
});

test("岭回归降低高阶模型参数范数", () => {
  const source = dynamicDataset(90);
  const plain = fitIdentification(source, config({ method: "arx", na: 5, nb: 5 }));
  const ridge = fitIdentification(source, config({ method: "ridge-arx", na: 5, nb: 5, lambda: 1 }));
  const norm = (result) => Math.hypot(...result.model.a.flat(2), ...result.model.b.flat(2));
  assert.ok(norm(ridge) < norm(plain));
});
