import test from "node:test";
import assert from "node:assert/strict";
import { buildPassiveRlcModel, passiveRlcDerivative, simplePassiveRlcConfig } from "../lib/simulation/plants/passiveRlc.ts";
import { DEFAULT_SALLEN_KEY_PARAMS, sallenKeyMetrics, sallenKeyOutputs } from "../lib/simulation/plants/sallenKey.ts";

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

test("等值元件单位增益 Sallen-Key 的自然频率正确", () => {
  const metrics = sallenKeyMetrics({
    ...DEFAULT_SALLEN_KEY_PARAMS,
    R1: 10_000,
    R2: 10_000,
    C1: 100e-9,
    C2: 100e-9,
    gain: 1,
  });
  assert.ok(Math.abs(metrics.omegaN - 1000) < 1e-8);
  assert.ok(Math.abs(metrics.dcGain - 1) < 1e-12);
});

test("输出饱和不篡改理想输出通道", () => {
  const output = sallenKeyOutputs({ ...DEFAULT_SALLEN_KEY_PARAMS, saturation: 5, saturationEnabled: true }, [8, 2]);
  assert.equal(output.ideal, 8);
  assert.equal(output.actual, 5);
});
