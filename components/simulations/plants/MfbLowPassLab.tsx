"use client";

import { useCallback, useMemo, useState } from "react";
import { PlantLabShell } from "../PlantLabShell";
import { PlantNumberField, finiteNumber, positiveNumber } from "../PlantParameterControls";
import { usePlantSimulation } from "../usePlantSimulation";
import { MfbLowPassScene } from "./MfbLowPassScene";
import {
  DEFAULT_MFB_LOW_PASS_PARAMS,
  initialMfbLowPassState,
  mfbLowPassDerivative,
  mfbLowPassOutputChannels,
  mfbLowPassSummary,
} from "@/lib/simulation/plants/mfbLowPass";
import type { MfbLowPassParams } from "@/lib/simulation/plants/mfbLowPass";
import type { PlantSignal } from "@/lib/simulation/core/types";
import type { ControlModuleId } from "@/lib/moduleCatalog";

export function MfbLowPassLab({ onBack, onNavigate }: { onBack: () => void; onNavigate: (module: ControlModuleId) => void }) {
  const [params, setParams] = useState<MfbLowPassParams>(DEFAULT_MFB_LOW_PASS_PARAMS);
  const [signal, setSignal] = useState<PlantSignal>({ kind: "step", amplitude: 5, start: 0.2 });
  const [manualInput, setManualInput] = useState(0);
  const [selectedOutput, setSelectedOutput] = useState("actual-output");
  const outputs = useMemo(() => mfbLowPassOutputChannels(params), [params]);
  const initialState = useMemo(() => initialMfbLowPassState(params), [params]);
  const derivative = useCallback(
    (time: number, state: number[], input: number) => mfbLowPassDerivative(params, time, state, input),
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
    title="反相 MFB 有源低通"
    eyebrow="PLANT 04 · ACTIVE CIRCUIT"
    description="信号进入反相端，两条反馈支路与接地电容共同形成二阶动态。"
    inputLabel="输入电压"
    inputUnit="V"
    inputRange={[-12, 12]}
    {...simulation}
    signal={signal}
    manualInput={manualInput}
    outputs={outputs}
    selectedOutput={selectedOutput}
    summary={mfbLowPassSummary(params)}
    scene={<MfbLowPassScene params={params} state={simulation.state} />}
    parameters={<MfbLowPassParameters params={params} onChange={setParams} />}
    onRunningChange={simulation.setRunning}
    onSignalChange={setSignal}
    onManualInputChange={setManualInput}
    onOutputChange={setSelectedOutput}
    onReset={simulation.reset}
    onBack={onBack}
    onNavigate={onNavigate}
  />;
}

function MfbLowPassParameters({ params, onChange }: { params: MfbLowPassParams; onChange: (params: MfbLowPassParams) => void }) {
  const setPositive = (key: keyof MfbLowPassParams, value: number) => onChange({ ...params, [key]: positiveNumber(value, 1e-12) });
  const setFinite = (key: keyof MfbLowPassParams, value: number) => onChange({ ...params, [key]: finiteNumber(value) });
  return <div className="plant-parameters">
    <div className="plant-parameter-section"><strong>反相 MFB 网络</strong><div className="plant-parameter-grid">
      <PlantNumberField label="R₁ / Ω" value={params.R1} onChange={(value) => setPositive("R1", value)} />
      <PlantNumberField label="R₂ / Ω" value={params.R2} onChange={(value) => setPositive("R2", value)} />
      <PlantNumberField label="R₃ / Ω" value={params.R3} onChange={(value) => setPositive("R3", value)} />
      <PlantNumberField label="C₁ / F" value={params.C1} onChange={(value) => setPositive("C1", value)} />
      <PlantNumberField label="C₂ / F" value={params.C2} onChange={(value) => setPositive("C2", value)} />
    </div></div>
    <div className="plant-parameter-section"><strong>运放输出</strong><div className="plant-parameter-grid">
      <PlantNumberField label="限幅电压 / V" value={params.saturation} onChange={(value) => setPositive("saturation", value)} />
    </div><label className="plant-check"><input type="checkbox" checked={params.saturationEnabled} onChange={(event) => onChange({ ...params, saturationEnabled: event.target.checked })} /><span>启用输出限幅</span></label></div>
    <details><summary>初始状态</summary><div className="plant-parameter-grid">
      <PlantNumberField label="输出 / V" value={params.initialOutput} onChange={(value) => setFinite("initialOutput", value)} />
      <PlantNumberField label="变化率 / V·s⁻¹" value={params.initialRate} onChange={(value) => setFinite("initialRate", value)} />
    </div></details>
  </div>;
}
