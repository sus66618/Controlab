const EPSILON = 1e-10;

function latexNumber(value: number) {
  const rounded = Math.round(value * 10000) / 10000;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

export function polynomialToLatex(coefficients: number[], variable = "s") {
  const first = coefficients.findIndex((value) => Math.abs(value) > EPSILON);
  const normalized = first === -1 ? [0] : coefficients.slice(first);
  const degree = normalized.length - 1;
  const terms: string[] = [];

  normalized.forEach((coefficient, index) => {
    if (Math.abs(coefficient) <= EPSILON) return;
    const power = degree - index;
    const magnitude = Math.abs(coefficient);
    const coefficientText = power > 0 && Math.abs(magnitude - 1) <= EPSILON ? "" : latexNumber(magnitude);
    const variableText = power === 0 ? "" : power === 1 ? variable : `${variable}^{${power}}`;
    const term = `${coefficientText}${variableText}`;
    if (terms.length === 0) terms.push(coefficient < 0 ? `-${term}` : term);
    else terms.push(`${coefficient < 0 ? "-" : "+"} ${term}`);
  });

  return terms.join(" ") || "0";
}

export function transferToLatex(numerator: number[], denominator: number[]) {
  return `\\frac{${polynomialToLatex(numerator)}}{${polynomialToLatex(denominator)}}`;
}
