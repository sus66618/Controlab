export type PlantSignal =
  | { kind: "manual" }
  | { kind: "constant"; amplitude: number }
  | { kind: "step"; amplitude: number; start: number }
  | { kind: "sine"; amplitude: number; frequency: number; phase: number }
  | { kind: "pulse"; amplitude: number; start: number; duration: number };

export type PlantOutputChannel = {
  id: string;
  label: string;
  unit: string;
  read: (state: number[], input: number, derivative: number[]) => number;
};

export type PlantModelSummary = {
  equations: string[];
  metrics: { label: string; value: string }[];
};

export type PlantHistoryPoint = { time: number; output: number; input: number };

export type PlantDerivative = (time: number, state: number[], input: number) => number[];
