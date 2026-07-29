import type { PlantSignal } from "./types.ts";

export function signalValue(signal: PlantSignal, time: number, manualValue: number) {
  switch (signal.kind) {
    case "manual": return manualValue;
    case "constant": return signal.amplitude;
    case "step": return time >= signal.start ? signal.amplitude : 0;
    case "sine": return signal.amplitude * Math.sin(2 * Math.PI * signal.frequency * time + signal.phase);
    case "pulse": return time >= signal.start && time <= signal.start + signal.duration ? signal.amplitude : 0;
  }
}

export function signalLabel(signal: PlantSignal) {
  return { manual: "手动", constant: "恒值", step: "阶跃", sine: "正弦", pulse: "脉冲" }[signal.kind];
}
