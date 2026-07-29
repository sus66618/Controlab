import { polynomialRoots } from "../../control/math.ts";
import type { PlantModelSummary, PlantOutputChannel } from "../core/types.ts";

export type SallenKeyParams = {
  R1: number;
  R2: number;
  C1: number;
  C2: number;
  gain: number;
  saturationEnabled: boolean;
  saturation: number;
  initialOutput: number;
  initialRate: number;
};

export const DEFAULT_SALLEN_KEY_PARAMS: SallenKeyParams = {
  R1: 10_000,
  R2: 10_000,
  C1: 1e-6,
  C2: 1e-6,
  gain: 1.586,
  saturationEnabled: true,
  saturation: 12,
  initialOutput: 0,
  initialRate: 0,
};

export type SallenKeyMetrics = {
  omegaN: number;
  frequency: number;
  zeta: number;
  q: number;
  dcGain: number;
  a1: number;
  a0: number;
  poles: { re: number; im: number }[];
};

export function sallenKeyMetrics(params: SallenKeyParams): SallenKeyMetrics {
  validateSallenKeyParams(params);
  const product = params.R1 * params.R2 * params.C1 * params.C2;
  const dampingTerm = params.C2 * (params.R1 + params.R2) + params.C1 * params.R1 * (1 - params.gain);
  if (!(dampingTerm > 0)) {
    throw new Error("当前增益使理想 Sallen-Key 模型不稳定，请降低增益");
  }
  const a0 = 1 / product;
  const a1 = dampingTerm / product;
  const omegaN = Math.sqrt(a0);
  const zeta = a1 / (2 * omegaN);
  return {
    omegaN,
    frequency: omegaN / (2 * Math.PI),
    zeta,
    q: 1 / (2 * zeta),
    dcGain: params.gain,
    a1,
    a0,
    poles: polynomialRoots([1, a1, a0]),
  };
}

export function sallenKeyDerivative(params: SallenKeyParams, _time: number, state: number[], input: number) {
  if (state.length !== 2) throw new Error("Sallen-Key 状态维度必须为 2");
  const metrics = sallenKeyMetrics(params);
  const [output, rate] = state;
  return [rate, params.gain * metrics.a0 * input - metrics.a1 * rate - metrics.a0 * output];
}

export function initialSallenKeyState(params: SallenKeyParams) {
  validateSallenKeyParams(params);
  return [params.initialOutput, params.initialRate];
}

export function sallenKeyOutputs(params: SallenKeyParams, state: number[]) {
  const ideal = state[0];
  const actual = params.saturationEnabled
    ? Math.max(-params.saturation, Math.min(params.saturation, ideal))
    : ideal;
  return { ideal, actual, rate: state[1] };
}

export function sallenKeyOutputChannels(params: SallenKeyParams): PlantOutputChannel[] {
  return [
    { id: "actual-output", label: "实际输出", unit: "V", read: (state) => sallenKeyOutputs(params, state).actual },
    { id: "ideal-output", label: "理想线性输出", unit: "V", read: (state) => sallenKeyOutputs(params, state).ideal },
    { id: "output-rate", label: "输出变化率", unit: "V/s", read: (state) => state[1] },
  ];
}

export function sallenKeySummary(params: SallenKeyParams): PlantModelSummary {
  const metrics = sallenKeyMetrics(params);
  const numerator = params.gain * metrics.a0;
  return {
    equations: [`G(s)=\\frac{${number(numerator)}}{s^2+${number(metrics.a1)}s+${number(metrics.a0)}}`],
    metrics: [
      { label: "直流增益", value: metrics.dcGain.toFixed(3) },
      { label: "固有频率", value: `${metrics.frequency.toFixed(2)} Hz` },
      { label: "阻尼比 / Q", value: `${metrics.zeta.toFixed(3)} / ${metrics.q.toFixed(3)}` },
      { label: "输出限制", value: params.saturationEnabled ? `±${params.saturation.toFixed(2)} V` : "理想无限幅" },
    ],
  };
}

export function validateSallenKeyParams(params: SallenKeyParams) {
  for (const [label, value] of [["R1", params.R1], ["R2", params.R2], ["C1", params.C1], ["C2", params.C2]] as const) {
    if (!(value > 0) || !Number.isFinite(value)) throw new Error(`${label} 必须为正数`);
  }
  if (!(params.gain > 0) || !Number.isFinite(params.gain)) throw new Error("闭环增益必须为正数");
  if (!(params.saturation > 0) || !Number.isFinite(params.saturation)) throw new Error("饱和电压必须为正数");
}

function number(value: number) {
  return Number(value.toPrecision(6));
}
