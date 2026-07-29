import test from "node:test";
import assert from "node:assert/strict";
import { splitAndPreprocess } from "../lib/identification/preprocess.ts";
import { identificationMetrics, residualAutocorrelation } from "../lib/identification/evaluate.ts";

function dataset(outputs) {
  return {
    time: outputs.map((_, index) => index),
    inputs: outputs.map((_, index) => [index % 2]),
    outputs: outputs.map((value) => [value]),
    inputNames: ["u"],
    outputNames: ["y"],
  };
}

test("验证段改值不会改变训练预处理统计量", () => {
  const base = dataset([0, 1, 2, 3, 40, 50]);
  const changed = dataset([0, 1, 2, 3, -400, -500]);
  assert.deepEqual(
    splitAndPreprocess(base, { trainRatio: 2 / 3, preprocess: "demean" }).transform,
    splitAndPreprocess(changed, { trainRatio: 2 / 3, preprocess: "demean" }).transform,
  );
});

test("去趋势输出可以无损恢复到原始量纲", () => {
  const source = dataset([2, 5, 8, 11, 14, 17]);
  const prepared = splitAndPreprocess(source, { trainRatio: 2 / 3, preprocess: "detrend" });
  const restored = prepared.restoreOutputs(prepared.dataset.outputs);
  assert.deepEqual(restored.map((row) => Number(row[0].toFixed(9))), [2, 5, 8, 11, 14, 17]);
});

test("拟合度允许为负数且不进行美化", () => {
  assert.equal(identificationMetrics([0, 1, 2], [10, 10, 10], 2).fitPercent < 0, true);
});

test("残差自相关返回零到指定阶数并归一化", () => {
  const values = residualAutocorrelation([1, -1, 1, -1], 2);
  assert.equal(values.length, 3);
  assert.equal(values[0], 1);
  assert.ok(values[1] < 0);
});
