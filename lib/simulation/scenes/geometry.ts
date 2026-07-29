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

const mfbNode1: ScenePoint = { x: 260, y: 160 };
const mfbOutput: ScenePoint = { x: 680, y: 180 };
const mfbMinus: ScenePoint = { x: 520, y: 160 };
const mfbPlus: ScenePoint = { x: 520, y: 220 };

export const MFB_LOW_PASS_TOPOLOGY = {
  node1: mfbNode1,
  output: mfbOutput,
  signal: { start: { x: 65, y: 160 }, end: mfbNode1 },
  r2: { start: mfbNode1, end: mfbMinus },
  r3: { start: mfbNode1, end: mfbOutput },
  c1: { start: mfbNode1, end: { x: mfbNode1.x, y: 300 } },
  c2: { start: mfbMinus, end: mfbOutput },
  opAmp: { plus: mfbPlus, minus: mfbMinus },
  ground: { x: mfbPlus.x, startY: mfbPlus.y, y: 300 },
} as const;
