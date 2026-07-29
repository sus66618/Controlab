import test from "node:test";
import assert from "node:assert/strict";
import { fitIdentification } from "../lib/identification/fit.ts";
import { isStableDiscreteDenominator } from "../lib/identification/methods/oe.ts";

function outputErrorDataset(count = 360) {
  const time = [], inputs = [], outputs = [];
  let y1 = 0, y2 = 0, seed = 811;
  for (let index = 0; index < count; index += 1) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const u = seed / 2 ** 31 - 1;
    const delayed = inputs[index - 1]?.[0] ?? 0;
    const clean = 1.42 * y1 - 0.52 * y2 + 0.12 * delayed;
    y2 = y1; y1 = clean;
    seed = (seed * 1103515245 + 12345) >>> 0;
    const measurementNoise = (seed / 2 ** 31 - 1) * 0.055;
    time.push(index * 0.05); inputs.push([u]); outputs.push([clean + measurementNoise]);
  }
  return { time, inputs, outputs, inputNames: ["u"], outputNames: ["y"] };
}

const base = { na: 2, nb: 1, nk: 1, nc: 1, nf: 2, lambda: 0, includeBias: false, maxIterations: 24, tolerance: 1e-6, trainRatio: 0.7, preprocess: "demean" };

test("OE 明确拒绝多变量数据", () => {
  const source = outputErrorDataset();
  const mimo = { ...source, inputs: source.inputs.map(([u]) => [u, u * u]), inputNames: ["u1", "u2"] };
  assert.throws(() => fitIdentification(mimo, { ...base, method: "oe" }), /仅支持单输入单输出/);
});

test("OE 返回稳定分母并如实报告迭代状态", () => {
  const result = fitIdentification(outputErrorDataset(), { ...base, method: "oe" });
  assert.equal(isStableDiscreteDenominator(result.model.f), true);
  assert.equal(typeof result.converged, "boolean");
  assert.ok(result.iterations <= base.maxIterations);
  assert.equal(Number.isFinite(result.channels[0].validation.simulation.rmse), true);
});
