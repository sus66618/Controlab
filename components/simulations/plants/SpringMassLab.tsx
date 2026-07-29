"use client";

import { useCallback, useMemo, useState } from "react";
import { PlantLabShell } from "../PlantLabShell";
import { usePlantSimulation } from "../usePlantSimulation";
import { SpringMassScene } from "./SpringMassScene";
import { signalValue } from "@/lib/simulation/core/signals";
import { buildSpringMassModel, defaultSpringMassConfig, initialSpringMassState, springMassDerivative, springMassOutputs, springMassSummary } from "@/lib/simulation/plants/springMass";
import type { PlantSignal } from "@/lib/simulation/core/types";
import type { SpringMassConfig } from "@/lib/simulation/plants/springMass";
import type { ControlModuleId } from "@/lib/moduleCatalog";

export function SpringMassLab({ onBack, onNavigate }: { onBack: () => void; onNavigate: (module: ControlModuleId) => void }) {
  const [config, setConfig] = useState(() => defaultSpringMassConfig(2));
  const [signal, setSignal] = useState<PlantSignal>({ kind: "manual" });
  const [manualInput, setManualInput] = useState(0);
  const [selectedOutput, setSelectedOutput] = useState("x-0");
  const model = useMemo(() => buildSpringMassModel(config), [config]);
  const outputs = useMemo(() => springMassOutputs(model), [model]);
  const outputId = outputs.some((item) => item.id === selectedOutput) ? selectedOutput : outputs[0].id;
  const output = outputs.find((item) => item.id === outputId) ?? outputs[0];
  const initialState = useMemo(() => initialSpringMassState(config), [config]);
  const derivative = useCallback((time: number, state: number[], force: number) => springMassDerivative(model, time, state, force), [model]);
  const simulation = usePlantSimulation({ initialState, derivative, signal, manualInput, output, resetKey: JSON.stringify(config) });
  const force = signalValue(signal, simulation.time, manualInput);
  const updateCount = (count: number) => setConfig(defaultSpringMassConfig(count));
  return <PlantLabShell title="多质量弹簧—阻尼系统" eyebrow="PLANT 01 · MECHANICAL" description="连接改变，质量、阻尼和刚度矩阵也随之改变。" inputLabel="外力" inputUnit="N" inputRange={[-20, 20]} {...simulation} signal={signal} manualInput={manualInput} outputs={outputs} selectedOutput={outputId} summary={springMassSummary(model)} scene={<SpringMassScene model={model} state={simulation.state} force={force} />} parameters={<SpringParameters config={config} onChange={setConfig} onCountChange={updateCount} />} onRunningChange={simulation.setRunning} onSignalChange={setSignal} onManualInputChange={setManualInput} onOutputChange={setSelectedOutput} onReset={simulation.reset} onBack={onBack} onNavigate={onNavigate} />;
}

function SpringParameters({ config, onChange, onCountChange }: { config: SpringMassConfig; onChange: (config: SpringMassConfig) => void; onCountChange: (count: number) => void }) {
  const updateMass = (index: number, value: number) => onChange({ ...config, masses: config.masses.map((mass, current) => current === index ? positive(value, .05) : mass) });
  const updateInitial = (index: number, value: number) => onChange({ ...config, initialDisplacements: config.initialDisplacements.map((item, current) => current === index ? finite(value) : item) });
  const updateLink = (index: number, patch: Partial<SpringMassConfig["links"][number]>) => onChange({ ...config, links: config.links.map((link, current) => current === index ? { ...link, ...patch } : link) });
  return <div className="plant-parameters"><label className="plant-select"><span>质量块数量</span><select value={config.masses.length} onChange={(event) => onCountChange(Number(event.target.value))}><option value={1}>1 个</option><option value={2}>2 个</option><option value={3}>3 个</option></select></label><div className="plant-parameter-grid">{config.masses.map((mass, index) => <div className="plant-parameter-unit" key={index}><strong>质量块 {index + 1}</strong><ParameterNumber label="质量 / kg" value={mass} onChange={(value) => updateMass(index, value)} /><ParameterNumber label="初始位移 / m" value={config.initialDisplacements[index]} onChange={(value) => updateInitial(index, value)} /></div>)}</div><div className="spring-links">{config.links.map((link, index) => <div className="spring-link-editor" key={link.id}><strong>{link.left < 0 ? `墙 — 质量块 ${link.right + 1}` : `质量块 ${link.left + 1} — ${link.right + 1}`}</strong><label className="plant-check"><input type="checkbox" checked={link.springEnabled} disabled={link.springEnabled && config.links.filter((item) => item.springEnabled || item.damperEnabled).length === 1 && !link.damperEnabled} onChange={(event) => updateLink(index, { springEnabled: event.target.checked })} /><span>弹簧</span></label>{link.springEnabled && <ParameterNumber label="k / N·m⁻¹" value={link.spring} onChange={(value) => updateLink(index, { spring: positive(value, .01) })} />}<label className="plant-check"><input type="checkbox" checked={link.damperEnabled} disabled={link.damperEnabled && config.links.filter((item) => item.springEnabled || item.damperEnabled).length === 1 && !link.springEnabled} onChange={(event) => updateLink(index, { damperEnabled: event.target.checked })} /><span>阻尼器</span></label>{link.damperEnabled && <ParameterNumber label="c / N·s·m⁻¹" value={link.damper} onChange={(value) => updateLink(index, { damper: positive(value, .01) })} />}</div>)}</div><label className="plant-select"><span>外力作用对象</span><select value={config.forceTarget} onChange={(event) => onChange({ ...config, forceTarget: Number(event.target.value) })}>{config.masses.map((_, index) => <option key={index} value={index}>质量块 {index + 1}</option>)}</select></label></div>;
}

function ParameterNumber({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="plant-number"><span>{label}</span><input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>; }
function positive(value: number, minimum: number) { return Number.isFinite(value) ? Math.max(minimum, value) : minimum; }
function finite(value: number) { return Number.isFinite(value) ? value : 0; }
