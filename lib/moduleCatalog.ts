export const CONTROL_MODULES = [
  { id: "analysis", label: "系统分析" },
  { id: "modern", label: "现代控制" },
  { id: "identification", label: "系统辨识" },
  { id: "simulation", label: "动力学仿真" },
] as const;

export type ControlModuleId = (typeof CONTROL_MODULES)[number]["id"];

export function otherControlModules(current: ControlModuleId) {
  return CONTROL_MODULES.filter((module) => module.id !== current);
}

export function moduleLabel(id: ControlModuleId) {
  return CONTROL_MODULES.find((module) => module.id === id)?.label ?? id;
}
