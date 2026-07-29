import type { IdentificationDataset } from "../identificationData.ts";
import type { PreprocessMode } from "./types.ts";

type Trend = { intercept: number; slope: number };
export type DataTransform = { mode: PreprocessMode; inputs: Trend[]; outputs: Trend[] };

export function splitAndPreprocess(dataset: IdentificationDataset, options: { trainRatio: number; preprocess: PreprocessMode }) {
  if (!(options.trainRatio >= 0.5 && options.trainRatio <= 0.9)) throw new Error("训练比例必须在 50% 到 90% 之间");
  const splitIndex = Math.max(2, Math.min(dataset.time.length - 2, Math.floor(dataset.time.length * options.trainRatio)));
  const transform: DataTransform = {
    mode: options.preprocess,
    inputs: fitTrends(dataset.inputs, splitIndex, options.preprocess),
    outputs: fitTrends(dataset.outputs, splitIndex, options.preprocess),
  };
  const prepared: IdentificationDataset = {
    ...dataset,
    inputs: applyTrends(dataset.inputs, transform.inputs, -1),
    outputs: applyTrends(dataset.outputs, transform.outputs, -1),
  };
  return {
    dataset: prepared,
    splitIndex,
    transform,
    restoreOutputs: (values: number[][]) => applyTrends(values, transform.outputs, 1),
  };
}
function fitTrends(rows: number[][], count: number, mode: PreprocessMode): Trend[] {
  if (!rows.length) return [];
  return rows[0].map((_, channel) => {
    if (mode === "none") return { intercept: 0, slope: 0 };
    const values = rows.slice(0, count).map((row) => row[channel]);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    if (mode === "demean") return { intercept: mean, slope: 0 };
    const meanIndex = (values.length - 1) / 2;
    const denominator = values.reduce((sum, _, index) => sum + (index - meanIndex) ** 2, 0);
    const slope = denominator ? values.reduce((sum, value, index) => sum + (index - meanIndex) * (value - mean), 0) / denominator : 0;
    return { intercept: mean - slope * meanIndex, slope };
  });
}

function applyTrends(rows: number[][], trends: Trend[], direction: -1 | 1) {
  return rows.map((row, index) => row.map((value, channel) => value + direction * (trends[channel].intercept + trends[channel].slope * index)));
}
