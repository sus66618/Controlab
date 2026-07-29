import test from "node:test";
import assert from "node:assert/strict";
import { signalValue } from "../lib/simulation/core/signals.ts";
import { assertFiniteState, rk4Step } from "../lib/simulation/core/integrate.ts";

test("共享信号覆盖手动、恒值、阶跃、正弦和脉冲", () => {
  assert.equal(signalValue({ kind: "manual" }, 1, -2.5), -2.5);
  assert.equal(signalValue({ kind: "constant", amplitude: 1.5 }, 10, 0), 1.5);
  assert.equal(signalValue({ kind: "step", amplitude: 3, start: 2 }, 1.9, 0), 0);
  assert.equal(signalValue({ kind: "step", amplitude: 3, start: 2 }, 2, 0), 3);
  assert.ok(Math.abs(signalValue({ kind: "sine", amplitude: 2, frequency: 0.5, phase: 0 }, 0.5, 0) - 2) < 1e-12);
  assert.equal(signalValue({ kind: "pulse", amplitude: 4, start: 1, duration: 0.2 }, 1.1, 0), 4);
  assert.equal(signalValue({ kind: "pulse", amplitude: 4, start: 1, duration: 0.2 }, 1.21, 0), 0);
});

test("RK4 对一阶衰减保持预期精度", () => {
  const next = rk4Step([1], 0, 0.1, (_time, [state]) => [-state]);
  assert.ok(Math.abs(next[0] - Math.exp(-0.1)) < 1e-6);
});

test("非有限状态会被明确拒绝", () => {
  assert.throws(() => assertFiniteState([0, Number.NaN]), /非有限数值/);
});
