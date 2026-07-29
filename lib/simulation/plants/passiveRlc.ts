import { polynomialRoots } from "../../control/math.ts";
import type { PlantModelSummary, PlantOutputChannel } from "../core/types.ts";

export type PassiveRlcTopology = "series" | "parallel";
export type CircuitComponent = { id: string; enabled: boolean; value: number };
export type PassiveRlcConfig = {
  topology: PassiveRlcTopology;
  resistors: CircuitComponent[];
  inductors: CircuitComponent[];
  capacitors: CircuitComponent[];
  initialCapacitorVoltage: number;
  initialInductorCurrent: number;
};

export type PassiveRlcModel = {
  config: PassiveRlcConfig;
  R: number;
  L: number;
  C: number;
  denominator: number[];
  poles: { re: number; im: number }[];
};

export function simplePassiveRlcConfig(topology: PassiveRlcTopology, R: number, L: number, C: number): PassiveRlcConfig {
  return {
    topology,
    resistors: [{ id: "r1", enabled: true, value: R }],
    inductors: [{ id: "l1", enabled: true, value: L }],
    capacitors: [{ id: "c1", enabled: true, value: C }],
    initialCapacitorVoltage: 0,
    initialInductorCurrent: 0,
  };
}

export function defaultPassiveRlcConfig(topology: PassiveRlcTopology = "series") {
  return simplePassiveRlcConfig(topology, 8, 0.8, 0.04);
}

export function buildPassiveRlcModel(config: PassiveRlcConfig): PassiveRlcModel {
  const resistors = enabledValues(config.resistors, "电阻");
  const inductors = enabledValues(config.inductors, "电感");
  const capacitors = enabledValues(config.capacitors, "电容");
  if (!resistors.length || !inductors.length || !capacitors.length) throw new Error("R、L、C 至少各需要一个启用元件");
  const R = config.topology === "series" ? sum(resistors) : reciprocalSum(resistors);
  const L = config.topology === "series" ? sum(inductors) : reciprocalSum(inductors);
  const C = config.topology === "series" ? reciprocalSum(capacitors) : sum(capacitors);
  const denominator = config.topology === "series" ? [1, R / L, 1 / (L * C)] : [1, 1 / (R * C), 1 / (L * C)];
  return { config: cloneConfig(config), R, L, C, denominator, poles: polynomialRoots(denominator) };
}

export function initialPassiveRlcState(config: PassiveRlcConfig) {
  return config.topology === "series" ? [config.initialInductorCurrent, config.initialCapacitorVoltage] : [config.initialCapacitorVoltage, config.initialInductorCurrent];
}

export function passiveRlcDerivative(model: PassiveRlcModel, _time: number, state: number[], source: number) {
  if (state.length !== 2) throw new Error("RLC 状态维度必须为 2");
  if (model.config.topology === "series") {
    const [current, capacitorVoltage] = state;
    return [(source - model.R * current - capacitorVoltage) / model.L, current / model.C];
  }
  const [voltage, inductorCurrent] = state;
  return [(source - voltage / model.R - inductorCurrent) / model.C, voltage / model.L];
}

export function passiveRlcOutputs(model: PassiveRlcModel): PlantOutputChannel[] {
  const channels: PlantOutputChannel[] = model.config.topology === "series"
    ? [
      { id: "current", label: "回路电流", unit: "A", read: (state) => state[0] },
      { id: "capacitor-voltage", label: "电容总电压", unit: "V", read: (state) => state[1] },
      { id: "resistor-voltage", label: "电阻总电压", unit: "V", read: (state) => model.R * state[0] },
      { id: "inductor-voltage", label: "电感总电压", unit: "V", read: (_state, _input, derivative) => model.L * derivative[0] },
    ]
    : [
      { id: "voltage", label: "节点电压", unit: "V", read: (state) => state[0] },
      { id: "inductor-current", label: "电感总电流", unit: "A", read: (state) => state[1] },
      { id: "resistor-current", label: "电阻总电流", unit: "A", read: (state) => state[0] / model.R },
      { id: "capacitor-current", label: "电容总电流", unit: "A", read: (_state, _input, derivative) => model.C * derivative[0] },
    ];
  channels.push({ id: "energy", label: "总储能", unit: "J", read: (state) => model.config.topology === "series" ? .5 * model.L * state[0] ** 2 + .5 * model.C * state[1] ** 2 : .5 * model.C * state[0] ** 2 + .5 * model.L * state[1] ** 2 });
  return channels;
}

export function passiveRlcSummary(model: PassiveRlcModel): PlantModelSummary {
  const omegaN = 1 / Math.sqrt(model.L * model.C);
  const zeta = model.config.topology === "series" ? model.R / 2 * Math.sqrt(model.C / model.L) : 1 / (2 * model.R) * Math.sqrt(model.L / model.C);
  return {
    equations: model.config.topology === "series" ? ["L\\dot{i}+Ri+v_C=u", "C\\dot{v}_C=i"] : ["C\\dot{v}+\\frac{v}{R}+i_L=u", "L\\dot{i}_L=v"],
    metrics: [
      { label: "等效参数", value: `R ${model.R.toPrecision(4)} Ω · L ${model.L.toPrecision(4)} H · C ${model.C.toPrecision(4)} F` },
      { label: "固有角频率", value: `${omegaN.toFixed(3)} rad/s` },
      { label: "阻尼比", value: zeta.toFixed(3) },
    ],
  };
}

function enabledValues(components: CircuitComponent[], label: string) {
  const enabled = components.filter((component) => component.enabled);
  if (enabled.some((component) => !(component.value > 0) || !Number.isFinite(component.value))) throw new Error(`${label}数值必须为正数`);
  return enabled.map((component) => component.value);
}
function sum(values: number[]) { return values.reduce((total, value) => total + value, 0); }
function reciprocalSum(values: number[]) { return 1 / values.reduce((total, value) => total + 1 / value, 0); }
function cloneConfig(config: PassiveRlcConfig): PassiveRlcConfig { return { ...config, resistors: config.resistors.map((item) => ({ ...item })), inductors: config.inductors.map((item) => ({ ...item })), capacitors: config.capacitors.map((item) => ({ ...item })) }; }
