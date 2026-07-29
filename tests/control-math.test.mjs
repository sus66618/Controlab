import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateTransfer,
  ensureConjugates,
  feedbackModels,
  modelToZpk,
  parseTransferExpression,
  polynomialRoots,
  rootLocus,
  simulateResponse,
  zpkToModel,
} from "../lib/control.ts";
import {
  DEFAULT_CART_POLE_PARAMS,
  DEFAULT_EXCITATION,
  DEFAULT_LQR_CONFIG,
  DEFAULT_PID_CONFIG,
  designLqrGains,
  excitationValue,
  initialCartPoleState,
  linearizeCartPole,
  pendulumControlForce,
  stepCartPole,
} from "../lib/simulation/cartPole.ts";
import { polynomialToLatex, transferToLatex } from "../lib/math/latex.ts";

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

test("单位负反馈闭环模型计算正确", () => {
  const plant = { numerator: [1], denominator: [1, 1] };
  const control = { numerator: [2], denominator: [1] };
  const result = feedbackModels(plant, control);
  assert.deepEqual(result.loop, { numerator: [2], denominator: [1, 1] });
  assert.deepEqual(result.closed, { numerator: [2], denominator: [1, 3] });
});

test("倒立摆 LQR 能从小角度回到直立平衡", () => {
  let state = initialCartPoleState(7);
  for (let index = 0; index < 2400; index += 1) {
    const force = pendulumControlForce(state, "lqr");
    state = stepCartPole(state, force, DEFAULT_CART_POLE_PARAMS, 1 / 240);
  }
  assert.ok(Math.abs(state.theta) < 0.01, `最终摆角 ${state.theta} rad 应接近 0`);
  assert.ok(Math.abs(state.x) < 0.02, `最终位置 ${state.x} m 应接近 0`);
});

test("经典 PID 只使用摆角误差，复合 PID 额外使用位置误差", () => {
  const state = { x: 1, xVelocity: 0.5, theta: 0, thetaVelocity: 0, time: 0 };
  const classic = pendulumControlForce(state, "pid", { reference: 0.25, pid: { ...DEFAULT_PID_CONFIG, structure: "classic" } });
  const composite = pendulumControlForce(state, "pid", { reference: 0.25, pid: { ...DEFAULT_PID_CONFIG, structure: "composite" } });
  closeTo(classic, 0);
  closeTo(composite, DEFAULT_PID_CONFIG.kx * 0.75 + DEFAULT_PID_CONFIG.kv * 0.5);
});

test("倒立摆线性化模型随物理参数变化且完全可控", () => {
  const base = linearizeCartPole(DEFAULT_CART_POLE_PARAMS);
  const longerPole = linearizeCartPole({ ...DEFAULT_CART_POLE_PARAMS, poleLength: 0.75 });
  assert.equal(base.controllabilityRank, 4);
  assert.equal(base.positionTransfer.denominator.length, 5);
  assert.notDeepEqual(base.A, longerPole.A);
  assert.notDeepEqual(base.angleTransfer.denominator, longerPole.angleTransfer.denominator);
});

test("阶跃、斜坡、正弦与脉冲输入按配置生成", () => {
  closeTo(excitationValue({ ...DEFAULT_EXCITATION, type: "step", amplitude: 2, startTime: 1 }, 1.5), 2);
  closeTo(excitationValue({ ...DEFAULT_EXCITATION, type: "ramp", amplitude: 0.5, startTime: 1 }, 3), 1);
  closeTo(excitationValue({ ...DEFAULT_EXCITATION, type: "sine", amplitude: 2, frequency: 0.5, startTime: 0 }, 0.5), 2);
  closeTo(excitationValue({ ...DEFAULT_EXCITATION, type: "pulse", amplitude: 3, startTime: 1, duration: 0.4 }, 1.2), 3);
  closeTo(excitationValue({ ...DEFAULT_EXCITATION, type: "pulse", amplitude: 3, startTime: 1, duration: 0.4 }, 1.5), 0);
});

test("Q/R 自动设计的 LQR 能稳定默认倒立摆", () => {
  const gains = designLqrGains(DEFAULT_CART_POLE_PARAMS, DEFAULT_LQR_CONFIG.q, DEFAULT_LQR_CONFIG.r);
  assert.equal(gains.length, 4);
  let state = initialCartPoleState(7);
  for (let index = 0; index < 2400; index += 1) {
    const force = pendulumControlForce(state, "lqr", { lqr: { ...DEFAULT_LQR_CONFIG, gains } });
    state = stepCartPole(state, force, DEFAULT_CART_POLE_PARAMS, 1 / 240);
  }
  assert.ok(Math.abs(state.theta) < 0.01);
  assert.ok(Math.abs(state.x) < 0.03);
});

test("传递函数可以转换为规范的 LaTeX", () => {
  assert.equal(polynomialToLatex([1, 4, 25]), "s^{2} + 4s + 25");
  assert.equal(polynomialToLatex([0, -1.2434, 0, 0]), "-1.2434s^{2}");
  assert.equal(transferToLatex([25], [1, 4, 25]), "\\frac{25}{s^{2} + 4s + 25}");
});
