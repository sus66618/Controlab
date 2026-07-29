import type { IdentificationDataset } from "../identificationData.ts";
import { fitLinearMethod } from "./methods/linear.ts";
import { fitArmax } from "./methods/armax.ts";
import { fitOutputError } from "./methods/oe.ts";
import { DEFAULT_IDENTIFICATION_CONFIG } from "./types.ts";
import type { IdentificationConfig } from "./types.ts";

export function normalizeIdentificationConfig(config: Partial<IdentificationConfig>): IdentificationConfig {
  const merged = { ...DEFAULT_IDENTIFICATION_CONFIG, ...config };
  for (const key of ["na", "nb", "nk", "nc", "nf", "maxIterations"] as const) {
    const minimum = key === "nk" || (key === "na" && merged.method === "fir") ? 0 : 1;
    if (!Number.isInteger(merged[key]) || merged[key] < minimum) throw new Error(`${key} 必须是有效整数`);
  }
  if (merged.nb > 10 || merged.na > 10 || merged.nc > 10 || merged.nf > 10) throw new Error("模型阶次不能超过 10");
  if (!(merged.lambda >= 0) || !(merged.tolerance > 0)) throw new Error("正则化系数和收敛精度无效");
  return merged;
}

export function fitIdentification(dataset: IdentificationDataset, partial: Partial<IdentificationConfig>) {
  const config = normalizeIdentificationConfig(partial);
  if (["arx", "fir", "ridge-arx"].includes(config.method)) return fitLinearMethod(dataset, config);
  if (config.method === "armax") return fitArmax(dataset, config);
  if (config.method === "oe") return fitOutputError(dataset, config);
  throw new Error(`暂不支持辨识方法 ${config.method}`);
}
