"use client";

import { useState } from "react";
import { AppHeader } from "@/components/control-lab/AppHeader";
import { ModuleNav } from "@/components/control-lab/ModuleNav";
import { InvertedPendulumLab } from "./InvertedPendulumLab";
import { SimulationGallery } from "./SimulationGallery";
import { SpringMassLab } from "./plants/SpringMassLab";
import { DcMotorLab } from "./plants/DcMotorLab";
import { PassiveRlcLab } from "./plants/PassiveRlcLab";
import { MfbLowPassLab } from "./plants/MfbLowPassLab";
import { simulationExperiment } from "@/lib/simulation/experimentCatalog";
import type { SimulationExperimentId } from "@/lib/simulation/experimentCatalog";
import type { ControlModuleId } from "@/lib/moduleCatalog";

export function SimulationWorkspace({ onHome, onNavigate }: { onHome: () => void; onNavigate: (module: ControlModuleId) => void }) {
  const [selected, setSelected] = useState<SimulationExperimentId | null>(null);
  if (!selected) return <SimulationGallery onHome={onHome} onNavigate={onNavigate} onOpen={setSelected} />;
  if (selected === "cart-pole") return <InvertedPendulumLab onHome={() => setSelected(null)} onNavigate={onNavigate} />;
  if (selected === "spring-mass") return <SpringMassLab onBack={() => setSelected(null)} onNavigate={onNavigate} />;
  if (selected === "dc-motor") return <DcMotorLab onBack={() => setSelected(null)} onNavigate={onNavigate} />;
  if (selected === "passive-rlc") return <PassiveRlcLab onBack={() => setSelected(null)} onNavigate={onNavigate} />;
  if (selected === "active-mfb") return <MfbLowPassLab onBack={() => setSelected(null)} onNavigate={onNavigate} />;
  const experiment = simulationExperiment(selected);
  return <main className="controlab-app plant-lab-page"><AppHeader title={`动力学仿真 / ${experiment.title}`} onHome={() => setSelected(null)} trailing={<ModuleNav current="simulation" onNavigate={onNavigate} />} /><section className="plant-loading"><span>{experiment.index}</span><h1>{experiment.title}</h1><p>实验对象正在接入统一仿真内核。</p><button onClick={() => setSelected(null)}>返回实验大厅</button></section></main>;
}
