"use client";

import { formatPolynomial } from "@/lib/control";
import type { TransferModel } from "@/lib/control";
import { AppHeader } from "./AppHeader";

export function Cover({ model, onOpenAnalysis, onOpenClosedLoop, onOpenSimulation }: {
  model: TransferModel;
  onOpenAnalysis: () => void;
  onOpenClosedLoop: () => void;
  onOpenSimulation: () => void;
}) {
  return <main className="controlab-app cover-page">
    <AppHeader title="控制系统学习与仿真平台" />
    <section className="cover-hero">
      <div className="hero-copy">
        <span className="hero-kicker">CONTROL · UNDERSTAND · BUILD</span>
        <h1>从一个模型，走进整个<br /><em>控制系统。</em></h1>
        <p>先看懂对象，再接入反馈，最后让算法在真实动力学中运行。</p>
      </div>
      <div className="hero-orbit" aria-hidden="true"><i /><i /><i /><span>G(s)</span></div>
    </section>

    <section className="module-grid" aria-label="Controlab 模块">
      <button className="module-card primary" onClick={onOpenAnalysis}>
        <span className="module-index">01 / PLANT</span>
        <div className="module-icon plant-icon"><i /><i /><i /></div>
        <h2>系统分析</h2>
        <p>建立被控对象，观察时域、频域、根轨迹与奈氏图。</p>
        <code>{formatPolynomial(model.numerator)} / {formatPolynomial(model.denominator)}</code>
        <b>进入工作台 →</b>
      </button>
      <button className="module-card" onClick={onOpenClosedLoop}>
        <span className="module-index">02 / FEEDBACK</span>
        <div className="module-icon loop-icon"><i>C</i><i>G</i><i>↺</i></div>
        <h2>闭环控制</h2>
        <p>接入 PID 与校正器，对比控制前后的动态品质。</p>
        <code>R → C(s) → G(s) → Y</code>
        <b>开启反馈 →</b>
      </button>
      <button className="module-card simulation-card" onClick={onOpenSimulation}>
        <span className="module-index">03 / SIMULATION</span>
        <div><h2>动力学仿真</h2><p>固定运动模型、可调物理参数与可替换控制器。首个实验：小车倒立摆。</p></div>
        <div className="pendulum-mark" aria-hidden="true"><i /><span /></div>
        <b>进入实验场 →</b>
      </button>
    </section>
  </main>;
}
