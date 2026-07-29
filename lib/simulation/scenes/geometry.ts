export type ScenePoint = { x: number; y: number };

export function buildSpringMassSceneLayout(displacements: number[]) {
  const massWidth = 104;
  const massHeight = 68;
  const massTop = 195;
  const positions = displacements.map((displacement, index) => 210 + index * 220 + Math.max(-70, Math.min(70, displacement * 70)));
  const masses = positions.map((center) => ({ center, left: center - massWidth / 2, right: center + massWidth / 2 }));
  const links = masses.map((mass, index) => ({
    left: index === 0 ? 78 : masses[index - 1].right,
    right: mass.left,
  }));

  return {
    floorY: 275,
    massTop,
    massWidth,
    massHeight,
    springY: 214,
    damperY: 247,
    masses,
    links,
  };
}

export function buildSeriesCircuitLayout(elementCount: number) {
  const count = Math.max(1, Math.floor(elementCount));
  const start = 120;
  const end = 770;
  const gap = (end - start) / (count + 1);
  const halfWidth = Math.min(55, gap * .38);
  const elements = Array.from({ length: count }, (_, index) => {
    const center = start + gap * (index + 1);
    return { center, left: center - halfWidth, right: center + halfWidth, halfWidth };
  });
  const wires: [number, number][] = [[start, elements[0].left]];
  for (let index = 1; index < elements.length; index += 1) wires.push([elements[index - 1].right, elements[index].left]);
  wires.push([elements.at(-1)!.right, end]);
  return { start, end, elements, wires };
}

const node1: ScenePoint = { x: 285, y: 160 };
const node2: ScenePoint = { x: 465, y: 160 };
const output: ScenePoint = { x: 660, y: 180 };

export const SALLEN_KEY_TOPOLOGY = {
  groundY: 300,
  node1,
  node2,
  output,
  signal: { start: { x: 65, y: 160 }, end: { x: 520, y: 160 } },
  c1: { start: node1, end: output },
  c2: { start: node2, end: { x: node2.x, y: 300 } },
  opAmp: { plus: { x: 520, y: 160 }, minus: { x: 520, y: 220 } },
  feedback: { start: { x: 520, y: 220 }, end: output },
} as const;
