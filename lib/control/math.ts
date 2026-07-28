import type { Complex } from "./types.ts";

export const EPS = 1e-10;

export const complex = {
  add: (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im }),
  sub: (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im }),
  mul: (a: Complex, b: Complex): Complex => ({
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  }),
  div: (a: Complex, b: Complex): Complex => {
    const denominator = b.re * b.re + b.im * b.im || EPS;
    return {
      re: (a.re * b.re + a.im * b.im) / denominator,
      im: (a.im * b.re - a.re * b.im) / denominator,
    };
  },
  abs: (value: Complex) => Math.hypot(value.re, value.im),
};

export function trimLeading(values: number[]) {
  const result = [...values];
  while (result.length > 1 && Math.abs(result[0]) < EPS) result.shift();
  return result;
}

export function padLeft(values: number[], length: number) {
  return [...Array(Math.max(0, length - values.length)).fill(0), ...values];
}

export function polyEval(coefficients: number[], value: Complex): Complex {
  return coefficients.reduce<Complex>(
    (accumulator, coefficient) => complex.add(complex.mul(accumulator, value), { re: coefficient, im: 0 }),
    { re: 0, im: 0 },
  );
}

export function polynomialRoots(coefficients: number[]): Complex[] {
  const normalizedInput = trimLeading(coefficients);
  const degree = normalizedInput.length - 1;
  if (degree <= 0) return [];
  if (degree === 1) return [{ re: -normalizedInput[1] / normalizedInput[0], im: 0 }];

  const normalized = normalizedInput.map((value) => value / normalizedInput[0]);
  const radius = 1 + Math.max(...normalized.slice(1).map(Math.abs));
  let roots = Array.from({ length: degree }, (_, index) => {
    const angle = (2 * Math.PI * index) / degree + 0.17;
    return { re: radius * Math.cos(angle), im: radius * Math.sin(angle) };
  });

  for (let iteration = 0; iteration < 200; iteration += 1) {
    let movement = 0;
    roots = roots.map((root, index) => {
      let denominator: Complex = { re: 1, im: 0 };
      roots.forEach((other, otherIndex) => {
        if (otherIndex !== index) denominator = complex.mul(denominator, complex.sub(root, other));
      });
      const delta = complex.div(polyEval(normalized, root), denominator);
      movement = Math.max(movement, complex.abs(delta));
      return complex.sub(root, delta);
    });
    if (movement < 1e-10) break;
  }

  return roots.map((root) => ({
    re: Math.abs(root.re) < 1e-8 ? 0 : root.re,
    im: Math.abs(root.im) < 1e-8 ? 0 : root.im,
  }));
}

export function polynomialFromRoots(roots: Complex[]): number[] {
  let coefficients: Complex[] = [{ re: 1, im: 0 }];
  roots.forEach((root) => {
    const next = Array.from({ length: coefficients.length + 1 }, () => ({ re: 0, im: 0 }));
    coefficients.forEach((coefficient, index) => {
      next[index] = complex.add(next[index], coefficient);
      next[index + 1] = complex.sub(next[index + 1], complex.mul(coefficient, root));
    });
    coefficients = next;
  });
  if (coefficients.some((value) => Math.abs(value.im) > 1e-6)) {
    throw new Error("复数零极点必须成共轭对出现");
  }
  return trimLeading(coefficients.map((value) => Math.abs(value.re) < 1e-10 ? 0 : value.re));
}

export function polyAddAscending(a: number[], b: number[], scale = 1) {
  const length = Math.max(a.length, b.length);
  return Array.from({ length }, (_, index) => (a[index] ?? 0) + scale * (b[index] ?? 0));
}

export function polyMultiplyAscending(a: number[], b: number[]) {
  const result = Array(a.length + b.length - 1).fill(0);
  a.forEach((left, i) => b.forEach((right, j) => { result[i + j] += left * right; }));
  while (result.length > 1 && Math.abs(result[result.length - 1]) < EPS) result.pop();
  return result;
}

export function polyPowerAscending(value: number[], power: number) {
  let result = [1];
  for (let index = 0; index < power; index += 1) result = polyMultiplyAscending(result, value);
  return result;
}
