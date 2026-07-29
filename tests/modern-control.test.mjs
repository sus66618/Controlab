import test from "node:test";
import assert from "node:assert/strict";
import { designDiscreteLqr, designKalmanGain, placeObserverPoles, placeSisoPoles, simulateOutputFeedback } from "../lib/modernControl.ts";
import { stateEigenvalues } from "../lib/stateSpace.ts";

const closeTo = (actual, expected, tolerance = 1e-3) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} 应接近 ${expected}`);
const subtractFeedback = (A, B, K) => A.map((row, i) => row.map((value, j) => value - B[i].reduce((sum, item, input) => sum + item * K[input][j], 0)));
const subtractObserver = (A, L, C) => A.map((row, i) => row.map((value, j) => value - L[i].reduce((sum, item, output) => sum + item * C[output][j], 0)));

test("SISO 极点配置得到指定闭环极点", () => {
  const A = [[0, 1], [-2, -3]];
  const B = [[0], [1]];
  const K = placeSisoPoles(A, B, [-4, -5]);
  const poles = stateEigenvalues(subtractFeedback(A, B, K)).map((value) => value.re).sort((a, b) => a - b);
  closeTo(poles[0], -5);
  closeTo(poles[1], -4);
});

test("LQR 可以稳定不稳定但可控的二阶系统", () => {
  const A = [[0, 1], [1, 0]];
  const B = [[0], [1]];
  const K = designDiscreteLqr(A, B, [10, 1], [1], 0.01);
  assert.ok(stateEigenvalues(subtractFeedback(A, B, K)).every((value) => value.re < 0));
});

test("观测器极点配置得到指定误差极点", () => {
  const A = [[0, 1], [-2, -3]];
  const C = [[1, 0]];
  const L = placeObserverPoles(A, C, [-7, -8]);
  const poles = stateEigenvalues(subtractObserver(A, L, C)).map((value) => value.re).sort((a, b) => a - b);
  closeTo(poles[0], -8);
  closeTo(poles[1], -7);
});

test("卡尔曼增益维度为状态数乘输出数", () => {
  const gain = designKalmanGain([[0, 1], [-2, -0.5]], [[1, 0]], [0.02, 0.05], [0.1], 0.01);
  assert.deepEqual([gain.length, gain[0].length], [2, 1]);
  assert.ok(gain.flat().every(Number.isFinite));
});

test("输出反馈观测器的估计误差随时间收敛", () => {
  const A = [[0, 1], [-2, -0.5]];
  const B = [[0], [1]];
  const C = [[1, 0]];
  const K = placeSisoPoles(A, B, [-2, -3]);
  const L = placeObserverPoles(A, C, [-6, -7]);
  const result = simulateOutputFeedback({ A, B, C, initial: [1, 0], estimatedInitial: [0, 0], K, L, duration: 6, dt: 0.01 });
  assert.ok(result.samples.at(-1).errorNorm < result.samples[0].errorNorm * 0.02);
  assert.equal(result.samples[0].control.length, 1);
});
