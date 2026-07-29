import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DC_MOTOR_PARAMS, dcMotorDerivative, dcMotorSteadyState } from "../lib/simulation/plants/dcMotor.ts";

test("直流电机稳态满足电气和机械平衡", () => {
  const steady = dcMotorSteadyState(DEFAULT_DC_MOTOR_PARAMS, 12, 0.2);
  assert.ok(Math.abs(12 - DEFAULT_DC_MOTOR_PARAMS.R * steady.current - DEFAULT_DC_MOTOR_PARAMS.ke * steady.speed) < 1e-10);
  assert.ok(Math.abs(DEFAULT_DC_MOTOR_PARAMS.kt * steady.current - DEFAULT_DC_MOTOR_PARAMS.b * steady.speed - 0.2) < 1e-10);
});

test("零状态零输入保持静止", () => {
  assert.deepEqual(dcMotorDerivative(DEFAULT_DC_MOTOR_PARAMS, 0, [0, 0, 0], 0, 0), [0, 0, 0]);
});

test("无效电气或机械参数被拒绝", () => {
  assert.throws(() => dcMotorDerivative({ ...DEFAULT_DC_MOTOR_PARAMS, J: 0 }, 0, [0, 0, 0], 1, 0), /转动惯量/);
});
