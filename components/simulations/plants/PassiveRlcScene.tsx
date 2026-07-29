import { buildSeriesCircuitLayout } from "@/lib/simulation/scenes/geometry";
import type { PassiveRlcModel } from "@/lib/simulation/plants/passiveRlc";

type DisplayElement = { id: string; type: string; value: number };

export function PassiveRlcScene({ model, state, source }: { model: PassiveRlcModel; state: number[]; source: number }) {
  const isSeries = model.config.topology === "series";
  const current = isSeries ? state[0] : source;
  const voltage = isSeries ? state[1] : state[0];
  const elements = [...model.config.resistors.filter((item) => item.enabled).map((item) => ({ ...item, type: "R" })), ...model.config.inductors.filter((item) => item.enabled).map((item) => ({ ...item, type: "L" })), ...model.config.capacitors.filter((item) => item.enabled).map((item) => ({ ...item, type: "C" }))];
  return <div className="circuit-scene passive-circuit-scene"><svg viewBox="0 0 900 380" role="img" aria-label={`${isSeries ? "串联" : "并联"} RLC 电路`}>
    <text className="circuit-mode-label" x="70" y="55">{isSeries ? "SERIES · VOLTAGE DRIVE" : "PARALLEL · CURRENT DRIVE"}</text>
    {isSeries ? <SeriesCircuit elements={elements} source={source} /> : <ParallelCircuit elements={elements} source={source} />}
    <g className="circuit-readouts"><text x="650" y="314">{isSeries ? `i = ${current.toFixed(3)} A` : `v = ${voltage.toFixed(3)} V`}</text><text x="650" y="338">{isSeries ? `vC = ${voltage.toFixed(3)} V` : `iL = ${state[1].toFixed(3)} A`}</text></g>
    <text className="scene-caption" x="70" y="352">静态拓扑图 · 数值和曲线保留真实单位</text>
  </svg></div>;
}

function SeriesCircuit({ elements, source }: { elements: DisplayElement[]; source: number }) {
  const layout = buildSeriesCircuitLayout(elements.length);
  return <g><path className="circuit-wire" d={`M120 275H770V105M120 105V150M120 230V275`} /><Source x={120} top={105} bottom={275} label={`${source.toFixed(2)} V`} />{layout.wires.map(([left, right], index) => <path className="circuit-wire" d={`M${left} 105H${right}`} key={`wire-${index}`} />)}{elements.map((element, index) => <Element key={element.id} element={element} x={layout.elements[index].center} y={105} horizontal halfWidth={layout.elements[index].halfWidth} />)}</g>;
}

function ParallelCircuit({ elements, source }: { elements: DisplayElement[]; source: number }) {
  const positions = elements.map((_, index) => 260 + index * Math.min(145, 470 / Math.max(1, elements.length)));
  return <g><path className="circuit-wire" d="M120 105H770M120 275H770" /><Source x={120} top={105} bottom={275} label={`${source.toFixed(2)} A`} current />{elements.map((element, index) => <Element key={element.id} element={element} x={positions[index]} y={190} horizontal={false} halfWidth={55} />)}</g>;
}

function Source({ x, top, bottom, label, current = false }: { x: number; top: number; bottom: number; label: string; current?: boolean }) {
  return <g className="circuit-source"><path d={`M${x} ${top}V${top + 45}M${x} ${bottom - 45}V${bottom}`} /><circle cx={x} cy={(top + bottom) / 2} r="40" /><text x={x} y={(top + bottom) / 2 + 6}>{current ? "I" : "U"}</text><text x={x + 50} y={(top + bottom) / 2 + 6}>{label}</text></g>;
}

function Element({ element, x, y, horizontal, halfWidth }: { element: DisplayElement; x: number; y: number; horizontal: boolean; halfWidth: number }) {
  const transform = horizontal ? `translate(${x} ${y})` : `translate(${x} ${y}) rotate(90)`;
  const scale = halfWidth / 55;
  return <g className={`circuit-element element-${element.type}`} transform={transform}>{!horizontal && <path className="circuit-wire" d="M-85 0H-55M55 0H85" />}{element.type === "R" && <path transform={`scale(${scale} 1)`} d="M-55 0l12-15 20 30 20-30 20 30 20-30 18 15" />}{element.type === "L" && <path transform={`scale(${scale} 1)`} d="M-55 0c8-27 18-27 26 0s18 27 26 0 18-27 26 0 18 27 32 0" />}{element.type === "C" && <path d={`M${-halfWidth} 0H-8M8 0H${halfWidth}M-8-25V25M8-25V25`} />}<text transform={horizontal ? "" : "rotate(-90)"} x="0" y="-34">{element.type} · {formatComponent(element.value)}</text></g>;
}

function formatComponent(value: number) { if (value >= 1000) return `${(value / 1000).toPrecision(3)}k`; if (value < .001) return `${(value * 1e6).toPrecision(3)}μ`; return value.toPrecision(3); }
