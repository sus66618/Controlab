import type { SpringMassModel } from "@/lib/simulation/plants/springMass";

export function SpringMassScene({ model, state, force }: { model: SpringMassModel; state: number[]; force: number }) {
  const count = model.config.masses.length;
  const scale = 70;
  const bases = Array.from({ length: count }, (_, index) => 210 + index * 220);
  const positions = bases.map((base, index) => base + Math.max(-70, Math.min(70, state[index] * scale)));
  return <div className="spring-mass-scene"><svg viewBox="0 0 900 360" role="img" aria-label={`${count} 自由度弹簧阻尼系统`}>
    <defs><linearGradient id="mass-metal" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#26333e" /><stop offset="1" stopColor="#101820" /></linearGradient></defs>
    <path className="plant-floor" d="M60 275H840" /><path className="plant-wall" d="M75 90V275" />
    {model.config.links.map((link) => {
      const left = link.left < 0 ? 78 : positions[link.left] + 52;
      const right = link.right < 0 ? 840 : positions[link.right] - 52;
      return <g key={link.id}>{link.springEnabled && <path className="spring-line" d={springPath(left, right, 190)} />}{link.damperEnabled && <g className="damper-line"><path d={`M${left} 225H${left + (right - left) * .38}`} /><rect x={left + (right - left) * .38} y="212" width={Math.max(18, (right - left) * .28)} height="26" /><path d={`M${left + (right - left) * .52} 212V238M${left + (right - left) * .52} 225H${right}`} /></g>}</g>;
    })}
    {positions.map((position, index) => <g key={index} transform={`translate(${position - 52} 205)`}><rect className="mass-body" width="104" height="68" rx="9" fill="url(#mass-metal)" /><circle className="mass-wheel" cx="25" cy="73" r="10" /><circle className="mass-wheel" cx="79" cy="73" r="10" /><text x="52" y="31">m{index + 1}</text><text x="52" y="50">{model.config.masses[index].toFixed(2)} kg</text></g>)}
    {Math.abs(force) > 1e-6 && <g className={`force-indicator ${force < 0 ? "negative" : ""}`} transform={`translate(${positions[model.config.forceTarget]} 120)`}><path d={force >= 0 ? "M-50 0H50l-18-14m18 14L32 14" : "M50 0H-50l18-14m-18 14L-32 14"} /><text y="-22">{force.toFixed(2)} N</text></g>}
    <text className="scene-caption" x="75" y="325">位移按比例放大显示 · 图表使用真实物理量</text>
  </svg></div>;
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
