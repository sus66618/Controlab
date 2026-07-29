"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/control-lab/AppHeader";
import { MathFormula } from "@/components/math/MathFormula";
import { formatNumber } from "@/lib/control";
import { transferToLatex } from "@/lib/math/latex";
import {
  DEFAULT_CART_POLE_PARAMS,
  DEFAULT_EXCITATION,
  DEFAULT_LQR_CONFIG,
  DEFAULT_PID_CONFIG,
  designLqrGains,
  excitationValue,
  initialCartPoleState,
  linearizeCartPole,
  pendulumControlForce,
  stepCartPole,
} from "@/lib/simulation/cartPole";
import type {
  CartPoleParams,
  CartPoleState,
  ExcitationConfig,
  LqrControllerConfig,
  PendulumController,
  PidControllerConfig,
} from "@/lib/simulation/cartPole";

type SideTab = "controller" | "input" | "model" | "principle";
type HistoryPoint = { time: number; theta: number; x: number; force: number; reference: number; disturbance: number };
type SavedRun = { label: string; points: HistoryPoint[] } | null;

export function InvertedPendulumLab({ onHome, onWorkbench }: { onHome: () => void; onWorkbench: () => void }) {
  const [state, setState] = useState<CartPoleState>(() => initialCartPoleState());
  const [params, setParams] = useState<CartPoleParams>(DEFAULT_CART_POLE_PARAMS);
  const [controllerEnabled, setControllerEnabled] = useState(true);
  const [controllerType, setControllerType] = useState<Exclude<PendulumController, "off">>("lqr");
  const [pidDraft, setPidDraft] = useState<PidControllerConfig>(DEFAULT_PID_CONFIG);
  const [pidApplied, setPidApplied] = useState<PidControllerConfig>(DEFAULT_PID_CONFIG);
  const [lqrDraft, setLqrDraft] = useState<LqrControllerConfig>(DEFAULT_LQR_CONFIG);
  const [lqrApplied, setLqrApplied] = useState<LqrControllerConfig>(DEFAULT_LQR_CONFIG);
  const [lqrDesignMode, setLqrDesignMode] = useState<"weights" | "gain">("weights");
  const [controllerMessage, setControllerMessage] = useState("当前使用推荐 LQR 增益");
  const [excitationDraft, setExcitationDraft] = useState<ExcitationConfig>(DEFAULT_EXCITATION);
  const [excitationApplied, setExcitationApplied] = useState<ExcitationConfig>(DEFAULT_EXCITATION);
  const [inputMessage, setInputMessage] = useState("当前没有自动输入，鼠标扰动仍可用");
  const [sideTab, setSideTab] = useState<SideTab>("controller");
  const [running, setRunning] = useState(true);
  const [initialAngle, setInitialAngle] = useState(7);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [savedRun, setSavedRun] = useState<SavedRun>(null);
  const [dragForce, setDragForce] = useState(0);

  const stateRef = useRef(state);
  const paramsRef = useRef(params);
  const enabledRef = useRef(controllerEnabled);
  const typeRef = useRef(controllerType);
  const runningRef = useRef(running);
  const pidRef = useRef(pidApplied);
  const lqrRef = useRef(lqrApplied);
  const excitationRef = useRef(excitationApplied);
  const signalEpochRef = useRef(0);
  const angleIntegralRef = useRef(0);
  const externalForceRef = useRef({ value: 0, until: 0 });
  const dragRef = useRef<{ x: number } | null>(null);

  useEffect(() => { paramsRef.current = params; }, [params]);
  useEffect(() => { enabledRef.current = controllerEnabled; }, [controllerEnabled]);
  useEffect(() => { typeRef.current = controllerType; angleIntegralRef.current = 0; }, [controllerType]);
  useEffect(() => { runningRef.current = running; }, [running]);
  useEffect(() => { pidRef.current = pidApplied; }, [pidApplied]);
  useEffect(() => { lqrRef.current = lqrApplied; }, [lqrApplied]);
  useEffect(() => { excitationRef.current = excitationApplied; }, [excitationApplied]);

  const linearModel = useMemo(() => linearizeCartPole(params), [params]);

  const reset = useCallback(() => {
    const next = initialCartPoleState(initialAngle);
    stateRef.current = next;
    signalEpochRef.current = 0;
    angleIntegralRef.current = 0;
    externalForceRef.current = { value: 0, until: 0 };
    setDragForce(0);
    setHistory([]);
    setState(next);
  }, [initialAngle]);

  const disturb = useCallback((force: number, duration = 0.16) => {
    externalForceRef.current = { value: force, until: performance.now() / 1000 + duration };
    setDragForce(force);
    window.setTimeout(() => setDragForce(0), duration * 1000);
  }, []);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let accumulator = 0;
    let renderAccumulator = 0;
    const dt = 1 / 240;
    const loop = (now: number) => {
      const elapsed = Math.min(0.04, Math.max(0, (now - last) / 1000));
      last = now;
      if (runningRef.current) {
        accumulator += elapsed;
        renderAccumulator += elapsed;
        while (accumulator >= dt) {
          const current = stateRef.current;
          const mode: PendulumController = enabledRef.current ? typeRef.current : "off";
          const signal = excitationValue(excitationRef.current, current.time - signalEpochRef.current);
          const reference = excitationRef.current.target === "reference" ? clamp(signal, -1.8, 1.8) : 0;
          const generatedDisturbance = excitationRef.current.target === "disturbance" ? clamp(signal, -22, 22) : 0;
          if (mode === "pid") angleIntegralRef.current = clamp(angleIntegralRef.current + current.theta * dt, -0.8, 0.8);
          const control = pendulumControlForce(current, mode, {
            reference,
            angleIntegral: angleIntegralRef.current,
            pid: pidRef.current,
            lqr: lqrRef.current,
          });
          const mouseDisturbance = now / 1000 < externalForceRef.current.until ? externalForceRef.current.value : 0;
          let next = stepCartPole(current, control + generatedDisturbance + mouseDisturbance, paramsRef.current, dt);
          if (Math.abs(next.x) > 2.35) next = { ...next, x: Math.sign(next.x) * 2.35, xVelocity: -next.xVelocity * 0.22 };
          stateRef.current = next;
          accumulator -= dt;
        }
        if (renderAccumulator >= 1 / 30) {
          const current = stateRef.current;
          const mode: PendulumController = enabledRef.current ? typeRef.current : "off";
          const signal = excitationValue(excitationRef.current, current.time - signalEpochRef.current);
          const reference = excitationRef.current.target === "reference" ? clamp(signal, -1.8, 1.8) : 0;
          const generatedDisturbance = excitationRef.current.target === "disturbance" ? clamp(signal, -22, 22) : 0;
          const control = pendulumControlForce(current, mode, { reference, angleIntegral: angleIntegralRef.current, pid: pidRef.current, lqr: lqrRef.current });
          setState({ ...current });
          setHistory((items) => [...items, { time: current.time, theta: current.theta, x: current.x, force: control, reference, disturbance: generatedDisturbance }].slice(-480));
          renderAccumulator = 0;
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  const latestPoint = history.at(-1);
  const currentReference = latestPoint?.reference ?? 0;
  const currentDisturbance = latestPoint?.disturbance ?? 0;
  const controlForce = latestPoint?.force ?? 0;
  const angleDegrees = (state.theta * 180) / Math.PI;
  const stable = Math.abs(angleDegrees) < 5 && Math.abs(state.thetaVelocity) < 0.4;

  const applyController = () => {
    if (controllerType === "pid") {
      setPidApplied(pidDraft);
      setControllerMessage("PID 参数已应用到执行器");
    } else if (lqrDesignMode === "weights") {
      const gains = designLqrGains(params, lqrDraft.q, lqrDraft.r);
      const next = { ...lqrDraft, gains };
      setLqrDraft(next);
      setLqrApplied(next);
      setControllerMessage("已根据当前模型与 Q/R 重新计算 K");
    } else {
      setLqrApplied(lqrDraft);
      setControllerMessage("手动状态反馈增益 K 已应用");
    }
    angleIntegralRef.current = 0;
  };

  const applyExcitation = () => {
    setExcitationApplied(excitationDraft);
    excitationRef.current = excitationDraft;
    signalEpochRef.current = stateRef.current.time;
    setInputMessage(`${signalName(excitationDraft.type)}已作用于${excitationDraft.target === "reference" ? "参考输入 r(t)" : "外部扰动 d(t)"}`);
  };

  const clearExcitation = () => {
    const next = { ...excitationDraft, type: "none" as const };
    setExcitationDraft(next);
    setExcitationApplied(next);
    excitationRef.current = next;
    setInputMessage("自动输入已清除，鼠标扰动仍可用");
  };

  const saveRun = () => setSavedRun({ label: controllerEnabled ? controllerType.toUpperCase() : "无控制", points: [...history] });

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    dragRef.current = { x: event.clientX };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    const delta = event.clientX - dragRef.current.x;
    dragRef.current.x = event.clientX;
    const force = clamp(delta * 2.2, -14, 14);
    externalForceRef.current = { value: force, until: performance.now() / 1000 + 0.1 };
    setDragForce(force);
  };
  const endDrag = () => { dragRef.current = null; setDragForce(0); };

  return <main className="controlab-app simulation-page">
    <AppHeader title="动力学仿真 / Cart–Pole" onHome={onHome} trailing={<><button className="simulation-shortcut" onClick={onWorkbench}>传函工作台</button><div className="compute-status"><i />240 Hz 动力学</div></>} />
    <div className="simulation-shell teaching-layout">
      <section className="simulation-main">
        <div className="simulation-heading">
          <div><span className="section-label">EXPERIMENT 01</span><h1>小车倒立摆</h1><p>非线性模型、控制器、参考输入和扰动共用同一条实时信号链。</p></div>
          <div className={`balance-status ${stable ? "stable" : "moving"}`}><i />{controllerEnabled ? stable ? "平衡中" : "控制修正" : "自由运动"}</div>
        </div>

        <PendulumScene state={state} params={params} dragForce={dragForce} reference={currentReference} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} />

        <div className="signal-strip" aria-label="实时信号链">
          <SignalValue label="参考 r" value={currentReference} unit="m" />
          <span className="signal-arrow">→</span><SignalValue label="控制 uᶜ" value={controlForce} unit="N" />
          <span className="signal-plus">+</span><SignalValue label="扰动 d" value={currentDisturbance + dragForce} unit="N" />
          <span className="signal-arrow">→</span><SignalValue label="输出 θ" value={angleDegrees} unit="°" />
        </div>

        <div className="simulation-toolbar">
          <button className="primary-action" onClick={() => setRunning((value) => !value)}>{running ? "暂停" : "继续"}</button>
          <button onClick={() => disturb(-7)}>← 左推</button><button onClick={() => disturb(7)}>右推 →</button>
          <button onClick={() => disturb((Math.random() > 0.5 ? 1 : -1) * (5 + Math.random() * 5), 0.2)}>随机扰动</button>
          <button onClick={reset}>位置重置</button><button onClick={saveRun}>保存本次曲线</button>
          {savedRun && <span className="saved-run">已保存 {savedRun.label} 基线</span>}
        </div>

        <div className="simulation-data">
          <LiveChart title="摆角 θ" unit="°" value={angleDegrees} points={history.map((point) => ({ x: point.time, y: (point.theta * 180) / Math.PI }))} baseline={savedRun?.points.map((point) => ({ x: point.time, y: (point.theta * 180) / Math.PI }))} />
          <LiveChart title="小车位置 x" unit="m" value={state.x} points={history.map((point) => ({ x: point.time, y: point.x }))} baseline={savedRun?.points.map((point) => ({ x: point.time, y: point.x }))} />
          <LiveChart title="控制力 uᶜ" unit="N" value={controlForce} points={history.map((point) => ({ x: point.time, y: point.force }))} baseline={savedRun?.points.map((point) => ({ x: point.time, y: point.force }))} />
        </div>
      </section>

      <aside className="simulation-sidebar teaching-sidebar">
        <div className="sim-tabs" role="tablist">
          <button className={sideTab === "controller" ? "active" : ""} onClick={() => setSideTab("controller")}>控制器</button>
          <button className={sideTab === "input" ? "active" : ""} onClick={() => setSideTab("input")}>输入</button>
          <button className={sideTab === "model" ? "active" : ""} onClick={() => setSideTab("model")}>模型</button>
          <button className={sideTab === "principle" ? "active" : ""} onClick={() => setSideTab("principle")}>原理</button>
        </div>

        {sideTab === "controller" && <ControllerEditor enabled={controllerEnabled} setEnabled={setControllerEnabled} type={controllerType} setType={setControllerType} pid={pidDraft} setPid={setPidDraft} lqr={lqrDraft} setLqr={setLqrDraft} designMode={lqrDesignMode} setDesignMode={setLqrDesignMode} message={controllerMessage} onApply={applyController} />}
        {sideTab === "input" && <ExcitationEditor draft={excitationDraft} setDraft={setExcitationDraft} message={inputMessage} onApply={applyExcitation} onClear={clearExcitation} />}
        {sideTab === "model" && <ModelInspector params={params} setParams={(next) => { setParams(next); setControllerMessage("模型已变化，建议重新应用 LQR"); }} initialAngle={initialAngle} setInitialAngle={setInitialAngle} model={linearModel} onReset={reset} />}
        {sideTab === "principle" && <PrinciplePanel controllerType={controllerType} />}
      </aside>
    </div>
  </main>;
}

function ControllerEditor({ enabled, setEnabled, type, setType, pid, setPid, lqr, setLqr, designMode, setDesignMode, message, onApply }: {
  enabled: boolean; setEnabled: (value: boolean) => void; type: "pid" | "lqr"; setType: (value: "pid" | "lqr") => void;
  pid: PidControllerConfig; setPid: (value: PidControllerConfig) => void; lqr: LqrControllerConfig; setLqr: (value: LqrControllerConfig) => void;
  designMode: "weights" | "gain"; setDesignMode: (value: "weights" | "gain") => void; message: string; onApply: () => void;
}) {
  return <section className="sim-editor">
    <div className="sim-card-head"><div><span className="section-label">FEEDBACK</span><h2>控制器设计</h2></div><label className={`feedback-toggle ${enabled ? "on" : ""}`}><input aria-label="倒立摆控制器" type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /><i /></label></div>
    <div className="sim-controller-switch"><button className={type === "pid" ? "active" : ""} onClick={() => setType("pid")}>PID</button><button className={type === "lqr" ? "active" : ""} onClick={() => setType("lqr")}>LQR</button></div>
    {type === "pid" ? <>
      <MathFormula className="controller-equation" latex="u=K_p\theta+K_i\int\theta\,dt+K_d\dot{\theta}+K_x(x-r)+K_v\dot{x}" display />
      <div className="sim-field-grid">
        {(["kp", "ki", "kd", "kx", "kv", "maxForce"] as const).map((key) => <NumberField key={key} label={{ kp: "Kp", ki: "Ki", kd: "Kd", kx: "Kx", kv: "Kv", maxForce: "限幅/N" }[key]} value={pid[key]} onChange={(value) => setPid({ ...pid, [key]: value })} />)}
      </div>
    </> : <>
      <div className="design-mode"><button className={designMode === "weights" ? "active" : ""} onClick={() => setDesignMode("weights")}>Q/R 设计</button><button className={designMode === "gain" ? "active" : ""} onClick={() => setDesignMode("gain")}>直接输入 K</button></div>
      <MathFormula className="controller-equation" latex="u=K_x(x-r)+K_{\dot{x}}\dot{x}+K_\theta\theta+K_{\dot{\theta}}\dot{\theta}" display />
      {designMode === "weights" ? <div className="sim-field-grid">
        {lqr.q.map((value, index) => <NumberField key={index} label={["Qx", "Qẋ", "Qθ", "Qθ̇"][index]} value={value} onChange={(next) => { const q = [...lqr.q] as LqrControllerConfig["q"]; q[index] = next; setLqr({ ...lqr, q }); }} />)}
        <NumberField label="R" value={lqr.r} onChange={(value) => setLqr({ ...lqr, r: value })} /><NumberField label="限幅/N" value={lqr.maxForce} onChange={(value) => setLqr({ ...lqr, maxForce: value })} />
      </div> : <div className="sim-field-grid">
        {lqr.gains.map((value, index) => <NumberField key={index} label={["Kx", "Kẋ", "Kθ", "Kθ̇"][index]} value={value} onChange={(next) => { const gains = [...lqr.gains] as LqrControllerConfig["gains"]; gains[index] = next; setLqr({ ...lqr, gains }); }} />)}
        <NumberField label="限幅/N" value={lqr.maxForce} onChange={(value) => setLqr({ ...lqr, maxForce: value })} />
      </div>}
      <div className="gain-readout">当前 K = [{lqr.gains.map((value) => formatNumber(value, 3)).join(", ")}]</div>
    </>}
    <button className="apply-controller" onClick={onApply}>应用到仿真</button><p className="apply-message">{message}</p>
  </section>;
}

function ExcitationEditor({ draft, setDraft, message, onApply, onClear }: { draft: ExcitationConfig; setDraft: (value: ExcitationConfig) => void; message: string; onApply: () => void; onClear: () => void }) {
  return <section className="sim-editor">
    <div className="sim-card-head"><div><span className="section-label">SIGNAL</span><h2>输入与扰动</h2></div></div>
    <label className="sim-select"><span>作用位置</span><select aria-label="信号作用位置" value={draft.target} onChange={(event) => setDraft({ ...draft, target: event.target.value as ExcitationConfig["target"] })}><option value="reference">参考输入 r(t)</option><option value="disturbance">外部扰动 d(t)</option></select></label>
    <div className="signal-types">{(["none", "step", "ramp", "sine", "pulse"] as const).map((type) => <button key={type} className={draft.type === type ? "active" : ""} onClick={() => setDraft({ ...draft, type })}>{signalName(type)}</button>)}</div>
    <div className="sim-field-grid input-fields">
      <NumberField label={draft.type === "ramp" ? "斜率" : "幅值"} value={draft.amplitude} onChange={(value) => setDraft({ ...draft, amplitude: value })} />
      <NumberField label="开始/s" value={draft.startTime} onChange={(value) => setDraft({ ...draft, startTime: value })} />
      {draft.type === "sine" && <NumberField label="频率/Hz" value={draft.frequency} onChange={(value) => setDraft({ ...draft, frequency: value })} />}
      {draft.type === "pulse" && <NumberField label="持续/s" value={draft.duration} onChange={(value) => setDraft({ ...draft, duration: value })} />}
    </div>
    <div className="input-explanation">{draft.target === "reference" ? "参考输入规定小车希望跟踪的位置；控制器负责在移动时维持摆杆直立。" : "扰动直接叠加在执行器力上，用于检验控制器的抗扰能力。"}</div>
    <div className="editor-actions"><button className="apply-controller" onClick={onApply}>施加信号</button><button onClick={onClear}>清除</button></div><p className="apply-message">{message}</p>
  </section>;
}

function ModelInspector({ params, setParams, initialAngle, setInitialAngle, model, onReset }: { params: CartPoleParams; setParams: (value: CartPoleParams) => void; initialAngle: number; setInitialAngle: (value: number) => void; model: ReturnType<typeof linearizeCartPole>; onReset: () => void }) {
  return <section className="sim-editor model-inspector">
    <div className="sim-card-head"><div><span className="section-label">PLANT</span><h2>被控对象模型</h2></div><span className="rank-badge">可控秩 {model.controllabilityRank}/4</span></div>
    <SimRange label="初始角度" value={initialAngle} min={1} max={16} step={1} unit="°" onChange={setInitialAngle} />
    <SimRange label="摆杆长度 l" value={params.poleLength} min={0.35} max={0.9} step={0.01} unit="m" onChange={(value) => setParams({ ...params, poleLength: value })} />
    <SimRange label="摆杆质量 m" value={params.poleMass} min={0.08} max={0.4} step={0.01} unit="kg" onChange={(value) => setParams({ ...params, poleMass: value })} />
    <SimRange label="小车质量 M" value={params.cartMass} min={0.6} max={2} step={0.05} unit="kg" onChange={(value) => setParams({ ...params, cartMass: value })} />
    <SimRange label="小车阻尼 b" value={params.cartFriction} min={0} max={0.35} step={0.01} unit="N·s/m" onChange={(value) => setParams({ ...params, cartFriction: value })} />
    <button className="apply-reset" onClick={onReset}>应用初始条件并重置</button>
    <ModelFormula label="小车位置 X(s)/U(s)" numerator={model.positionTransfer.numerator} denominator={model.positionTransfer.denominator} />
    <ModelFormula label="摆杆角度 Θ(s)/U(s)" numerator={model.angleTransfer.numerator} denominator={model.angleTransfer.denominator} />
    <div className="matrix-block"><span>线性化 A</span><Matrix value={model.A} /></div><div className="matrix-block"><span>输入矩阵 B</span><Matrix value={model.B.map((value) => [value])} /></div>
    <p className="model-note">传函与矩阵在直立平衡点 θ=0 附近线性化；中央动画始终使用完整非线性方程。</p>
  </section>;
}

function PrinciplePanel({ controllerType }: { controllerType: "pid" | "lqr" }) {
  return <section className="sim-editor principle-panel">
    <div className="sim-card-head"><div><span className="section-label">HOW IT WORKS</span><h2>结构与建模</h2></div></div>
    <div className="feedback-diagram" aria-label="倒立摆闭环结构图"><span>r(t)</span><i>→</i><b>{controllerType.toUpperCase()}</b><i>→</i><b>小车倒立摆</b><i>→</i><span>x, θ</span><em>状态反馈 ↩</em><small>扰动 d(t) 在执行器入口叠加</small></div>
    <div className="equation-list">
      <MathFormula latex="(M+m)\ddot{x}+b\dot{x}+ml(\ddot{\theta}\cos\theta-\dot{\theta}^{2}\sin\theta)=u+d" display />
      <MathFormula latex="(I+ml^{2})\ddot{\theta}-mgl\sin\theta=-ml\ddot{x}\cos\theta" display />
    </div>
    <p>本实验把摆杆视作均匀细杆，取 <MathFormula latex="I=ml^2/3" />；这里的 <MathFormula latex="l" /> 是转轴到质心的距离。</p>
    <p>状态取 <MathFormula latex="[x,\dot{x},\theta,\dot{\theta}]" />。直立点本身不稳定：没有反馈时，任意微小角度都会被重力放大。</p>
    <p>PID 直接组合摆角误差、积分和变化率；LQR 同时权衡四个状态与控制能量，并由 <MathFormula latex="Q/R" /> 决定取舍。</p>
    <p>参数变化先改变非线性方程，再改变线性化矩阵、传函以及合适的控制器增益。</p>
  </section>;
}

function PendulumScene({ state, params, dragForce, reference, onPointerDown, onPointerMove, onPointerUp }: { state: CartPoleState; params: CartPoleParams; dragForce: number; reference: number; onPointerDown: (event: React.PointerEvent<SVGSVGElement>) => void; onPointerMove: (event: React.PointerEvent<SVGSVGElement>) => void; onPointerUp: () => void }) {
  const cartX = 500 + state.x * 145;
  const targetX = 500 + reference * 145;
  const polePixels = 190 * (params.poleLength / DEFAULT_CART_POLE_PARAMS.poleLength);
  const poleEndX = cartX + Math.sin(state.theta) * polePixels;
  const poleEndY = 296 - Math.cos(state.theta) * polePixels;
  const angleDegrees = (state.theta * 180) / Math.PI;
  return <div className="pendulum-stage"><svg viewBox="0 0 1000 480" role="img" aria-label={`倒立摆，摆角 ${angleDegrees.toFixed(2)} 度，小车位置 ${state.x.toFixed(2)} 米，参考位置 ${reference.toFixed(2)} 米`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
    <defs><linearGradient id="stage-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#101720" /><stop offset="1" stopColor="#080c11" /></linearGradient><linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8794a1" /><stop offset="0.45" stopColor="#343f4b" /><stop offset="1" stopColor="#141b23" /></linearGradient><linearGradient id="cart" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c9d3dc" /><stop offset="0.18" stopColor="#64717e" /><stop offset="1" stopColor="#222b35" /></linearGradient><filter id="soft-shadow"><feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#000" floodOpacity=".45" /></filter></defs>
    <rect width="1000" height="480" rx="18" fill="url(#stage-bg)" /><g className="cad-grid" opacity=".45">{Array.from({ length: 14 }, (_, index) => <line key={`v${index}`} x1={60 + index * 68} x2={60 + index * 68} y1="332" y2="448" />)}{Array.from({ length: 5 }, (_, index) => <line key={`h${index}`} x1="42" x2="958" y1={348 + index * 24} y2={348 + index * 24} />)}</g>
    <ellipse cx="500" cy="399" rx="420" ry="38" fill="#020406" opacity=".6" /><rect x="74" y="348" width="852" height="18" rx="7" fill="url(#metal)" filter="url(#soft-shadow)" /><rect x="94" y="366" width="812" height="13" rx="4" fill="#111821" stroke="#35414d" />
    {Math.abs(reference) > 1e-5 && <g className="target-marker" transform={`translate(${targetX},0)`}><line x1="0" x2="0" y1="330" y2="386" /><text x="0" y="410" textAnchor="middle">r(t)</text></g>}
    <g transform={`translate(${cartX - 500},0)`} filter="url(#soft-shadow)"><circle cx="442" cy="357" r="23" fill="#0b0f14" stroke="#64717e" strokeWidth="7" /><circle cx="558" cy="357" r="23" fill="#0b0f14" stroke="#64717e" strokeWidth="7" /><path d="M405 296 L595 296 L614 343 L386 343 Z" fill="url(#cart)" stroke="#8b98a5" strokeWidth="2" /><path d="M418 306 H582" stroke="#d7e0e7" strokeWidth="3" opacity=".45" /><rect x="458" y="272" width="84" height="39" rx="8" fill="#27323d" stroke="#8996a3" /><circle cx="500" cy="296" r="18" fill="#10161d" stroke="#b7ff4a" strokeWidth="4" /></g>
    <g><line x1={cartX} y1="296" x2={poleEndX} y2={poleEndY} stroke="#0a0d11" strokeWidth="24" strokeLinecap="round" opacity=".55" /><line x1={cartX} y1="296" x2={poleEndX} y2={poleEndY} stroke="url(#metal)" strokeWidth="17" strokeLinecap="round" /><line x1={cartX - 2} y1="292" x2={poleEndX - 2} y2={poleEndY} stroke="#cbd5dd" strokeWidth="3" strokeLinecap="round" opacity=".5" /><circle cx={poleEndX} cy={poleEndY} r="25" fill="#202a34" stroke="#8d9aa7" strokeWidth="5" /><circle cx={poleEndX} cy={poleEndY} r="8" fill="#b7ff4a" /><circle cx={cartX} cy="296" r="13" fill="#0b1015" stroke="#d1dae2" strokeWidth="4" /></g>
    {dragForce !== 0 && <g className="force-arrow" transform={`translate(${cartX},255)`}><line x1="0" y1="0" x2={dragForce * 5} y2="0" /><path d={dragForce > 0 ? `M ${dragForce * 5} 0 l -16 -9 v 18 z` : `M ${dragForce * 5} 0 l 16 -9 v 18 z`} /><text x={dragForce * 2.5} y="-15" textAnchor="middle">鼠标扰动 d</text></g>}<text x="66" y="55" className="stage-label">DRAG TO DISTURB</text><text x="66" y="79" className="stage-hint">按住并水平拖动场景</text>
  </svg></div>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const adjust = (direction: -1 | 1) => onChange(Math.round((value + direction * 0.05) * 1000) / 1000);
  return <div className="number-field">
    <span>{label}</span>
    <div className="number-input-shell">
      <input aria-label={label} type="number" step="0.05" value={value} onChange={(event) => { const next = Number(event.target.value); if (Number.isFinite(next)) onChange(next); }} />
      <div className="number-stepper">
        <button type="button" aria-label={`减小 ${label}`} onClick={() => adjust(-1)}>−</button>
        <button type="button" aria-label={`增大 ${label}`} onClick={() => adjust(1)}>+</button>
      </div>
    </div>
  </div>;
}
function SignalValue({ label, value, unit }: { label: string; value: number; unit: string }) { return <div><span>{label}</span><strong>{formatNumber(value, 2)} <small>{unit}</small></strong></div>; }
function ModelFormula({ label, numerator, denominator }: { label: string; numerator: number[]; denominator: number[] }) { return <div className="model-formula"><span>{label}</span><MathFormula latex={transferToLatex(numerator, denominator)} display /></div>; }
function Matrix({ value }: { value: number[][] }) { return <div className="matrix">{value.map((row, index) => <code key={index}>[{row.map((item) => formatNumber(item, 3).padStart(7, " ")).join("  ")}]</code>)}</div>; }
function SimRange({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (value: number) => void }) { return <label className="sim-range"><span>{label}<b>{value.toFixed(step < 0.1 ? 2 : 0)} {unit}</b></span><input type="range" min={min} max={max} step={step} value={value} onInput={(event) => onChange(Number(event.currentTarget.value))} /></label>; }

function LiveChart({ title, value, unit, points, baseline }: { title: string; value: number; unit: string; points: Array<{ x: number; y: number }>; baseline?: Array<{ x: number; y: number }> }) {
  const paths = useMemo(() => {
    const all = [...points, ...(baseline ?? [])];
    if (all.length < 2) return { current: "", baseline: "" };
    const ys = all.map((point) => point.y); const minimum = Math.min(...ys, 0); const maximum = Math.max(...ys, 0); const span = Math.max(1e-6, maximum - minimum);
    const make = (values: Array<{ x: number; y: number }>) => values.length < 2 ? "" : values.map((point, index) => `${index ? "L" : "M"}${(index / (values.length - 1)) * 300},${78 - ((point.y - minimum) / span) * 66}`).join(" ");
    return { current: make(points), baseline: make(baseline ?? []) };
  }, [baseline, points]);
  return <div className="live-chart"><div><span>{title}</span><strong>{value.toFixed(2)} <small>{unit}</small></strong></div><svg viewBox="0 0 300 90" preserveAspectRatio="none" role="img" aria-label={`${title} 当前 ${value.toFixed(2)} ${unit}`}><line x1="0" x2="300" y1="78" y2="78" />{paths.baseline && <path className="baseline-path" d={paths.baseline} />}<path d={paths.current} /></svg></div>;
}

function signalName(type: ExcitationConfig["type"]) { return ({ none: "无", step: "阶跃", ramp: "斜坡", sine: "正弦", pulse: "脉冲" } as const)[type]; }
function clamp(value: number, minimum: number, maximum: number) { return Math.min(maximum, Math.max(minimum, value)); }
