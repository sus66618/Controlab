"use client";

import { AppHeader } from "@/components/control-lab/AppHeader";
import { ModuleNav } from "@/components/control-lab/ModuleNav";
import { SIMULATION_EXPERIMENTS, groupExperiments } from "@/lib/simulation/experimentCatalog";
import type { SimulationExperimentCard, SimulationExperimentId } from "@/lib/simulation/experimentCatalog";
import type { ControlModuleId } from "@/lib/moduleCatalog";

export function SimulationGallery({ onHome, onNavigate, onOpen, experiments = SIMULATION_EXPERIMENTS }: {
  onHome: () => void;
  onNavigate: (module: ControlModuleId) => void;
  onOpen: (experiment: SimulationExperimentId) => void;
  experiments?: readonly SimulationExperimentCard[];
}) {
  const groups = groupExperiments(experiments);
  return <main className="controlab-app simulation-gallery-page">
    <AppHeader title="动力学仿真 / Experiment Gallery" onHome={onHome} trailing={<ModuleNav current="simulation" onNavigate={onNavigate} />} />
    <section className="simulation-gallery">
      <header className="simulation-gallery-hero"><span className="section-label">PHYSICAL SYSTEMS</span><h1>从对象出发，看见动态。</h1><p>先研究对象本身，再进入可以验证算法的控制实验。</p></header>
      <ExperimentGroup label="PLANT MODELS" title="被控对象" note="结构、参数、输入与输出。这里没有控制器。" items={groups.plant} onOpen={onOpen} />
      <ExperimentGroup label="CONTROL TESTS" title="验证算法" note="对象、扰动和控制算法共用同一条真实仿真链。" items={groups.control} onOpen={onOpen} />
    </section>
  </main>;
}

function ExperimentGroup({ label, title, note, items, onOpen }: { label: string; title: string; note: string; items: readonly SimulationExperimentCard[]; onOpen: (id: SimulationExperimentId) => void }) {
  return <section className="simulation-gallery-group"><header><div><span>{label}</span><h2>{title}</h2></div><p>{note}</p></header><div className="simulation-gallery-grid">{items.map((item) => <button key={item.id} className="simulation-experiment-card" style={{ "--experiment-accent": item.accent } as React.CSSProperties} onClick={() => onOpen(item.id as SimulationExperimentId)}><span className="simulation-experiment-index">{item.index}</span><div className={`simulation-card-visual visual-${item.id}`} aria-hidden="true"><i /><i /><i /></div><div><small>{item.stateLabel}</small><h3>{item.title}</h3><p>{item.description}</p></div><b>进入实验 →</b></button>)}</div></section>;
}
