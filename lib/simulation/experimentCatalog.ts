export type SimulationExperimentCategory = "plant" | "control";

export type SimulationExperimentCard = {
  id: string;
  category: SimulationExperimentCategory;
  index: string;
  title: string;
  description: string;
  stateLabel: string;
  accent: string;
};

export const SIMULATION_EXPERIMENTS = [
  { id: "spring-mass", category: "plant", index: "01", title: "弹簧—阻尼", description: "改变质量、连接、刚度和阻尼，观察能量与运动如何传递。", stateLabel: "x · v · F", accent: "#b7ff4a" },
  { id: "dc-motor", category: "plant", index: "02", title: "直流电机", description: "连接电枢电流、电磁转矩与机械转速。", stateLabel: "i · ω · θ", accent: "#55d6be" },
  { id: "passive-rlc", category: "plant", index: "03", title: "无源 RLC", description: "从初始储能或外部信号观察二阶电路响应。", stateLabel: "iL · vC", accent: "#f3ac58" },
  { id: "active-mfb", category: "plant", index: "04", title: "反相 MFB 低通", description: "用反相运放与多重反馈网络实现二阶动态模型。", stateLabel: "ωn · ζ · K₀", accent: "#b18cff" },
  { id: "cart-pole", category: "control", index: "01", title: "小车倒立摆", description: "在非线性动力学中比较 PID、LQR、输入和扰动。", stateLabel: "x · θ · u", accent: "#b7ff4a" },
] as const satisfies readonly SimulationExperimentCard[];

export type SimulationExperimentId = (typeof SIMULATION_EXPERIMENTS)[number]["id"];

export function groupExperiments<T extends SimulationExperimentCard>(experiments: readonly T[]) {
  return {
    plant: experiments.filter((experiment) => experiment.category === "plant"),
    control: experiments.filter((experiment) => experiment.category === "control"),
  };
}

export function experimentsByCategory(category: SimulationExperimentCategory) {
  return SIMULATION_EXPERIMENTS.filter((experiment) => experiment.category === category);
}

export function simulationExperiment(id: SimulationExperimentId) {
  return SIMULATION_EXPERIMENTS.find((experiment) => experiment.id === id) ?? SIMULATION_EXPERIMENTS[0];
}
