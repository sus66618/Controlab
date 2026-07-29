import { SALLEN_KEY_TOPOLOGY } from "@/lib/simulation/scenes/geometry";
import { sallenKeyMetrics, sallenKeyOutputs } from "@/lib/simulation/plants/sallenKey";
import type { SallenKeyParams } from "@/lib/simulation/plants/sallenKey";

export function SallenKeyScene({ params, state }: { params: SallenKeyParams; state: number[] }) {
  const metrics = sallenKeyMetrics(params);
  const output = sallenKeyOutputs(params, state);
  const saturationRatio = params.saturationEnabled ? Math.min(1, Math.abs(output.ideal) / params.saturation) : 0;
  const topology = SALLEN_KEY_TOPOLOGY;
  return <div className="circuit-scene active-circuit-scene"><svg viewBox="0 0 900 380" role="img" aria-label="Sallen-Key 二阶有源低通滤波器">
    <defs><filter id="active-circuit-glow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
    <text className="circuit-mode-label" x="65" y="52">SALLEN–KEY · SECOND-ORDER LOW-PASS</text>
    <path className="circuit-wire" d="M65 160H125M215 160H330M420 160H520" />
    <Resistor x={170} y={160} label={`R₁ ${(params.R1 / 1000).toPrecision(3)} kΩ`} />
    <Resistor x={375} y={160} label={`R₂ ${(params.R2 / 1000).toPrecision(3)} kΩ`} />
    <circle className="circuit-node" cx={topology.node1.x} cy={topology.node1.y} r="4" />
    <circle className="circuit-node" cx={topology.node2.x} cy={topology.node2.y} r="4" />
    <path className="circuit-wire" d={`M${topology.node1.x} ${topology.node1.y}V75H455M545 75H615`} />
    <Capacitor x={500} y={75} label={`C₁ ${(params.C1 * 1e6).toPrecision(3)} μF`} />
    <path className="circuit-wire" d={`M615 75H700V${topology.output.y}H${topology.output.x}`} />
    <path className="circuit-wire" d={`M${topology.node2.x} ${topology.node2.y}V220`} />
    <VerticalCapacitor x={topology.node2.x} y={245} label={`C₂ ${(params.C2 * 1e6).toPrecision(3)} μF`} />
    <Ground x={topology.node2.x} y={topology.groundY} />
    <g className="opamp"><path d="M520 115L520 245L660 180Z" /><text x="542" y="164">+</text><text x="542" y="226">−</text><text x="575" y="185">K</text></g>
    <path className="circuit-wire" d={`M${topology.feedback.start.x} ${topology.feedback.start.y}H490V285H700V${topology.output.y}H${topology.output.x}`} />
    <path className="circuit-wire" d={`M${topology.output.x} ${topology.output.y}H805`} />
    <circle className="circuit-node" cx={topology.output.x} cy={topology.output.y} r="4" />
    <g className="circuit-readouts"><text x="65" y="330">fₙ = {metrics.frequency.toFixed(2)} Hz</text><text x="300" y="330">Q = {metrics.q.toFixed(3)}</text><text x="500" y="330">K = {params.gain.toFixed(3)}</text><text x="665" y="330">y = {output.actual.toFixed(3)} V</text></g>
    {params.saturationEnabled && <g className={`saturation-meter ${saturationRatio > 0.98 ? "clipping" : ""}`}><rect x="705" y="270" width="100" height="8" rx="4" /><rect x="705" y="270" width={100 * saturationRatio} height="8" rx="4" /><text x="705" y="300">SATURATION</text></g>}
  </svg></div>;
}

function Resistor({ x, y, label }: { x: number; y: number; label: string }) {
  return <g className="circuit-element" transform={`translate(${x} ${y})`}><path d="M-45 0l10-14 16 28 16-28 16 28 16-28 16 14" /><text x="0" y="-28">{label}</text></g>;
}

function Capacitor({ x, y, label }: { x: number; y: number; label: string }) {
  return <g className="circuit-element" transform={`translate(${x} ${y})`}><path d="M-45 0H-7M7 0H45M-7-22V22M7-22V22" /><text x="0" y="-28">{label}</text></g>;
}

function VerticalCapacitor({ x, y, label }: { x: number; y: number; label: string }) {
  return <g className="circuit-element" transform={`translate(${x} ${y}) rotate(90)`}><path d="M-25 0H-7M7 0H25M-7-22V22M7-22V22" /><text transform="rotate(-90)" x="0" y="-31">{label}</text></g>;
}

function Ground({ x, y }: { x: number; y: number }) {
  return <g className="circuit-ground"><path d={`M${x} ${y - 30}V${y - 12}M${x - 18} ${y - 12}H${x + 18}M${x - 12} ${y - 6}H${x + 12}M${x - 6} ${y}H${x + 6}`} /></g>;
}
