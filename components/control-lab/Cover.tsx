"use client";

import { MathFormula } from "@/components/math/MathFormula";
import type { TransferModel } from "@/lib/control";
import { transferToLatex } from "@/lib/math/latex";
import { moduleLabel } from "@/lib/moduleCatalog";
import type { ControlModuleId } from "@/lib/moduleCatalog";
import { AppHeader } from "./AppHeader";

export function Cover({ model, onOpenModule }: {
  model: TransferModel;
  onOpenModule: (module: ControlModuleId) => void;
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
      <button className="module-card primary" onClick={() => onOpenModule("analysis")}>
        <span className="module-index">01 / SYSTEM</span>
        <div className="module-icon plant-icon"><i /><i /><i /></div>
        <h2>{moduleLabel("analysis")}</h2>
        <p>传递函数、时频域、根轨迹、奈氏图与经典闭环控制。</p>
        <MathFormula className="module-formula" latex={transferToLatex(model.numerator, model.denominator)} />
        <b>进入工作台 →</b>
      </button>
      <button className="module-card" onClick={() => onOpenModule("modern")}>
        <span className="module-index">02 / MODERN</span>
        <div className="module-icon loop-icon"><i>C</i><i>G</i><i>↺</i></div>
        <h2>{moduleLabel("modern")}</h2>
        <p>状态空间、状态反馈、极点配置、LQR、观测器与卡尔曼滤波。</p>
        <MathFormula className="module-formula" latex="\dot{x}=Ax+Bu,\quad y=Cx+Du" />
        <b>设计控制器 →</b>
      </button>
      <button className="module-card identification-card" onClick={() => onOpenModule("identification")}>
        <span className="module-index">03 / IDENTIFICATION</span>
        <div className="module-icon identification-icon"><i /><i /><i /></div>
        <h2>{moduleLabel("identification")}</h2>
        <p>从输入输出数据辨识动态模型，并用独立验证检验可信度。</p>
        <MathFormula className="module-formula" latex="A(q^{-1})y=B(q^{-1})u+e" />
        <b>从数据建模 →</b>
      </button>
      <button className="module-card simulation-card" onClick={() => onOpenModule("simulation")}>
        <span className="module-index">04 / SIMULATION</span>
        <div><h2>{moduleLabel("simulation")}</h2><p>物理参数、外部扰动与可替换控制器。当前实验：小车倒立摆。</p></div>
        <div className="pendulum-mark" aria-hidden="true"><i /><span /></div>
        <b>进入实验场 →</b>
      </button>
    </section>
  </main>;
}
