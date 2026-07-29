import test from "node:test";
import assert from "node:assert/strict";
import { CONTROL_MODULES, otherControlModules } from "../lib/moduleCatalog.ts";

test("模块目录使用首页四大模块的统一名称和顺序", () => {
  assert.deepEqual(CONTROL_MODULES.map((item) => item.label), ["系统分析", "现代控制", "系统辨识", "动力学仿真"]);
});

test("模块内导航只返回其余模块并保持目录顺序", () => {
  const expected = {
    analysis: ["modern", "identification", "simulation"],
    modern: ["analysis", "identification", "simulation"],
    identification: ["analysis", "modern", "simulation"],
    simulation: ["analysis", "modern", "identification"],
  };
  for (const current of CONTROL_MODULES) {
    assert.deepEqual(otherControlModules(current.id).map((item) => item.id), expected[current.id]);
  }
});
