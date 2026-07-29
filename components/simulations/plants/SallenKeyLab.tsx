"use client";

import { useCallback, useMemo, useState } from "react";
import { PlantLabShell } from "../PlantLabShell";
import { PlantNumberField, finiteNumber, positiveNumber } from "../PlantParameterControls";
import { usePlantSimulation } from "../usePlantSimulation";
import { SallenKeyScene } from "./SallenKeyScene";
import {
  DEFAULT_SALLEN_KEY_PARAMS,
  initialSallenKeyState,
  sallenKeyDerivative,
  sallenKeyOutputChannels,
  sallenKeySummary,
} from "@/lib/simulation/plants/sallenKey";
import type { SallenKeyParams } from "@/lib/simulation/plants/sallenKey";
import type { PlantSignal } from "@/lib/simulation/core/types";
import type { ControlModuleId } from "@/lib/moduleCatalog";

export function SallenKeyLab({ onBack, onNavigate }: { onBack: () => void; onNavigate: (module: ControlModuleId) => void }) {
  const [params, setParams] = useState<SallenKeyParams>(DEFAULT_SALLEN_KEY_PARAMS);
  const [signal, setSignal] = useState<PlantSignal>({ kind: "step", amplitude: 5, start: 0.2 });
  const [manualInput, setManualInput] = useState(0);
  const [selectedOutput, setSelectedOutput] = useState("actual-output");
  const outputs = useMemo(() => sallenKeyOutputChannels(params), [params]);
  const initialState = useMemo(() => initialSallenKeyState(params), [params]);
  const derivative = useCallback(
    (time: number, state: number[], input: number) => sallenKeyDerivative(params, time, state, input),
    [params],
  );
  const simulation = usePlantSimulation({
    initialState,
    derivative,
    signal,
    manualInput,
    dt: 0.0005,
    resetKey: JSON.stringify(params),
  });

  return <PlantLabShell
    title="Sallen-Key 有源滤波器"
    eyebrow="PLANT 04 · ACTIVE CIRCUIT"
    description="运放与 RC 网络形成二阶动态；参数决定截止频率、阻尼和通带增益。"
    inputLabel="输入电压"
    inputUnit="V"
    inputRange={[-12, 12]}
    {...simulation}
    signal={signal}
    manualInput={manualInput}
    outputs={outputs}
    selectedOutput={selectedOutput}
    summary={sallenKeySummary(params)}
    scene={<SallenKeyScene params={params} state={simulation.state} />}
    parameters={<SallenKeyParameters params={params} onChange={setParams} />}
    onRunningChange={simulation.setRunning}
    onSignalChange={setSignal}
    onManualInputChange={setManualInput}
    onOutputChange={setSelectedOutput}
    onReset={simulation.reset}
    onBack={onBack}
    onNavigate={onNavigate}
  />;
}

function SallenKeyParameters({ params, onChange }: { params: SallenKeyParams; onChange: (params: SallenKeyParams) => void }) {
  const setPositive = (key: keyof SallenKeyParams, value: number) => {
    const next = positiveNumber(value, 1e-12);
    // 理想 Sallen-Key 低通在当前拓扑下要求增益低于 3。
    onChange({ ...params, [key]: key === "gain" ? Math.min(2.99, next) : next });
  };
  const setFinite = (key: keyof SallenKeyParams, value: number) => onChange({ ...params, [key]: finiteNumber(value) });
  return <div className="plant-parameters">
    <div className="plant-parameter-section"><strong>RC 网络</strong><div className="plant-parameter-grid">
      <PlantNumberField label="R₁ / Ω" value={params.R1} onChange={(value) => setPositive("R1", value)} />
      <PlantNumberField label="R₂ / Ω" value={params.R2} onChange={(value) => setPositive("R2", value)} />
      <PlantNumberField label="C₁ / F" value={params.C1} onChange={(value) => setPositive("C1", value)} />
      <PlantNumberField label="C₂ / F" value={params.C2} onChange={(value) => setPositive("C2", value)} />
    </div></div>
    <div className="plant-parameter-section"><strong>运放</strong><div className="plant-parameter-grid">
      <PlantNumberField label="闭环增益 K" value={params.gain} min={0.01} max={2.99} step={0.01} onChange={(value) => setPositive("gain", value)} />
      <PlantNumberField label="饱和电压 / V" value={params.saturation} onChange={(value) => setPositive("saturation", value)} />
    </div><label className="plant-check"><input type="checkbox" checked={params.saturationEnabled} onChange={(event) => onChange({ ...params, saturationEnabled: event.target.checked })} /><span>显示运放输出饱和</span></label></div>
    <details><summary>初始状态</summary><div className="plant-parameter-grid">
      <PlantNumberField label="输出 / V" value={params.initialOutput} onChange={(value) => setFinite("initialOutput", value)} />
      <PlantNumberField label="变化率 / V·s⁻¹" value={params.initialRate} onChange={(value) => setFinite("initialRate", value)} />
    </div></details>
  </div>;
}
