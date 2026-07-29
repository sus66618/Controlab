import type { PassiveRlcModel } from "@/lib/simulation/plants/passiveRlc";

export function PassiveRlcScene({ model, state, source }: { model: PassiveRlcModel; state: number[]; source: number }) {
  const isSeries = model.config.topology === "series";
  const current = isSeries ? state[0] : source;
  const voltage = isSeries ? state[1] : state[0];
  const elements = [...model.config.resistors.filter((item) => item.enabled).map((item) => ({ ...item, type: "R" })), ...model.config.inductors.filter((item) => item.enabled).map((item) => ({ ...item, type: "L" })), ...model.config.capacitors.filter((item) => item.enabled).map((item) => ({ ...item, type: "C" }))];
  return <div className="circuit-scene passive-circuit-scene"><svg viewBox="0 0 900 380" role="img" aria-label={`${isSeries ? "串联" : "并联"} RLC 电路`}>
    <defs><filter id="circuit-glow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
    <text className="circuit-mode-label" x="70" y="55">{isSeries ? "SERIES · VOLTAGE DRIVE" : "PARALLEL · CURRENT DRIVE"}</text>
    {isSeries ? <SeriesCircuit elements={elements} source={source} current={current} /> : <ParallelCircuit elements={elements} source={source} voltage={voltage} />}
    <g className="circuit-readouts"><text x="650" y="314">{isSeries ? `i = ${current.toFixed(3)} A` : `v = ${voltage.toFixed(3)} V`}</text><text x="650" y="338">{isSeries ? `vC = ${voltage.toFixed(3)} V` : `iL = ${state[1].toFixed(3)} A`}</text></g>
    <text className="scene-caption" x="70" y="352">发光方向表示瞬时符号 · 数值与图表保留真实单位</text>
  </svg></div>;
}

function SeriesCircuit({ elements, source, current }: { elements: { id: string; type: string; value: number }[]; source: number; current: number }) {
  const positions = elements.map((_, index) => 235 + index * Math.min(150, 520 / Math.max(1, elements.length)));
  return <g><path className="circuit-wire" d="M120 105H210M120 275H770V105" /><Source x={120} top={105} bottom={275} label={`${source.toFixed(2)} V`} />{elements.map((element, index) => <Element key={element.id} element={element} x={positions[index]} y={105} horizontal />)}<path className={`circuit-flow ${current < 0 ? "negative" : ""}`} d={current >= 0 ? "M185 105H730l-18-10m18 10l-18 10" : "M730 275H180l18-10m-18 10l18 10"} /></g>;
}

function ParallelCircuit({ elements, source, voltage }: { elements: { id: string; type: string; value: number }[]; source: number; voltage: number }) {
  const positions = elements.map((_, index) => 260 + index * Math.min(145, 470 / Math.max(1, elements.length)));
  return <g><path className="circuit-wire" d="M120 105H770M120 275H770" /><Source x={120} top={105} bottom={275} label={`${source.toFixed(2)} A`} current />{elements.map((element, index) => <Element key={element.id} element={element} x={positions[index]} y={190} horizontal={false} />)}<path className={`circuit-flow ${voltage < 0 ? "negative" : ""}`} d="M170 105H735l-18-10m18 10l-18 10" /></g>;
}

function Source({ x, top, bottom, label, current = false }: { x: number; top: number; bottom: number; label: string; current?: boolean }) { return <g className="circuit-source"><path d={`M${x} ${top}V${top + 45}M${x} ${bottom - 45}V${bottom}`} /><circle cx={x} cy={(top + bottom) / 2} r="40" /><text x={x} y={(top + bottom) / 2 + 6}>{current ? "I" : "U"}</text><text x={x + 50} y={(top + bottom) / 2 + 6}>{label}</text></g>; }

function Element({ element, x, y, horizontal }: { element: { type: string; value: number }; x: number; y: number; horizontal: boolean }) {
  const transform = horizontal ? `translate(${x} ${y})` : `translate(${x} ${y}) rotate(90)`;
  return <g className={`circuit-element element-${element.type}`} transform={transform}>{!horizontal && <path className="circuit-wire" d="M-85 0H-55M55 0H85" />}{element.type === "R" && <path d="M-55 0l12-15 20 30 20-30 20 30 20-30 18 15" />}{element.type === "L" && <path d="M-55 0c8-27 18-27 26 0s18 27 26 0 18-27 26 0 18 27 32 0" />}{element.type === "C" && <g><path d="M-55 0H-8M8 0H55M-8-25V25M8-25V25" /></g>}<text transform={horizontal ? "" : "rotate(-90)"} x="0" y="-34">{element.type} · {formatComponent(element.value)}</text></g>;
}

function formatComponent(value: number) { if (value >= 1000) return `${(value / 1000).toPrecision(3)}k`; if (value < .001) return `${(value * 1e6).toPrecision(3)}µ`; return value.toPrecision(3); }
