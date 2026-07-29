import test from "node:test";
import assert from "node:assert/strict";
import { buildPassiveRlcModel, passiveRlcDerivative, simplePassiveRlcConfig } from "../lib/simulation/plants/passiveRlc.ts";
import { DEFAULT_MFB_LOW_PASS_PARAMS, mfbLowPassMetrics, mfbLowPassOutputs } from "../lib/simulation/plants/mfbLowPass.ts";

test("串联 RLC 极点满足标准特征方程", () => {
  const model = buildPassiveRlcModel(simplePassiveRlcConfig("series", 4, 2, 0.125));
  assert.deepEqual(model.denominator.map((value) => Number(value.toPrecision(8))), [1, 2, 4]);
});

test("无源零输入响应来自初始储能", () => {
  const model = buildPassiveRlcModel(simplePassiveRlcConfig("series", 1, 1, 1));
  assert.notDeepEqual(passiveRlcDerivative(model, 0, [0, 1], 0), [0, 0]);
});

test("串并联预设使用各自正确的等效参数", () => {
  const series = simplePassiveRlcConfig("series", 2, 3, 4);
  series.resistors.push({ id: "r2", enabled: true, value: 2 });
  const parallel = { ...series, topology: "parallel" };
  assert.equal(buildPassiveRlcModel(series).R, 4);
  assert.equal(buildPassiveRlcModel(parallel).R, 1);
});

test("反相 MFB 的直流增益和二阶系数来自实际元件", () => {
  const metrics = mfbLowPassMetrics({
    ...DEFAULT_MFB_LOW_PASS_PARAMS,
    R1: 10_000,
    R2: 20_000,
    R3: 30_000,
    C1: 1e-6,
    C2: 200e-9,
  });
  assert.ok(Math.abs(metrics.dcGain + 3) < 1e-12);
  assert.ok(Math.abs(metrics.a0 - 8333.333333333334) < 1e-9);
  assert.ok(Math.abs(metrics.a1 - 183.33333333333334) < 1e-9);
});

test("输出饱和不篡改理想输出通道", () => {
  const output = mfbLowPassOutputs({ ...DEFAULT_MFB_LOW_PASS_PARAMS, saturation: 5, saturationEnabled: true }, [8, 2]);
  assert.equal(output.ideal, 8);
  assert.equal(output.actual, 5);
});
