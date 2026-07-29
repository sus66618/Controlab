"use client";

import { useState } from "react";
import { Cover } from "@/components/control-lab/Cover";
import { SimulationWorkspace } from "@/components/simulations/SimulationWorkspace";
import { StateSpaceLab } from "@/components/modern-control/StateSpaceLab";
import { SystemIdentificationLab } from "@/components/identification/SystemIdentificationLab";
import { Workbench } from "@/components/control-lab/Workbench";
import { useControlModel } from "@/hooks/useControlModel";
import type { ControlModuleId } from "@/lib/moduleCatalog";

type Surface = "cover" | ControlModuleId;

export default function ControlLab() {
  const [surface, setSurface] = useState<Surface>("cover");
  const controller = useControlModel();
  const navigate = (module: ControlModuleId) => setSurface(module);
  if (surface === "cover") return <Cover model={controller.model} onOpenModule={navigate} />;
  if (surface === "simulation") return <SimulationWorkspace onHome={() => setSurface("cover")} onNavigate={navigate} />;
  if (surface === "modern") return <StateSpaceLab onHome={() => setSurface("cover")} onNavigate={navigate} />;
  if (surface === "identification") return <SystemIdentificationLab onHome={() => setSurface("cover")} onNavigate={navigate} />;
  return <Workbench controller={controller} onHome={() => setSurface("cover")} onNavigate={navigate} />;
}
