"use client";

import { useCallback, useMemo, useState } from "react";
import { PlantLabShell } from "../PlantLabShell";
import { PlantNumberField, finiteNumber, positiveNumber } from "../PlantParameterControls";
import { usePlantSimulation } from "../usePlantSimulation";
import { PassiveRlcScene } from "./PassiveRlcScene";
import { signalValue } from "@/lib/simulation/core/signals";
import { buildPassiveRlcModel, defaultPassiveRlcConfig, initialPassiveRlcState, passiveRlcDerivative, passiveRlcOutputs, passiveRlcSummary } from "@/lib/simulation/plants/passiveRlc";
import type { CircuitComponent, PassiveRlcConfig } from "@/lib/simulation/plants/passiveRlc";
import type { PlantSignal } from "@/lib/simulation/core/types";
import type { ControlModuleId } from "@/lib/moduleCatalog";

export function PassiveRlcLab({ onBack, onNavigate }: { onBack: () => void; onNavigate: (module: ControlModuleId) => void }) {
  const [config, setConfig] = useState(() => defaultPassiveRlcConfig("series"));
  const [signal, setSignal] = useState<PlantSignal>({ kind: "step", amplitude: 5, start: .3 });
  const [manualInput, setManualInput] = useState(0);
  const [selectedOutput, setSelectedOutput] = useState("current");
  const model = useMemo(() => buildPassiveRlcModel(config), [config]);
  const outputs = useMemo(() => passiveRlcOutputs(model), [model]);
  const outputId = outputs.some((item) => item.id === selectedOutput) ? selectedOutput : outputs[0].id;
  const output = outputs.find((item) => item.id === outputId) ?? outputs[0];
  const initialState = useMemo(() => initialPassiveRlcState(config), [config]);
  const derivative = useCallback((time: number, state: number[], source: number) => passiveRlcDerivative(model, time, state, source), [model]);
  const simulation = usePlantSimulation({ initialState, derivative, signal, manualInput, output, dt: .0005, resetKey: JSON.stringify(config) });
  const source = signalValue(signal, simulation.time, manualInput);
  const isSeries = config.topology === "series";
  return <PlantLabShell title="无源 RLC 电路" eyebrow="PLANT 03 · PASSIVE CIRCUIT" description="外部激励与初始储能共同决定电阻、电感和电容之间的能量交换。" inputLabel={isSeries ? "电压源" : "电流源"} inputUnit={isSeries ? "V" : "A"} inputRange={isSeries ? [-12, 12] : [-3, 3]} {...simulation} signal={signal} manualInput={manualInput} outputs={outputs} selectedOutput={outputId} summary={passiveRlcSummary(model)} scene={<PassiveRlcScene model={model} state={simulation.state} source={source} />} parameters={<PassiveRlcParameters config={config} onChange={setConfig} />} onRunningChange={simulation.setRunning} onSignalChange={setSignal} onManualInputChange={setManualInput} onOutputChange={setSelectedOutput} onReset={simulation.reset} onBack={onBack} onNavigate={onNavigate} />;
}

function PassiveRlcParameters({ config, onChange }: { config: PassiveRlcConfig; onChange: (config: PassiveRlcConfig) => void }) {
  const changeTopology = (topology: PassiveRlcConfig["topology"]) => onChange({ ...config, topology });
  return <div className="plant-parameters"><div className="mini-switch"><button className={config.topology === "series" ? "active" : ""} onClick={() => changeTopology("series")}>串联 RLC</button><button className={config.topology === "parallel" ? "active" : ""} onClick={() => changeTopology("parallel")}>并联 RLC</button></div><p className="plant-parameter-note">同一串联支路内交换理想元件位置不会改变集中参数模型；串并联关系和元件数值才会改变动态。</p><ComponentGroup symbol="R" unit="Ω" components={config.resistors} onChange={(resistors) => onChange({ ...config, resistors })} /><ComponentGroup symbol="L" unit="H" components={config.inductors} onChange={(inductors) => onChange({ ...config, inductors })} /><ComponentGroup symbol="C" unit="F" components={config.capacitors} onChange={(capacitors) => onChange({ ...config, capacitors })} /><details><summary>初始储能</summary><div className="plant-parameter-grid"><PlantNumberField label="电容初始电压 / V" value={config.initialCapacitorVoltage} onChange={(value) => onChange({ ...config, initialCapacitorVoltage: finiteNumber(value) })} /><PlantNumberField label="电感初始电流 / A" value={config.initialInductorCurrent} onChange={(value) => onChange({ ...config, initialInductorCurrent: finiteNumber(value) })} /></div></details></div>;
}

function ComponentGroup({ symbol, unit, components, onChange }: { symbol: "R" | "L" | "C"; unit: string; components: CircuitComponent[]; onChange: (components: CircuitComponent[]) => void }) {
  const enabledCount = components.filter((item) => item.enabled).length;
  const update = (index: number, patch: Partial<CircuitComponent>) => onChange(components.map((item, current) => current === index ? { ...item, ...patch } : item));
  const add = () => components.length < 3 && onChange([...components, { id: `${symbol.toLowerCase()}${components.length + 1}`, enabled: true, value: components.at(-1)?.value ?? 1 }]);
  const remove = (index: number) => components.length > 1 && onChange(components.filter((_, current) => current !== index).map((item, current) => ({ ...item, id: `${symbol.toLowerCase()}${current + 1}` })));
  return <section className="circuit-component-group"><header><strong>{symbol} 元件</strong><button disabled={components.length >= 3} onClick={add}>添加</button></header>{components.map((component, index) => <div className="circuit-component-row" key={component.id}><label className="plant-check"><input type="checkbox" checked={component.enabled} disabled={component.enabled && enabledCount === 1} onChange={(event) => update(index, { enabled: event.target.checked })} /><span>{symbol}{index + 1}</span></label><PlantNumberField label={unit} value={component.value} onChange={(value) => update(index, { value: positiveNumber(value, 1e-9) })} /><button disabled={components.length === 1} onClick={() => remove(index)} aria-label={`删除 ${symbol}${index + 1}`}>×</button></div>)}</section>;
}
