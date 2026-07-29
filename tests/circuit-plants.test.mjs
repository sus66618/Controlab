import test from "node:test";
import assert from "node:assert/strict";
import { buildPassiveRlcModel, passiveRlcDerivative, simplePassiveRlcConfig } from "../lib/simulation/plants/passiveRlc.ts";

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
