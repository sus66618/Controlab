"use client";

import { useCallback, useMemo, useState } from "react";
import { PlantLabShell } from "../PlantLabShell";
import { PlantNumberField, finiteNumber, positiveNumber } from "../PlantParameterControls";
import { usePlantSimulation } from "../usePlantSimulation";
import { DcMotorScene } from "./DcMotorScene";
import { signalValue } from "@/lib/simulation/core/signals";
import { DEFAULT_DC_MOTOR_PARAMS, dcMotorDerivative, dcMotorOutputs, dcMotorSummary, initialDcMotorState } from "@/lib/simulation/plants/dcMotor";
import type { DcMotorParams } from "@/lib/simulation/plants/dcMotor";
import type { PlantSignal } from "@/lib/simulation/core/types";
import type { ControlModuleId } from "@/lib/moduleCatalog";

export function DcMotorLab({ onBack, onNavigate }: { onBack: () => void; onNavigate: (module: ControlModuleId) => void }) {
  const [params, setParams] = useState<DcMotorParams>(DEFAULT_DC_MOTOR_PARAMS);
  const [signal, setSignal] = useState<PlantSignal>({ kind: "step", amplitude: 12, start: 0.25 });
  const [manualInput, setManualInput] = useState(0);
  const [loadSignal, setLoadSignal] = useState<PlantSignal>({ kind: "constant", amplitude: 0.05 });
  const [selectedOutput, setSelectedOutput] = useState("speed");
  const outputs = useMemo(() => dcMotorOutputs(params), [params]);
  const initialState = useMemo(() => initialDcMotorState(params), [params]);
  const derivative = useCallback((time: number, state: number[], voltage: number) => dcMotorDerivative(params, time, state, voltage, signalValue(loadSignal, time, 0)), [loadSignal, params]);
  const simulation = usePlantSimulation({ initialState, derivative, signal, manualInput, dt: 0.001, resetKey: JSON.stringify(params) });
  const voltage = signalValue(signal, simulation.time, manualInput);
  const loadTorque = signalValue(loadSignal, simulation.time, 0);
  return <PlantLabShell title="电枢控制直流电机" eyebrow="PLANT 02 · ELECTROMECHANICAL" description="电流先建立转矩，转矩再推动惯量；电气和机械动态缺一不可。" inputLabel="电枢电压" inputUnit="V" inputRange={[-24, 24]} {...simulation} signal={signal} manualInput={manualInput} outputs={outputs} selectedOutput={selectedOutput} summary={dcMotorSummary(params)} scene={<DcMotorScene state={simulation.state} voltage={voltage} loadTorque={loadTorque} torqueConstant={params.kt} />} parameters={<MotorParameters params={params} onChange={setParams} />} extraInput={<LoadEditor signal={loadSignal} onChange={setLoadSignal} />} onRunningChange={simulation.setRunning} onSignalChange={setSignal} onManualInputChange={setManualInput} onOutputChange={setSelectedOutput} onReset={simulation.reset} onBack={onBack} onNavigate={onNavigate} />;
}

function MotorParameters({ params, onChange }: { params: DcMotorParams; onChange: (params: DcMotorParams) => void }) {
  const setPositive = (key: keyof DcMotorParams, value: number) => onChange({ ...params, [key]: positiveNumber(value, key === "b" ? 0 : 1e-6) });
  const setFinite = (key: keyof DcMotorParams, value: number) => onChange({ ...params, [key]: finiteNumber(value) });
  return <div className="plant-parameters"><div className="plant-parameter-section"><strong>电气参数</strong><div className="plant-parameter-grid"><PlantNumberField label="R / Ω" value={params.R} onChange={(value) => setPositive("R", value)} /><PlantNumberField label="L / H" value={params.L} onChange={(value) => setPositive("L", value)} /><PlantNumberField label="Kₑ / V·s·rad⁻¹" value={params.ke} onChange={(value) => setPositive("ke", value)} /><PlantNumberField label="Kₜ / N·m·A⁻¹" value={params.kt} onChange={(value) => setPositive("kt", value)} /></div></div><div className="plant-parameter-section"><strong>机械参数</strong><div className="plant-parameter-grid"><PlantNumberField label="J / kg·m²" value={params.J} onChange={(value) => setPositive("J", value)} /><PlantNumberField label="b / N·m·s" value={params.b} onChange={(value) => setPositive("b", value)} /></div></div><details><summary>初始状态</summary><div className="plant-parameter-grid"><PlantNumberField label="电流 / A" value={params.initialCurrent} onChange={(value) => setFinite("initialCurrent", value)} /><PlantNumberField label="转速 / rad·s⁻¹" value={params.initialSpeed} onChange={(value) => setFinite("initialSpeed", value)} /><PlantNumberField label="角度 / rad" value={params.initialAngle} onChange={(value) => setFinite("initialAngle", value)} /></div></details></div>;
}

function LoadEditor({ signal, onChange }: { signal: PlantSignal; onChange: (signal: PlantSignal) => void }) {
  const amplitude = signal.kind === "manual" ? 0 : signal.amplitude;
  const setKind = (kind: "constant" | "step" | "pulse") => onChange(kind === "constant" ? { kind, amplitude } : kind === "step" ? { kind, amplitude, start: .8 } : { kind, amplitude, start: .8, duration: .3 });
  return <div className="plant-secondary-input"><header><span>DISTURBANCE</span><strong>负载转矩</strong></header><label className="plant-select"><span>形式</span><select value={signal.kind} onChange={(event) => setKind(event.target.value as "constant" | "step" | "pulse")}><option value="constant">恒值</option><option value="step">阶跃</option><option value="pulse">脉冲</option></select></label><PlantNumberField label="幅值 / N·m" value={amplitude} onChange={(value) => onChange({ ...signal, amplitude: finiteNumber(value) } as PlantSignal)} />{"start" in signal && <PlantNumberField label="开始 / s" value={signal.start} onChange={(value) => onChange({ ...signal, start: Math.max(0, finiteNumber(value)) } as PlantSignal)} />}{signal.kind === "pulse" && <PlantNumberField label="持续 / s" value={signal.duration} onChange={(value) => onChange({ ...signal, duration: positiveNumber(value, .01) })} />}</div>;
}
