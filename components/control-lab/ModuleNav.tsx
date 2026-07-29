"use client";

import { otherControlModules } from "@/lib/moduleCatalog";
import type { ControlModuleId } from "@/lib/moduleCatalog";

export function ModuleNav({ current, onNavigate }: {
  current: ControlModuleId;
  onNavigate: (module: ControlModuleId) => void;
}) {
  return <nav className="module-navigation" aria-label="切换功能模块">
    {otherControlModules(current).map((module) => <button key={module.id} className="module-navigation-button" onClick={() => onNavigate(module.id)}>{module.label}</button>)}
  </nav>;
}
