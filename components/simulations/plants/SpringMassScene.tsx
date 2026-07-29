import { buildSpringMassSceneLayout } from "@/lib/simulation/scenes/geometry";
import type { SpringMassModel } from "@/lib/simulation/plants/springMass";

export function SpringMassScene({ model, state, force }: { model: SpringMassModel; state: number[]; force: number }) {
  const layout = buildSpringMassSceneLayout(state.slice(0, model.config.masses.length));
  return <div className="spring-mass-scene"><svg viewBox="0 0 900 360" role="img" aria-label={`${layout.masses.length} 自由度弹簧阻尼系统`}>
    <defs><linearGradient id="mass-metal" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#26333e" /><stop offset="1" stopColor="#101820" /></linearGradient></defs>
    <path className="plant-floor" d={`M60 ${layout.floorY}H840`} /><path className="plant-wall" d={`M75 90V${layout.floorY}`} />
    {model.config.links.map((link, index) => {
      const geometry = layout.links[index];
      return <g key={link.id}>{link.springEnabled && <path className="spring-line" d={springPath(geometry.left, geometry.right, layout.springY)} />}{link.damperEnabled && <Damper left={geometry.left} right={geometry.right} y={layout.damperY} />}</g>;
    })}
    {layout.masses.map((mass, index) => <g key={index} transform={`translate(${mass.left} ${layout.massTop})`}><rect className="mass-body" width={layout.massWidth} height={layout.massHeight} rx="9" fill="url(#mass-metal)" /><circle className="mass-wheel" cx="25" cy="73" r="10" /><circle className="mass-wheel" cx="79" cy="73" r="10" /><text x="52" y="31">m{index + 1}</text><text x="52" y="50">{model.config.masses[index].toFixed(2)} kg</text></g>)}
    {Math.abs(force) > 1e-6 && <g className={`force-indicator ${force < 0 ? "negative" : ""}`} transform={`translate(${layout.masses[model.config.forceTarget].center} 120)`}><path d={force >= 0 ? "M-50 0H50l-18-14m18 14L32 14" : "M50 0H-50l18-14m-18 14L-32 14"} /><text y="-22">{force.toFixed(2)} N</text></g>}
    <text className="scene-caption" x="75" y="325">位移按比例放大显示 · 图表使用真实物理量</text>
  </svg></div>;
}

function Damper({ left, right, y }: { left: number; right: number; y: number }) {
  const length = right - left;
  const boxLeft = left + length * .34;
  const boxWidth = Math.max(18, length * .32);
  return <g className="damper-line"><path d={`M${left} ${y}H${boxLeft}`} /><rect x={boxLeft} y={y - 11} width={boxWidth} height="22" /><path d={`M${boxLeft + boxWidth * .5} ${y - 11}V${y + 11}M${boxLeft + boxWidth * .5} ${y}H${right}`} /></g>;
}

function springPath(left: number, right: number, y: number) {
  const length = Math.max(24, right - left);
  const start = left + Math.min(18, length * .15);
  const end = right - Math.min(18, length * .15);
  const turns = Math.max(3, Math.round((end - start) / 20));
  let path = `M${left} ${y}H${start}`;
  for (let index = 0; index < turns; index += 1) path += `L${start + (index + .5) * (end - start) / turns} ${y + (index % 2 === 0 ? -13 : 13)}`;
  return `${path}L${end} ${y}H${right}`;
}
