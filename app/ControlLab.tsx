"use client";

import { useState } from "react";
import { Cover } from "@/components/control-lab/Cover";
import { InvertedPendulumLab } from "@/components/simulations/InvertedPendulumLab";
import { Workbench } from "@/components/control-lab/Workbench";
import { useControlModel } from "@/hooks/useControlModel";

type Surface = "cover" | "analysis" | "closed-loop" | "simulation";

export default function ControlLab() {
  const [surface, setSurface] = useState<Surface>("cover");
  const controller = useControlModel();
  if (surface === "cover") return <Cover model={controller.model} onOpenAnalysis={() => setSurface("analysis")} onOpenClosedLoop={() => setSurface("closed-loop")} onOpenSimulation={() => setSurface("simulation")} />;
  if (surface === "simulation") return <InvertedPendulumLab onHome={() => setSurface("cover")} onWorkbench={() => setSurface("closed-loop")} />;
  return <Workbench key={surface} controller={controller} initialClosedLoop={surface === "closed-loop"} onHome={() => setSurface("cover")} onSimulation={() => setSurface("simulation")} />;
}
