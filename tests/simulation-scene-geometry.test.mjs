import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSeriesCircuitLayout,
  buildSpringMassSceneLayout,
  SALLEN_KEY_TOPOLOGY,
} from "../lib/simulation/scenes/geometry.ts";

test("弹簧和阻尼器端点落在质量块侧面范围内", () => {
  const layout = buildSpringMassSceneLayout([0, 0]);

  assert.ok(layout.springY >= layout.massTop);
  assert.ok(layout.springY <= layout.massTop + layout.massHeight);
  assert.ok(layout.damperY >= layout.massTop);
  assert.ok(layout.damperY <= layout.massTop + layout.massHeight);
  assert.equal(layout.links[0].right, layout.masses[0].left);
  assert.equal(layout.links[1].left, layout.masses[0].right);
  assert.equal(layout.links[1].right, layout.masses[1].left);
});

test("串联电路的导线和元件连续覆盖整个上支路", () => {
  const layout = buildSeriesCircuitLayout(3);
  const intervals = [
    ...layout.wires,
    ...layout.elements.map((element) => [element.left, element.right]),
  ].sort((a, b) => a[0] - b[0]);

  assert.equal(intervals[0][0], layout.start);
  assert.equal(intervals.at(-1)[1], layout.end);
  for (let index = 1; index < intervals.length; index += 1) {
    assert.equal(intervals[index - 1][1], intervals[index][0]);
  }
});

test("Sallen-Key 的输入、两条电容支路和反馈支路均落在真实节点上", () => {
  const topology = SALLEN_KEY_TOPOLOGY;

  assert.deepEqual(topology.signal.end, topology.opAmp.plus);
  assert.deepEqual(topology.c1.start, topology.node1);
  assert.deepEqual(topology.c1.end, topology.output);
  assert.deepEqual(topology.c2.start, topology.node2);
  assert.equal(topology.c2.end.y, topology.groundY);
  assert.deepEqual(topology.feedback.start, topology.opAmp.minus);
  assert.deepEqual(topology.feedback.end, topology.output);
});
