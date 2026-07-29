import { MFB_LOW_PASS_TOPOLOGY } from "@/lib/simulation/scenes/geometry";
import { mfbLowPassMetrics, mfbLowPassOutputs } from "@/lib/simulation/plants/mfbLowPass";
import type { MfbLowPassParams } from "@/lib/simulation/plants/mfbLowPass";

export function MfbLowPassScene({ params, state }: { params: MfbLowPassParams; state: number[] }) {
  const metrics = mfbLowPassMetrics(params);
  const output = mfbLowPassOutputs(params, state);
  const topology = MFB_LOW_PASS_TOPOLOGY;
  return <div className="circuit-scene active-circuit-scene"><svg viewBox="0 0 900 380" role="img" aria-label="反相 MFB 二阶有源低通滤波器">
    <text className="circuit-mode-label" x="65" y="42">INVERTING MFB · SECOND-ORDER LOW-PASS</text>

    <path className="circuit-wire" d="M65 160H120M210 160H345M435 160H540" />
    <Resistor x={165} y={160} label={`R₁ ${(params.R1 / 1000).toPrecision(3)} kΩ`} />
    <Resistor x={390} y={160} label={`R₂ ${(params.R2 / 1000).toPrecision(3)} kΩ`} />
    <circle className="circuit-node" cx={topology.node1.x} cy={topology.node1.y} r="4" />

    <path className="circuit-wire" d={`M${topology.node1.x} ${topology.node1.y}V62H420M510 62H730V${topology.output.y}H${topology.output.x}`} />
    <Resistor x={465} y={62} label={`R₃ ${(params.R3 / 1000).toPrecision(3)} kΩ`} />

    <path className="circuit-wire" d={`M${topology.opAmp.minus.x} ${topology.opAmp.minus.y}V102H560M650 102H705V${topology.output.y}H${topology.output.x}`} />
    <Capacitor x={605} y={102} label={`C₂ ${(params.C2 * 1e6).toPrecision(3)} μF`} />

    <path className="circuit-wire" d={`M${topology.node1.x} ${topology.node1.y}V200M${topology.node1.x} 250V270`} />
    <VerticalCapacitor x={topology.node1.x} y={225} label={`C₁ ${(params.C1 * 1e6).toPrecision(3)} μF`} />
    <Ground x={topology.node1.x} y={300} />

    <g className="opamp"><path d="M540 115L540 245L680 180Z" /><text x="555" y="164">−</text><text x="555" y="226">+</text><text x="592" y="185">A</text></g>
    <path className="circuit-wire" d="M520 220H540M520 220V270" />
    <Ground x={520} y={300} />
    <path className="circuit-wire" d={`M${topology.output.x} ${topology.output.y}H805`} />
    <circle className="circuit-node" cx={topology.output.x} cy={topology.output.y} r="4" />

    <g className="circuit-readouts"><text x="65" y="335">fₙ = {metrics.frequency.toFixed(2)} Hz</text><text x="285" y="335">Q = {metrics.q.toFixed(3)}</text><text x="485" y="335">K₀ = {metrics.dcGain.toFixed(3)}</text><text x="680" y="335">y = {output.actual.toFixed(3)} V</text></g>
  </svg></div>;
}

function Resistor({ x, y, label }: { x: number; y: number; label: string }) {
  return <g className="circuit-element" transform={`translate(${x} ${y})`}><path d="M-45 0l10-14 16 28 16-28 16 28 16-28 16 14" /><text x="0" y="-25">{label}</text></g>;
}

function Capacitor({ x, y, label }: { x: number; y: number; label: string }) {
  return <g className="circuit-element" transform={`translate(${x} ${y})`}><path d="M-45 0H-7M7 0H45M-7-22V22M7-22V22" /><text x="0" y="-27">{label}</text></g>;
}

function VerticalCapacitor({ x, y, label }: { x: number; y: number; label: string }) {
  return <g className="circuit-element" transform={`translate(${x} ${y}) rotate(90)`}><path d="M-25 0H-7M7 0H25M-7-22V22M7-22V22" /><text transform="rotate(-90)" x="0" y="-30">{label}</text></g>;
}

function Ground({ x, y }: { x: number; y: number }) {
  return <g className="circuit-ground"><path d={`M${x} ${y - 30}V${y - 12}M${x - 18} ${y - 12}H${x + 18}M${x - 12} ${y - 6}H${x + 12}M${x - 6} ${y}H${x + 6}`} /></g>;
}
