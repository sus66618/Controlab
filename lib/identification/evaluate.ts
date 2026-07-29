import type { FitMetrics } from "./types.ts";

export function identificationMetrics(measured: number[], estimated: number[], parameterCount = 0): FitMetrics {
  const count = Math.min(measured.length, estimated.length);
  if (!count) return { rmse: Number.NaN, fitPercent: Number.NaN, aic: Number.NaN, bic: Number.NaN };
  const mean = measured.slice(0, count).reduce((sum, value) => sum + value, 0) / count;
  const squaredError = measured.slice(0, count).reduce((sum, value, index) => sum + (value - estimated[index]) ** 2, 0);
  const spread = measured.slice(0, count).reduce((sum, value) => sum + (value - mean) ** 2, 0);
  const variance = Math.max(squaredError / count, Number.EPSILON);
  return {
    rmse: Math.sqrt(squaredError / count),
    fitPercent: spread < 1e-12 ? (squaredError < 1e-12 ? 100 : 0) : 100 * (1 - Math.sqrt(squaredError / spread)),
    aic: count * Math.log(variance) + 2 * parameterCount,
    bic: count * Math.log(variance) + parameterCount * Math.log(count),
  };
}

export function residualAutocorrelation(values: number[], maxLag = 20) {
  if (!values.length) return [];
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const centered = values.map((value) => value - mean);
  const energy = centered.reduce((sum, value) => sum + value * value, 0);
  return Array.from({ length: Math.min(maxLag, values.length - 1) + 1 }, (_, lag) => {
    if (!energy) return lag === 0 ? 1 : 0;
    return centered.slice(lag).reduce((sum, value, index) => sum + value * centered[index], 0) / energy;
  });
}
