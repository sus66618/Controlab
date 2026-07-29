export type Complex = { re: number; im: number };

export type TransferModel = {
  numerator: number[];
  denominator: number[];
};

export type ZpkModel = {
  gain: number;
  zeros: Complex[];
  poles: Complex[];
};

export type ResponsePoint = { t: number; input: number; output: number };

export type InputSignal = "step" | "ramp" | "sine";

export type ControllerKind = "p" | "pi" | "pd" | "pid" | "lead" | "lag";

export type ControllerConfig = {
  kind: ControllerKind;
  kp: number;
  ki: number;
  kd: number;
  gain: number;
  tau: number;
  ratio: number;
};

export type ResponseMetrics = {
  overshoot: number | null;
  riseTime: number | null;
  settlingTime: number | null;
  steadyError: number | null;
};

export type AnalysisResult = {
  summary: {
    poles: Complex[];
    zeros: Complex[];
    stable: boolean;
    marginal: boolean;
  };
  margins: {
    gainCrossover: number | null;
    phaseMargin: number | null;
    phaseCrossover: number | null;
    gainMargin: number | null;
  };
  frequency: Array<{
    omega: number;
    value: Complex;
    magnitude: number;
    phase: number;
  }>;
  response: ResponsePoint[];
  locus: Complex[][];
  nyquist: Complex[];
};
