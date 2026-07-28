import { EPS, polyAddAscending, polyMultiplyAscending, polyPowerAscending, polynomialFromRoots, polynomialRoots, trimLeading } from "./math.ts";
import type { Complex, TransferModel, ZpkModel } from "./types.ts";

type Rational = { numerator: number[]; denominator: number[] };
type Token = { type: "number" | "s" | "operator" | "left" | "right"; value: string };

export function normalizeModel(model: TransferModel): TransferModel {
  const denominator = trimLeading(model.denominator);
  const numerator = trimLeading(model.numerator);
  if (Math.abs(denominator[0]) < EPS) throw new Error("分母最高次项不能为 0");
  if (numerator.length > denominator.length) throw new Error("当前版本仅支持真有理或正则传递函数");
  const leading = denominator[0];
  const clean = (value: number) => Math.abs(value) < EPS ? 0 : Number(value.toPrecision(12));
  return {
    // 清理零极点重建时产生的浮点尾巴，避免输入框出现 25.000000000007。
    numerator: numerator.map((value) => clean(value / leading)),
    denominator: denominator.map((value) => clean(value / leading)),
  };
}

export function parseCoefficients(value: string): number[] {
  const values = value.trim().split(/[\s,，;；]+/).filter(Boolean).map(Number);
  if (!values.length || values.some((item) => !Number.isFinite(item))) {
    throw new Error("请输入用逗号或空格分隔的有效数字");
  }
  return trimLeading(values);
}

function rationalAdd(a: Rational, b: Rational, scale = 1): Rational {
  return {
    numerator: polyAddAscending(
      polyMultiplyAscending(a.numerator, b.denominator),
      polyMultiplyAscending(b.numerator, a.denominator),
      scale,
    ),
    denominator: polyMultiplyAscending(a.denominator, b.denominator),
  };
}

function rationalMultiply(a: Rational, b: Rational): Rational {
  return {
    numerator: polyMultiplyAscending(a.numerator, b.numerator),
    denominator: polyMultiplyAscending(a.denominator, b.denominator),
  };
}

function rationalDivide(a: Rational, b: Rational): Rational {
  if (b.numerator.every((value) => Math.abs(value) < EPS)) throw new Error("表达式不能除以 0");
  return {
    numerator: polyMultiplyAscending(a.numerator, b.denominator),
    denominator: polyMultiplyAscending(a.denominator, b.numerator),
  };
}

function tokenize(expression: string): Token[] {
  const compact = expression.replace(/G\s*\(\s*s\s*\)\s*=/gi, "").replace(/\s+/g, "");
  const raw: Token[] = [];
  let index = 0;
  while (index < compact.length) {
    const current = compact[index];
    if (/[0-9.]/.test(current)) {
      const match = compact.slice(index).match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
      if (!match) throw new Error("数字格式不正确");
      raw.push({ type: "number", value: match[0] });
      index += match[0].length;
      continue;
    }
    if (current.toLowerCase() === "s") raw.push({ type: "s", value: "s" });
    else if ("+-*/^".includes(current)) raw.push({ type: "operator", value: current });
    else if (current === "(") raw.push({ type: "left", value: current });
    else if (current === ")") raw.push({ type: "right", value: current });
    else throw new Error(`无法识别字符“${current}”`);
    index += 1;
  }

  const tokens: Token[] = [];
  raw.forEach((token) => {
    const previous = tokens[tokens.length - 1];
    const endsValue = previous && ["number", "s", "right"].includes(previous.type);
    const startsValue = ["number", "s", "left"].includes(token.type);
    if (endsValue && startsValue) tokens.push({ type: "operator", value: "*" });
    tokens.push(token);
  });
  return tokens;
}

export function parseTransferExpression(expression: string): TransferModel {
  const tokens = tokenize(expression);
  let cursor = 0;

  const parsePrimary = (): Rational => {
    const token = tokens[cursor];
    if (!token) throw new Error("表达式不完整");
    if (token.type === "operator" && (token.value === "+" || token.value === "-")) {
      cursor += 1;
      const value = parsePrimary();
      return token.value === "-" ? { numerator: value.numerator.map((item) => -item), denominator: value.denominator } : value;
    }
    if (token.type === "number") {
      cursor += 1;
      return { numerator: [Number(token.value)], denominator: [1] };
    }
    if (token.type === "s") {
      cursor += 1;
      return { numerator: [0, 1], denominator: [1] };
    }
    if (token.type === "left") {
      cursor += 1;
      const value = parseExpression();
      if (tokens[cursor]?.type !== "right") throw new Error("缺少右括号");
      cursor += 1;
      return value;
    }
    throw new Error("表达式格式不正确");
  };

  const parseFactor = (): Rational => {
    let value = parsePrimary();
    if (tokens[cursor]?.type === "operator" && tokens[cursor].value === "^") {
      cursor += 1;
      const powerToken = tokens[cursor];
      const power = powerToken?.type === "number" ? Number(powerToken.value) : NaN;
      if (!Number.isInteger(power) || power < 0 || power > 12) throw new Error("幂次必须是 0 到 12 的整数");
      cursor += 1;
      value = {
        numerator: polyPowerAscending(value.numerator, power),
        denominator: polyPowerAscending(value.denominator, power),
      };
    }
    return value;
  };

  const parseTerm = (): Rational => {
    let value = parseFactor();
    while (tokens[cursor]?.type === "operator" && ["*", "/"].includes(tokens[cursor].value)) {
      const operator = tokens[cursor].value;
      cursor += 1;
      const right = parseFactor();
      value = operator === "*" ? rationalMultiply(value, right) : rationalDivide(value, right);
    }
    return value;
  };

  const parseExpression = (): Rational => {
    let value = parseTerm();
    while (tokens[cursor]?.type === "operator" && ["+", "-"].includes(tokens[cursor].value)) {
      const operator = tokens[cursor].value;
      cursor += 1;
      value = rationalAdd(value, parseTerm(), operator === "+" ? 1 : -1);
    }
    return value;
  };

  if (!tokens.length) throw new Error("请输入传递函数表达式");
  const result = parseExpression();
  if (cursor !== tokens.length) throw new Error("表达式后存在多余内容");
  return normalizeModel({
    numerator: result.numerator.slice().reverse(),
    denominator: result.denominator.slice().reverse(),
  });
}

export function modelToZpk(model: TransferModel): ZpkModel {
  const normalized = normalizeModel(model);
  return {
    gain: normalized.numerator[0],
    zeros: polynomialRoots(normalized.numerator),
    poles: polynomialRoots(normalized.denominator),
  };
}

export function zpkToModel(value: ZpkModel): TransferModel {
  if (!Number.isFinite(value.gain)) throw new Error("增益必须是有效数字");
  const numerator = polynomialFromRoots(value.zeros).map((coefficient) => coefficient * value.gain);
  const denominator = polynomialFromRoots(value.poles);
  return normalizeModel({ numerator, denominator });
}

export function parseComplex(value: string): Complex {
  const compact = value.trim().toLowerCase().replace(/\s+/g, "").replace(/i/g, "j");
  if (!compact) throw new Error("零极点列表中存在空值");
  if (!compact.includes("j")) {
    const real = Number(compact);
    if (!Number.isFinite(real)) throw new Error(`无法解析“${value}”`);
    return { re: real, im: 0 };
  }
  const body = compact.replace(/j$/, "");
  let split = -1;
  for (let index = 1; index < body.length; index += 1) {
    if ((body[index] === "+" || body[index] === "-") && body[index - 1].toLowerCase() !== "e") split = index;
  }
  const realText = split < 0 ? "0" : body.slice(0, split);
  const imaginaryText = split < 0 ? body : body.slice(split);
  const re = Number(realText);
  const im = imaginaryText === "+" || imaginaryText === "" ? 1 : imaginaryText === "-" ? -1 : Number(imaginaryText);
  if (!Number.isFinite(re) || !Number.isFinite(im)) throw new Error(`无法解析“${value}”`);
  return { re, im };
}

export function parseRootList(value: string): Complex[] {
  if (!value.trim()) return [];
  return value.split(/[,，;；\n]+/).filter(Boolean).map(parseComplex);
}

export function ensureConjugates(values: Complex[]): Complex[] {
  const result: Complex[] = [];
  values.forEach((root) => {
    result.push({ re: root.re, im: root.im });
    if (Math.abs(root.im) > 1e-8) {
      const hasPair = values.some((candidate) => Math.abs(candidate.re - root.re) < 1e-7 && Math.abs(candidate.im + root.im) < 1e-7);
      const alreadyAdded = result.some((candidate, index) => index < result.length - 1 && Math.abs(candidate.re - root.re) < 1e-7 && Math.abs(candidate.im + root.im) < 1e-7);
      if (!hasPair && !alreadyAdded) result.push({ re: root.re, im: -root.im });
    }
  });
  return result;
}

export function formatNumber(value: number, digits = 4) {
  if (Math.abs(value) < 1e-10) return "0";
  const absolute = Math.abs(value);
  if (absolute >= 1e4 || absolute < 1e-3) return value.toExponential(2);
  return Number(value.toFixed(digits)).toString();
}

export function formatComplex(value: Complex) {
  if (Math.abs(value.im) < 1e-8) return formatNumber(value.re);
  if (Math.abs(value.re) < 1e-8) return `${formatNumber(value.im)}j`;
  return `${formatNumber(value.re)} ${value.im >= 0 ? "+" : "−"} ${formatNumber(Math.abs(value.im))}j`;
}

export function formatPolynomial(coefficients: number[], variable = "s") {
  const degree = coefficients.length - 1;
  const terms = coefficients.flatMap((coefficient, index) => {
    if (Math.abs(coefficient) < EPS) return [];
    const power = degree - index;
    const sign = coefficient < 0 ? "−" : "+";
    const magnitude = Math.abs(coefficient);
    const number = Math.abs(magnitude - 1) < EPS && power > 0 ? "" : formatNumber(magnitude);
    const symbol = power === 0 ? "" : power === 1 ? variable : `${variable}^${power}`;
    return [{ sign, text: `${number}${symbol}` }];
  });
  if (!terms.length) return "0";
  return terms.map((term, index) => `${index === 0 && term.sign === "+" ? "" : `${term.sign} `}${term.text}`).join(" ");
}

export function formatTransferExpression(model: TransferModel) {
  const normalized = normalizeModel(model);
  return `(${formatPolynomial(normalized.numerator)}) / (${formatPolynomial(normalized.denominator)})`;
}

export function formatRootList(values: Complex[]) {
  return values.map((value) => formatComplex(value).replace(/ − /g, "-").replace(/ \+ /g, "+")).join(", ");
}
