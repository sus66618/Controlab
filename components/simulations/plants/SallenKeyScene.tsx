import { sallenKeyMetrics, sallenKeyOutputs } from "@/lib/simulation/plants/sallenKey";
import type { SallenKeyParams } from "@/lib/simulation/plants/sallenKey";

export function SallenKeyScene({ params, state }: { params: SallenKeyParams; state: number[] }) {
  const metrics = sallenKeyMetrics(params);
  const output = sallenKeyOutputs(params, state);
  const saturationRatio = params.saturationEnabled ? Math.min(1, Math.abs(output.ideal) / params.saturation) : 0;
  return <div className="circuit-scene active-circuit-scene"><svg viewBox="0 0 900 380" role="img" aria-label="Sallen-Key 二阶有源低通滤波器">
    <defs><filter id="active-circuit-glow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
    <text className="circuit-mode-label" x="65" y="52">SALLEN–KEY · SECOND-ORDER LOW-PASS</text>
    <path className="circuit-wire" d="M75 175H155M245 175H330M420 175H515M630 175H805" />
    <Resistor x={200} y={175} label={`R₁ ${(params.R1 / 1000).toPrecision(3)} kΩ`} />
    <Resistor x={375} y={175} label={`R₂ ${(params.R2 / 1000).toPrecision(3)} kΩ`} />
    <path className="circuit-wire" d="M330 175V280M515 175V280M330 280H515" />
    <Capacitor x={375} y={280} label={`C₁ ${(params.C1 * 1e6).toPrecision(3)} μF`} />
    <path className="circuit-wire" d="M515 175V80H700V143" />
    <Capacitor x={600} y={80} label={`C₂ ${(params.C2 * 1e6).toPrecision(3)} μF`} />
    <g className="opamp"><path d="M515 130L515 250L630 190Z" /><text x="537" y="170">+</text><text x="537" y="225">−</text><text x="558" y="198">A</text><path className="circuit-wire" d="M515 225H475V305H690V190" /></g>
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
