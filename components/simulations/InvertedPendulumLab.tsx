"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/control-lab/AppHeader";
import {
  DEFAULT_CART_POLE_PARAMS,
  initialCartPoleState,
  pendulumControlForce,
  stepCartPole,
} from "@/lib/simulation/cartPole";
import type { CartPoleParams, CartPoleState, PendulumController } from "@/lib/simulation/cartPole";

type HistoryPoint = { time: number; theta: number; x: number; force: number };

export function InvertedPendulumLab({ onHome, onWorkbench }: { onHome: () => void; onWorkbench: () => void }) {
  const [state, setState] = useState<CartPoleState>(() => initialCartPoleState());
  const [params, setParams] = useState<CartPoleParams>(DEFAULT_CART_POLE_PARAMS);
  const [controllerEnabled, setControllerEnabled] = useState(true);
  const [controllerType, setControllerType] = useState<Exclude<PendulumController, "off">>("lqr");
  const [running, setRunning] = useState(true);
  const [initialAngle, setInitialAngle] = useState(7);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [dragForce, setDragForce] = useState(0);
  const stateRef = useRef(state);
  const paramsRef = useRef(params);
  const enabledRef = useRef(controllerEnabled);
  const typeRef = useRef(controllerType);
  const runningRef = useRef(running);
  const externalForceRef = useRef({ value: 0, until: 0 });
  const dragRef = useRef<{ x: number } | null>(null);

  useEffect(() => { paramsRef.current = params; }, [params]);
  useEffect(() => { enabledRef.current = controllerEnabled; }, [controllerEnabled]);
  useEffect(() => { typeRef.current = controllerType; }, [controllerType]);
  useEffect(() => { runningRef.current = running; }, [running]);

  const reset = useCallback(() => {
    const next = initialCartPoleState(initialAngle);
    stateRef.current = next;
    externalForceRef.current = { value: 0, until: 0 };
    setDragForce(0);
    setHistory([]);
    setState(next);
  }, [initialAngle]);

  const disturb = useCallback((force: number, duration = 0.28) => {
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
          const control = pendulumControlForce(current, mode);
          const external = now / 1000 < externalForceRef.current.until ? externalForceRef.current.value : 0;
          let next = stepCartPole(current, control + external, paramsRef.current, dt);
          // 有限导轨提供机械限位，碰撞时损失部分速度。
          if (Math.abs(next.x) > 2.35) next = { ...next, x: Math.sign(next.x) * 2.35, xVelocity: -next.xVelocity * 0.22 };
          stateRef.current = next;
          accumulator -= dt;
        }
        if (renderAccumulator >= 1 / 30) {
          const current = stateRef.current;
          const mode: PendulumController = enabledRef.current ? typeRef.current : "off";
          const control = pendulumControlForce(current, mode);
          setState({ ...current });
          setHistory((items) => [...items, { time: current.time, theta: current.theta, x: current.x, force: control }].slice(-360));
          renderAccumulator = 0;
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  const angleDegrees = (state.theta * 180) / Math.PI;
  const activeMode: PendulumController = controllerEnabled ? controllerType : "off";
  const controlForce = pendulumControlForce(state, activeMode);
  const cartX = 500 + state.x * 145;
  const polePixels = 190 * (params.poleLength / DEFAULT_CART_POLE_PARAMS.poleLength);
  const poleEndX = cartX + Math.sin(state.theta) * polePixels;
  const poleEndY = 296 - Math.cos(state.theta) * polePixels;
  const stable = Math.abs(angleDegrees) < 5 && Math.abs(state.thetaVelocity) < 0.4;

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    dragRef.current = { x: event.clientX };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    const delta = event.clientX - dragRef.current.x;
    dragRef.current.x = event.clientX;
    const force = Math.max(-14, Math.min(14, delta * 2.2));
    externalForceRef.current = { value: force, until: performance.now() / 1000 + 0.1 };
    setDragForce(force);
  };
  const endDrag = () => { dragRef.current = null; setDragForce(0); };

  return <main className="controlab-app simulation-page">
    <AppHeader title="动力学仿真 / Cart–Pole" onHome={onHome} trailing={<>
      <button className="simulation-shortcut" onClick={onWorkbench}>传函工作台</button>
      <div className="compute-status"><i />240 Hz 动力学</div>
    </>} />
    <div className="simulation-shell">
      <section className="simulation-main">
        <div className="simulation-heading">
          <div><span className="section-label">EXPERIMENT 01</span><h1>小车倒立摆</h1><p>拖动装置施加水平扰动；动画与数据来自同一组非线性方程。</p></div>
          <div className={`balance-status ${stable ? "stable" : "moving"}`}><i />{controllerEnabled ? stable ? "平衡中" : "控制修正" : "自由运动"}</div>
        </div>

        <div className="pendulum-stage">
          <svg viewBox="0 0 1000 480" role="img" aria-label={`倒立摆，摆角 ${angleDegrees.toFixed(2)} 度，小车位置 ${state.x.toFixed(2)} 米`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
            <defs>
              <linearGradient id="stage-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#101720" /><stop offset="1" stopColor="#080c11" /></linearGradient>
              <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8794a1" /><stop offset="0.45" stopColor="#343f4b" /><stop offset="1" stopColor="#141b23" /></linearGradient>
              <linearGradient id="cart" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c9d3dc" /><stop offset="0.18" stopColor="#64717e" /><stop offset="1" stopColor="#222b35" /></linearGradient>
              <filter id="soft-shadow"><feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#000" floodOpacity=".45" /></filter>
            </defs>
            <rect width="1000" height="480" rx="18" fill="url(#stage-bg)" />
            <g className="cad-grid" opacity=".45">
              {Array.from({ length: 14 }, (_, index) => <line key={`v${index}`} x1={60 + index * 68} x2={60 + index * 68} y1="332" y2="448" />)}
              {Array.from({ length: 5 }, (_, index) => <line key={`h${index}`} x1="42" x2="958" y1={348 + index * 24} y2={348 + index * 24} />)}
            </g>
            <ellipse cx="500" cy="399" rx="420" ry="38" fill="#020406" opacity=".6" />
            <rect x="74" y="348" width="852" height="18" rx="7" fill="url(#metal)" filter="url(#soft-shadow)" />
            <rect x="94" y="366" width="812" height="13" rx="4" fill="#111821" stroke="#35414d" />
            <g transform={`translate(${cartX - 500},0)`} filter="url(#soft-shadow)">
              <circle cx="442" cy="357" r="23" fill="#0b0f14" stroke="#64717e" strokeWidth="7" /><circle cx="558" cy="357" r="23" fill="#0b0f14" stroke="#64717e" strokeWidth="7" />
              <path d="M405 296 L595 296 L614 343 L386 343 Z" fill="url(#cart)" stroke="#8b98a5" strokeWidth="2" />
              <path d="M418 306 H582" stroke="#d7e0e7" strokeWidth="3" opacity=".45" />
              <rect x="458" y="272" width="84" height="39" rx="8" fill="#27323d" stroke="#8996a3" />
              <circle cx="500" cy="296" r="18" fill="#10161d" stroke="#b7ff4a" strokeWidth="4" />
            </g>
            <g className="pendulum-assembly">
              <line x1={cartX} y1="296" x2={poleEndX} y2={poleEndY} stroke="#0a0d11" strokeWidth="24" strokeLinecap="round" opacity=".55" />
              <line x1={cartX} y1="296" x2={poleEndX} y2={poleEndY} stroke="url(#metal)" strokeWidth="17" strokeLinecap="round" />
              <line x1={cartX - 2} y1="292" x2={poleEndX - 2} y2={poleEndY} stroke="#cbd5dd" strokeWidth="3" strokeLinecap="round" opacity=".5" />
              <circle cx={poleEndX} cy={poleEndY} r="25" fill="#202a34" stroke="#8d9aa7" strokeWidth="5" />
              <circle cx={poleEndX} cy={poleEndY} r="8" fill="#b7ff4a" />
              <circle cx={cartX} cy="296" r="13" fill="#0b1015" stroke="#d1dae2" strokeWidth="4" />
            </g>
            {(dragForce !== 0) && <g className="force-arrow" transform={`translate(${cartX},255)`}>
              <line x1="0" y1="0" x2={dragForce * 5} y2="0" />
              <path d={dragForce > 0 ? `M ${dragForce * 5} 0 l -16 -9 v 18 z` : `M ${dragForce * 5} 0 l 16 -9 v 18 z`} />
              <text x={dragForce * 2.5} y="-15" textAnchor="middle">扰动力</text>
            </g>}
            <text x="66" y="55" className="stage-label">DRAG TO DISTURB</text>
            <text x="66" y="79" className="stage-hint">按住并水平拖动场景</text>
          </svg>
        </div>

        <div className="simulation-toolbar">
          <button className="primary-action" onClick={() => setRunning((value) => !value)}>{running ? "暂停" : "继续"}</button>
          <button onClick={() => disturb(-7, 0.16)}>← 左推</button><button onClick={() => disturb(7, 0.16)}>右推 →</button>
          <button onClick={() => disturb((Math.random() > 0.5 ? 1 : -1) * (5 + Math.random() * 5), 0.2)}>随机扰动</button>
          <button onClick={reset}>位置重置</button>
        </div>

        <div className="simulation-data">
          <LiveChart title="摆角 θ" unit="°" value={angleDegrees} points={history.map((point) => ({ x: point.time, y: (point.theta * 180) / Math.PI }))} />
          <LiveChart title="小车位置 x" unit="m" value={state.x} points={history.map((point) => ({ x: point.time, y: point.x }))} />
          <LiveChart title="控制力 u" unit="N" value={controlForce} points={history.map((point) => ({ x: point.time, y: point.force }))} />
        </div>
      </section>

      <aside className="simulation-sidebar">
        <section className="sim-control-card">
          <div className="sim-card-head"><div><span className="section-label">FEEDBACK</span><h2>控制器</h2></div><label className={`feedback-toggle ${controllerEnabled ? "on" : ""}`}><input aria-label="倒立摆控制器" type="checkbox" checked={controllerEnabled} onChange={(event) => setControllerEnabled(event.target.checked)} /><i /></label></div>
          <div className="sim-controller-switch"><button className={controllerType === "pid" ? "active" : ""} onClick={() => setControllerType("pid")}>PID</button><button className={controllerType === "lqr" ? "active" : ""} onClick={() => setControllerType("lqr")}>LQR</button></div>
          <p>{controllerEnabled ? controllerType === "lqr" ? "状态反馈同时使用位置、速度、摆角和角速度。" : "角度 PID 配合弱位置回正，便于观察调参逻辑。" : "执行器不施加控制力，摆杆只受动力学和外部扰动影响。"}</p>
        </section>
        <section className="sim-control-card">
          <div className="sim-card-head"><div><span className="section-label">PHYSICS</span><h2>模型参数</h2></div><small>实时生效</small></div>
          <SimRange label="初始角度" value={initialAngle} min={1} max={16} step={1} unit="°" onChange={setInitialAngle} />
          <SimRange label="摆杆长度" value={params.poleLength} min={0.35} max={0.9} step={0.01} unit="m" onChange={(value) => setParams({ ...params, poleLength: value })} />
          <SimRange label="摆杆质量" value={params.poleMass} min={0.08} max={0.4} step={0.01} unit="kg" onChange={(value) => setParams({ ...params, poleMass: value })} />
          <SimRange label="小车质量" value={params.cartMass} min={0.6} max={2} step={0.05} unit="kg" onChange={(value) => setParams({ ...params, cartMass: value })} />
          <button className="apply-reset" onClick={reset}>应用初始条件并重置</button>
        </section>
        <section className="sim-knowledge">
          <span>当前观察</span>
          <p>{controllerEnabled ? Math.abs(angleDegrees) < 8 ? "控制器正在通过移动小车，把摆杆质心重新送回支点上方。" : "摆角较大，线性控制器逐渐离开有效工作区；可重置后从小角度比较。" : "没有反馈时，即使初始角度很小，直立平衡点也会因重力迅速失稳。"}</p>
        </section>
      </aside>
    </div>
  </main>;
}

function SimRange({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (value: number) => void;
}) {
  return <label className="sim-range"><span>{label}<b>{value.toFixed(step < 0.1 ? 2 : 0)} {unit}</b></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function LiveChart({ title, value, unit, points }: { title: string; value: number; unit: string; points: Array<{ x: number; y: number }> }) {
  const path = useMemo(() => {
    if (points.length < 2) return "";
    const ys = points.map((point) => point.y);
    const min = Math.min(...ys, 0);
    const max = Math.max(...ys, 0);
    const span = Math.max(1e-6, max - min);
    return points.map((point, index) => `${index ? "L" : "M"}${(index / (points.length - 1)) * 300},${78 - ((point.y - min) / span) * 66}`).join(" ");
  }, [points]);
  return <div className="live-chart"><div><span>{title}</span><strong>{value.toFixed(2)} <small>{unit}</small></strong></div><svg viewBox="0 0 300 90" preserveAspectRatio="none" role="img" aria-label={`${title} 当前 ${value.toFixed(2)} ${unit}`}><line x1="0" x2="300" y1="78" y2="78" /><path d={path} /></svg></div>;
}
