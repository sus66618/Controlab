import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateTransfer,
  polynomialRoots,
  rootLocus,
  simulateResponse,
} from "../lib/control.ts";

const closeTo = (actual, expected, tolerance = 1e-4) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} 应接近 ${expected}`);
};

test("二阶系统极点计算正确", () => {
  const roots = polynomialRoots([1, 4, 25]).sort((a, b) => a.im - b.im);
  closeTo(roots[0].re, -2);
  closeTo(Math.abs(roots[0].im), Math.sqrt(21));
  closeTo(roots[1].re, -2);
});

test("直流增益与阶跃稳态值一致", () => {
  const model = { numerator: [25], denominator: [1, 4, 25] };
  closeTo(evaluateTransfer(model, { re: 0, im: 0 }).re, 1);
  const response = simulateResponse(model, "step", 12, 700);
  closeTo(response.at(-1).output, 1, 1e-3);
});

test("根轨迹从开环极点出发", () => {
  const model = { numerator: [1], denominator: [1, 3, 2] };
  const starts = rootLocus(model).map((branch) => branch[0].re).sort((a, b) => a - b);
  closeTo(starts[0], -2);
  closeTo(starts[1], -1);
});
