import test from "node:test";
import assert from "node:assert/strict";
import { parseIdentificationCsvDataset, parseIdentificationTable } from "../lib/identificationData.ts";
import { readIdentificationFile } from "../lib/identificationFile.ts";

test("表格按列名自动识别多输入多输出维度", () => {
  const dataset = parseIdentificationTable([
    ["time", "u1", "u2", "y1", "y2"],
    [0, 1, 0, 0, 2],
    [0.1, 0, 1, 0.3, 1.4],
    [0.2, -1, 0.5, 0.4, 1.1],
  ]);
  assert.deepEqual(dataset.inputNames, ["u1", "u2"]);
  assert.deepEqual(dataset.outputNames, ["y1", "y2"]);
  assert.deepEqual(dataset.inputs[1], [0, 1]);
  assert.deepEqual(dataset.outputs[2], [0.4, 1.1]);
});

test("中文表头与旧式无表头三列 CSV 都可以解析", () => {
  const chinese = parseIdentificationCsvDataset("时间,输入1,输出1\n0,0,0\n0.1,1,0.2\n0.2,1,0.35");
  assert.deepEqual(chinese.inputNames, ["输入1"]);
  assert.deepEqual(chinese.outputNames, ["输出1"]);
  const legacy = parseIdentificationCsvDataset("0,0,0\n0.1,1,0.2\n0.2,1,0.35");
  assert.deepEqual(legacy.inputNames, ["u"]);
  assert.deepEqual(legacy.outputNames, ["y"]);
});

test("标准 CSV 引号不会破坏表头和数值", () => {
  const dataset = parseIdentificationCsvDataset('"time","u1","y1"\n"0","0","0"\n"0.1","1","0.2"\n"0.2","1","0.35"');
  assert.deepEqual(dataset.inputNames, ["u1"]);
  assert.deepEqual(dataset.outputs[2], [0.35]);
});

test("缺少输入列时拒绝自动猜测", () => {
  assert.throws(() => parseIdentificationTable([["t", "y1"], [0, 0], [1, 1], [2, 2]]), /输入列/);
});

test("时间必须严格递增且全部通道必须是数字", () => {
  assert.throws(() => parseIdentificationTable([["t", "u", "y"], [0, 0, 0], [0, 1, 1], [1, 1, 2]]), /严格递增/);
  assert.throws(() => parseIdentificationTable([["t", "u", "y"], [0, 0, 0], [1, "坏数据", 1], [2, 1, 2]]), /第 3 行/);
  assert.throws(() => parseIdentificationTable([["t", "u", "y"], [0, 0, 0], [1, "", 1], [2, 1, 2]]), /第 3 行/);
});

test("CSV 文件在本地读取后直接生成多通道数据集", async () => {
  const text = "t,u1,u2,y1\n0,0,0,0\n0.1,1,0,0.2\n0.2,0,1,0.4";
  const dataset = await readIdentificationFile({ name: "experiment.csv", size: text.length, text: async () => text });
  assert.deepEqual(dataset.inputNames, ["u1", "u2"]);
  assert.deepEqual(dataset.outputNames, ["y1"]);
});

test("拒绝旧式 XLS 与超过上限的文件", async () => {
  await assert.rejects(() => readIdentificationFile({ name: "legacy.xls", size: 10, text: async () => "" }), /CSV 或 XLSX/);
  await assert.rejects(() => readIdentificationFile({ name: "huge.csv", size: 10 * 1024 * 1024 + 1, text: async () => "" }), /10 MB/);
});

test("XLSX 交给 Worker 解析，避免阻塞主线程", async () => {
  const originalWorker = globalThis.Worker;
  let terminated = false;
  class FakeWorker {
    postMessage() {
      queueMicrotask(() => this.onmessage({ data: { ok: true, dataset: { time: [0, 1, 2], inputs: [[0], [1], [0]], outputs: [[0], [0.2], [0.1]], inputNames: ["u"], outputNames: ["y"] } } }));
    }
    terminate() { terminated = true; }
  }
  globalThis.Worker = FakeWorker;
  try {
    const dataset = await readIdentificationFile({ name: "experiment.xlsx", size: 128, text: async () => "" });
    assert.deepEqual(dataset.outputNames, ["y"]);
    assert.equal(terminated, true);
  } finally {
    globalThis.Worker = originalWorker;
  }
});
