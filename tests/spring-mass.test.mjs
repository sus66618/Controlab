import test from "node:test";
import assert from "node:assert/strict";
import { buildSpringMassModel, defaultSpringMassConfig, springMassDerivative } from "../lib/simulation/plants/springMass.ts";

test("单质量无阻尼系统固有频率正确", () => {
  const config = defaultSpringMassConfig(1);
  config.masses[0] = 2;
  config.links[0].spring = 18;
  config.links[0].damperEnabled = false;
  const model = buildSpringMassModel(config);
  assert.ok(Math.abs(model.modes[0].omega - 3) < 1e-9);
});

test("双质量连接生成正确维度且力只作用于选中质量", () => {
  const model = buildSpringMassModel(defaultSpringMassConfig(2));
  assert.equal(model.M.length, 2);
  const derivative = springMassDerivative(model, 0, [0, 0, 0, 0], 5, 1);
  assert.deepEqual(derivative.slice(2), [0, 5 / model.M[1][1]]);
});

test("关闭全部弹簧和阻尼后拒绝退化结构", () => {
  const config = defaultSpringMassConfig(1);
  for (const link of config.links) {
    link.springEnabled = false;
    link.damperEnabled = false;
  }
  assert.throws(() => buildSpringMassModel(config), /至少需要一个有效连接/);
});
