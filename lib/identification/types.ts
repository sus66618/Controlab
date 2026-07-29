import type { IdentificationDataset } from "../identificationData.ts";

export type IdentificationMethod = "arx" | "fir" | "ridge-arx" | "armax" | "oe";
export type PreprocessMode = "none" | "demean" | "detrend";

export type IdentificationConfig = {
  method: IdentificationMethod;
  na: number;
  nb: number;
  nk: number;
  nc: number;
  nf: number;
  lambda: number;
  includeBias: boolean;
  maxIterations: number;
  tolerance: number;
  trainRatio: number;
  preprocess: PreprocessMode;
};
export type FitMetrics = { rmse: number; fitPercent: number; aic: number; bic: number };
export type EvaluationPair = { oneStep: FitMetrics; simulation: FitMetrics };
export type ChannelEvaluation = { name: string; train: EvaluationPair; validation: EvaluationPair; autocorrelation: number[] };

export type PolynomialModel = {
  method: IdentificationMethod;
  na: number;
  nb: number;
  nk: number;
  inputNames: string[];
  outputNames: string[];
  a: number[][][];
  b: number[][][];
  bias: number[];
  c?: number[][];
  f?: number[];
};

export type IdentificationPredictions = {
  oneStep: number[][];
  simulation: number[][];
  residuals: number[][];
};

export type IdentificationResult = {
  method: IdentificationMethod;
  config: IdentificationConfig;
  model: PolynomialModel;
  splitIndex: number;
  parameterCount: number;
  predictions: IdentificationPredictions;
  channels: ChannelEvaluation[];
  iterations: number;
  converged: boolean;
  methodNote: string;
  dataset: IdentificationDataset;
};

export const DEFAULT_IDENTIFICATION_CONFIG: IdentificationConfig = {
  method: "arx", na: 2, nb: 2, nk: 1, nc: 1, nf: 2,
  lambda: 0.01, includeBias: false, maxIterations: 30,
  tolerance: 1e-6, trainRatio: 0.7, preprocess: "demean",
};
