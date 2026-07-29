import type { IdentificationDataset } from "../identificationData.ts";
import { fitIdentification } from "./fit.ts";
import type { IdentificationConfig, IdentificationResult } from "./types.ts";

export type SearchCriterion = "validation-fit" | "aic" | "bic";
export type OrderRange = { na: [number, number]; nb: [number, number]; nk: [number, number]; nc: [number, number]; nf: [number, number] };
export type SearchCandidate = { config: IdentificationConfig; score: number; parameterCount: number; result?: IdentificationResult };

export function buildCandidates(base: IdentificationConfig, range: OrderRange) {
  const values = (pair: [number, number]) => Array.from({ length: pair[1] - pair[0] + 1 }, (_, index) => pair[0] + index);
  const naValues = base.method === "fir" || base.method === "oe" ? [base.method === "fir" ? 0 : base.na] : values(range.na);
  const nbValues = values(range.nb);
  const nkValues = values(range.nk);
  const ncValues = base.method === "armax" ? values(range.nc) : [base.nc];
  const nfValues = base.method === "oe" ? values(range.nf) : [base.nf];
  const candidates: IdentificationConfig[] = [];
  for (const na of naValues) for (const nb of nbValues) for (const nk of nkValues) for (const nc of ncValues) for (const nf of nfValues) candidates.push({ ...base, na, nb, nk, nc, nf });
  if (candidates.length > 180) throw new Error(`当前范围会产生 ${candidates.length} 个候选，最多 180 个，请缩小范围`);
  return candidates;
}

export function rankCandidates<T extends { score: number; parameterCount: number }>(candidates: T[], criterion: SearchCriterion) {
  const direction = criterion === "validation-fit" ? -1 : 1;
  return [...candidates].sort((left, right) => direction * (left.score - right.score) || left.parameterCount - right.parameterCount);
}

export async function searchOrders(dataset: IdentificationDataset, base: IdentificationConfig, range: OrderRange, criterion: SearchCriterion, onProgress?: (completed: number, total: number) => void, signal?: AbortSignal) {
  let configs = buildCandidates(base, range);
  if (base.method === "oe") {
    const seeds: SearchCandidate[] = [];
    for (const config of configs) {
      try {
        const result = fitIdentification(dataset, { ...config, method: "arx", na: config.nf });
        seeds.push(candidateFromResult(config, result, "validation-fit"));
      } catch { /* 无效初值不会进入 OE 优化 */ }
    }
    configs = rankCandidates(seeds, "validation-fit").slice(0, 5).map((item) => item.config);
  }
  const successful: SearchCandidate[] = [];
  const failures: string[] = [];
  for (let index = 0; index < configs.length; index += 1) {
    if (signal?.aborted) throw new DOMException("搜索已取消", "AbortError");
    try {
      const result = fitIdentification(dataset, configs[index]);
      if (result.converged || !["armax", "oe"].includes(result.method)) successful.push(candidateFromResult(configs[index], result, criterion));
      else failures.push(`${configLabel(configs[index])}: 未收敛`);
    } catch (error) { failures.push(`${configLabel(configs[index])}: ${error instanceof Error ? error.message : "计算失败"}`); }
    onProgress?.(index + 1, configs.length);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return { ranked: rankCandidates(successful, criterion).slice(0, 3), evaluated: configs.length, failures };
}

function candidateFromResult(config: IdentificationConfig, result: IdentificationResult, criterion: SearchCriterion): SearchCandidate {
  const metrics = result.channels.map((channel) => criterion === "validation-fit" ? channel.validation.simulation.fitPercent : channel.train.oneStep[criterion]);
  return { config, result, parameterCount: result.parameterCount, score: metrics.reduce((sum, value) => sum + value, 0) / metrics.length };
}

function configLabel(config: IdentificationConfig) { return `na=${config.na}, nb=${config.nb}, nk=${config.nk}, nc=${config.nc}, nf=${config.nf}`; }
