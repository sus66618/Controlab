import { stateEigenvalues } from "../../stateSpace.ts";
import type { PlantModelSummary, PlantOutputChannel } from "../core/types.ts";

export type SpringMassLink = {
  id: string;
  left: number;
  right: number;
  springEnabled: boolean;
  damperEnabled: boolean;
  spring: number;
  damper: number;
};

export type SpringMassConfig = {
  masses: number[];
  initialDisplacements: number[];
  initialVelocities: number[];
  links: SpringMassLink[];
  forceTarget: number;
};

export type SpringMassModel = {
  config: SpringMassConfig;
  M: number[][];
  C: number[][];
  K: number[][];
  poles: { re: number; im: number }[];
  modes: { omega: number; frequency: number }[];
};

export function defaultSpringMassConfig(count = 2): SpringMassConfig {
  const size = Math.max(1, Math.min(3, Math.round(count)));
  const links: SpringMassLink[] = [{ id: "ground-1", left: -1, right: 0, springEnabled: true, damperEnabled: true, spring: 16, damper: 1.2 }];
  for (let index = 0; index < size - 1; index += 1) links.push({ id: `mass-${index + 1}-${index + 2}`, left: index, right: index + 1, springEnabled: true, damperEnabled: true, spring: 12, damper: 0.8 });
  return { masses: Array(size).fill(1), initialDisplacements: Array(size).fill(0), initialVelocities: Array(size).fill(0), links, forceTarget: size - 1 };
}

export function buildSpringMassModel(config: SpringMassConfig): SpringMassModel {
  const count = config.masses.length;
  if (count < 1 || count > 3) throw new Error("质量块数量必须在 1 到 3 之间");
  if (config.initialDisplacements.length !== count || config.initialVelocities.length !== count) throw new Error("初始状态维度与质量块数量不一致");
  if (config.masses.some((mass) => !(mass > 0) || !Number.isFinite(mass))) throw new Error("质量必须为正数");
  if (!config.links.some(linkIsActive)) throw new Error("至少需要一个有效连接");
  const M = diagonal(config.masses);
  const C = zeros(count);
  const K = zeros(count);
  for (const link of config.links) {
    validateLink(link, count);
    if (link.springEnabled) addLink(K, link.left, link.right, link.spring);
    if (link.damperEnabled) addLink(C, link.left, link.right, link.damper);
  }
  const A = stateMatrix(config.masses, C, K);
  const poles = stateEigenvalues(A);
  const modes = count === 1 && C[0][0] === 0
    ? [{ omega: Math.sqrt(K[0][0] / config.masses[0]), frequency: Math.sqrt(K[0][0] / config.masses[0]) / (2 * Math.PI) }]
    : poles.filter((pole) => pole.im >= -1e-8).map((pole) => ({ omega: Math.hypot(pole.re, pole.im), frequency: Math.hypot(pole.re, pole.im) / (2 * Math.PI) })).sort((left, right) => left.omega - right.omega);
  return { config: cloneConfig(config), M, C, K, poles, modes };
}

export function initialSpringMassState(config: SpringMassConfig) {
  return [...config.initialDisplacements, ...config.initialVelocities];
}

export function springMassDerivative(model: SpringMassModel, _time: number, state: number[], force: number, target = model.config.forceTarget) {
  const count = model.config.masses.length;
  if (state.length !== count * 2) throw new Error("弹簧系统状态维度不正确");
  const displacement = state.slice(0, count);
  const velocity = state.slice(count);
  const acceleration = model.config.masses.map((mass, row) => {
    const internal = model.C[row].reduce((sum, value, column) => sum + value * velocity[column], 0) + model.K[row].reduce((sum, value, column) => sum + value * displacement[column], 0);
    return ((row === target ? force : 0) - internal) / mass;
  });
  return [...velocity, ...acceleration];
}

export function springMassOutputs(model: SpringMassModel): PlantOutputChannel[] {
  const count = model.config.masses.length;
  const channels: PlantOutputChannel[] = [];
  for (let index = 0; index < count; index += 1) {
    channels.push({ id: `x-${index}`, label: `质量块 ${index + 1} 位移`, unit: "m", read: (state) => state[index] });
    channels.push({ id: `v-${index}`, label: `质量块 ${index + 1} 速度`, unit: "m/s", read: (state) => state[count + index] });
    channels.push({ id: `a-${index}`, label: `质量块 ${index + 1} 加速度`, unit: "m/s²", read: (_state, _input, derivative) => derivative[count + index] });
  }
  for (const link of model.config.links) {
    const relative = (state: number[], offset: number) => (link.right < 0 ? 0 : state[offset + link.right]) - (link.left < 0 ? 0 : state[offset + link.left]);
    if (link.springEnabled) channels.push({ id: `fs-${link.id}`, label: `${linkName(link)} 弹簧力`, unit: "N", read: (state) => link.spring * relative(state, 0) });
    if (link.damperEnabled) channels.push({ id: `fd-${link.id}`, label: `${linkName(link)} 阻尼力`, unit: "N", read: (state) => link.damper * relative(state, count) });
  }
  return channels;
}

export function springMassSummary(model: SpringMassModel): PlantModelSummary {
  const frequencies = model.modes.filter((mode) => mode.frequency > 1e-8).map((mode) => mode.frequency.toFixed(3)).join(" · ") || "0";
  return {
    equations: ["M\\ddot{x}+C\\dot{x}+Kx=Fu"],
    metrics: [
      { label: "自由度", value: String(model.config.masses.length) },
      { label: "固有频率 / Hz", value: frequencies },
      { label: "有效连接", value: String(model.config.links.filter(linkIsActive).length) },
    ],
  };
}

function stateMatrix(masses: number[], C: number[][], K: number[][]) {
  const count = masses.length;
  return Array.from({ length: count * 2 }, (_, row) => Array.from({ length: count * 2 }, (_, column) => {
    if (row < count) return column === count + row ? 1 : 0;
    const state = row - count;
    if (column < count) return -K[state][column] / masses[state];
    return -C[state][column - count] / masses[state];
  }));
}

function addLink(matrix: number[][], left: number, right: number, value: number) {
  if (left >= 0) matrix[left][left] += value;
  if (right >= 0) matrix[right][right] += value;
  if (left >= 0 && right >= 0) {
    matrix[left][right] -= value;
    matrix[right][left] -= value;
  }
}

function validateLink(link: SpringMassLink, count: number) {
  if (link.left < -1 || link.right < -1 || link.left >= count || link.right >= count || link.left === link.right) throw new Error("连接槽位置无效");
  if (link.springEnabled && (!(link.spring > 0) || !Number.isFinite(link.spring))) throw new Error("弹簧刚度必须为正数");
  if (link.damperEnabled && (!(link.damper > 0) || !Number.isFinite(link.damper))) throw new Error("阻尼系数必须为正数");
}

function linkIsActive(link: SpringMassLink) { return link.springEnabled || link.damperEnabled; }
function linkName(link: SpringMassLink) { return link.left < 0 ? `墙—质量块 ${link.right + 1}` : `质量块 ${link.left + 1}—${link.right + 1}`; }
function zeros(size: number) { return Array.from({ length: size }, () => Array(size).fill(0)); }
function diagonal(values: number[]) { return values.map((value, row) => values.map((_, column) => row === column ? value : 0)); }
function cloneConfig(config: SpringMassConfig): SpringMassConfig { return { ...config, masses: [...config.masses], initialDisplacements: [...config.initialDisplacements], initialVelocities: [...config.initialVelocities], links: config.links.map((link) => ({ ...link })) }; }
