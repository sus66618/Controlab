import test from "node:test";
import assert from "node:assert/strict";
import { buildCandidates, rankCandidates } from "../lib/identification/search.ts";

const base = { method: "arx", na: 1, nb: 1, nk: 1, nc: 1, nf: 1, lambda: 0.1, includeBias: false, maxIterations: 10, tolerance: 1e-5, trainRatio: 0.7, preprocess: "demean" };

test("搜索拒绝超过 180 个候选的范围", () => {
  assert.throws(() => buildCandidates(base, { na: [1, 10], nb: [1, 10], nk: [0, 3], nc: [1, 1], nf: [1, 1] }), /最多 180/);
});

test("候选生成只改变当前方法需要的阶次", () => {
  const candidates = buildCandidates({ ...base, method: "fir" }, { na: [1, 6], nb: [1, 3], nk: [0, 1], nc: [1, 4], nf: [1, 4] });
  assert.equal(candidates.length, 6);
  assert.equal(candidates.every((item) => item.na === 0 && item.nc === 1 && item.nf === 1), true);
});

test("BIC 相同时优先参数更少的模型", () => {
  const ranked = rankCandidates([
    { score: 10, parameterCount: 8, config: { ...base, na: 4 } },
    { score: 10, parameterCount: 4, config: { ...base, na: 2 } },
  ], "bic");
  assert.equal(ranked[0].parameterCount, 4);
});
