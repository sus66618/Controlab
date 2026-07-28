import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateTransfer,
  ensureConjugates,
  modelToZpk,
  parseTransferExpression,
  polynomialRoots,
  rootLocus,
  simulateResponse,
  zpkToModel,
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

test("传递函数表达式支持隐式乘法和括号", () => {
  const parsed = parseTransferExpression("25 / (s^2 + 4s + 25)");
  assert.deepEqual(parsed, { numerator: [25], denominator: [1, 4, 25] });
  const factored = parseTransferExpression("2(s + 3) / ((s + 1)(s + 5))");
  assert.deepEqual(factored, { numerator: [2, 6], denominator: [1, 6, 5] });
});

test("零极点模型与系数模型可以往返转换", () => {
  const source = { numerator: [2, 6], denominator: [1, 6, 5] };
  const roundTrip = zpkToModel(modelToZpk(source));
  roundTrip.numerator.forEach((value, index) => closeTo(value, source.numerator[index]));
  roundTrip.denominator.forEach((value, index) => closeTo(value, source.denominator[index]));
});

test("单个复数点会自动补共轭点", () => {
  const roots = ensureConjugates([{ re: -2, im: 3 }]);
  assert.deepEqual(roots, [{ re: -2, im: 3 }, { re: -2, im: -3 }]);
  const model = zpkToModel({ gain: 1, zeros: [], poles: roots });
  assert.deepEqual(model.denominator, [1, 4, 13]);
});
