import test from "node:test";
import assert from "node:assert/strict";
import { fitIdentification } from "../lib/identification/fit.ts";

function correlatedNoiseDataset(count = 420) {
  const time = [], inputs = [], outputs = [];
  let state = 0, noise = 0, seed = 913;
  for (let index = 0; index < count; index += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const u = seed / 2 ** 31 - 1;
    const previousInput = inputs[index - 1]?.[0] ?? 0;
    state = 0.72 * state + 0.25 * previousInput;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const white = (seed / 2 ** 31 - 1) * 0.08;
    noise = 0.68 * noise + white;
    time.push(index * 0.05); inputs.push([u]); outputs.push([state + noise]);
  }
  return { time, inputs, outputs, inputNames: ["u"], outputNames: ["y"] };
}

const config = (method) => ({ method, na: 1, nb: 1, nk: 1, nc: 1, nf: 1, lambda: 0, includeBias: false, maxIterations: 30, tolerance: 1e-7, trainRatio: 0.7, preprocess: "demean" });

test("ARMAX 在相关噪声数据上的验证一步预测优于同阶 ARX", () => {
  const source = correlatedNoiseDataset();
  const arx = fitIdentification(source, config("arx"));
  const armax = fitIdentification(source, config("armax"));
  assert.ok(armax.channels[0].validation.oneStep.rmse < arx.channels[0].validation.oneStep.rmse);
  assert.equal(armax.iterations > 0, true);
  assert.equal(typeof armax.converged, "boolean");
});

test("ARMAX 达到迭代上限时不会冒充收敛", () => {
  const result = fitIdentification(correlatedNoiseDataset(), { ...config("armax"), maxIterations: 1, tolerance: 1e-14 });
  assert.equal(result.iterations, 1);
  assert.equal(result.converged, false);
});
