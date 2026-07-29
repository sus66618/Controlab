import test from "node:test";
import assert from "node:assert/strict";
import { SIMULATION_EXPERIMENTS, experimentsByCategory, groupExperiments } from "../lib/simulation/experimentCatalog.ts";

test("实验目录按两类注册且标识唯一", () => {
  assert.deepEqual(experimentsByCategory("plant").map((item) => item.id), ["spring-mass", "dc-motor", "passive-rlc", "active-mfb"]);
  assert.deepEqual(experimentsByCategory("control").map((item) => item.id), ["cart-pole"]);
  assert.equal(new Set(SIMULATION_EXPERIMENTS.map((item) => item.id)).size, SIMULATION_EXPERIMENTS.length);
});

test("虚拟实验只通过注册即可进入对应分类", () => {
  const virtual = { id: "virtual-plant", category: "plant", index: "TEST", title: "虚拟对象", description: "架构测试", stateLabel: "x" };
  const grouped = groupExperiments([...SIMULATION_EXPERIMENTS, virtual]);
  assert.ok(grouped.plant.some((item) => item.id === "virtual-plant"));
});
