"use client";

import { useState } from "react";
import { Cover } from "@/components/control-lab/Cover";
import { InvertedPendulumLab } from "@/components/simulations/InvertedPendulumLab";
import { StateSpaceLab } from "@/components/modern-control/StateSpaceLab";
import { SystemIdentificationLab } from "@/components/identification/SystemIdentificationLab";
import { Workbench } from "@/components/control-lab/Workbench";
import { useControlModel } from "@/hooks/useControlModel";

type Surface = "cover" | "analysis" | "closed-loop" | "simulation" | "state-space" | "identification";

export default function ControlLab() {
  const [surface, setSurface] = useState<Surface>("cover");
  const controller = useControlModel();
  if (surface === "cover") return <Cover model={controller.model} onOpenAnalysis={() => setSurface("analysis")} onOpenModern={() => setSurface("state-space")} onOpenIdentification={() => setSurface("identification")} onOpenSimulation={() => setSurface("simulation")} />;
  if (surface === "simulation") return <InvertedPendulumLab onHome={() => setSurface("cover")} onWorkbench={() => setSurface("closed-loop")} />;
  if (surface === "state-space") return <StateSpaceLab onHome={() => setSurface("cover")} onTransfer={() => setSurface("analysis")} onSimulation={() => setSurface("simulation")} />;
  if (surface === "identification") return <SystemIdentificationLab onHome={() => setSurface("cover")} onAnalysis={() => setSurface("analysis")} onModern={() => setSurface("state-space")} />;
  return <Workbench key={surface} controller={controller} initialClosedLoop={surface === "closed-loop"} onHome={() => setSurface("cover")} onSimulation={() => setSurface("simulation")} onStateSpace={() => setSurface("state-space")} />;
}
