"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ensureConjugates,
  formatRootList,
  formatTransferExpression,
  modelToZpk,
  normalizeModel,
  parseCoefficients,
  parseRootList,
  parseTransferExpression,
  zpkToModel,
} from "@/lib/control";
import type { Complex, TransferModel } from "@/lib/control";

export type ModelInputMode = "coefficients" | "expression" | "zpk";

const INITIAL_MODEL: TransferModel = { numerator: [25], denominator: [1, 4, 25] };

function draftsFromModel(model: TransferModel) {
  const zpk = modelToZpk(model);
  return {
    numerator: model.numerator.join(", "),
    denominator: model.denominator.join(", "),
    expression: formatTransferExpression(model),
    gain: String(zpk.gain),
    zeros: formatRootList(zpk.zeros),
    poles: formatRootList(zpk.poles),
  };
}

export function useControlModel() {
  const [model, setModel] = useState<TransferModel>(INITIAL_MODEL);
  const [mode, setMode] = useState<ModelInputMode>("coefficients");
  const [drafts, setDrafts] = useState(() => draftsFromModel(INITIAL_MODEL));
  const [error, setError] = useState("");

  const commit = useCallback((next: TransferModel, source: ModelInputMode | "external") => {
    const normalized = normalizeModel(next);
    const generated = draftsFromModel(normalized);
    setModel(normalized);
    setDrafts((current) => ({
      numerator: source === "coefficients" ? current.numerator : generated.numerator,
      denominator: source === "coefficients" ? current.denominator : generated.denominator,
      expression: source === "expression" ? current.expression : generated.expression,
      gain: source === "zpk" ? current.gain : generated.gain,
      zeros: source === "zpk" ? current.zeros : generated.zeros,
      poles: source === "zpk" ? current.poles : generated.poles,
    }));
    setError("");
  }, []);

  const updateCoefficients = useCallback((field: "numerator" | "denominator", value: string) => {
    const nextDrafts = { ...drafts, [field]: value };
    setDrafts(nextDrafts);
    try {
      commit({
        numerator: parseCoefficients(nextDrafts.numerator),
        denominator: parseCoefficients(nextDrafts.denominator),
      }, "coefficients");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "系数格式不正确");
    }
  }, [commit, drafts]);

  const updateExpression = useCallback((value: string) => {
    setDrafts((current) => ({ ...current, expression: value }));
    try {
      commit(parseTransferExpression(value), "expression");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "表达式格式不正确");
    }
  }, [commit]);

  const updateZpk = useCallback((field: "gain" | "zeros" | "poles", value: string) => {
    const nextDrafts = { ...drafts, [field]: value };
    setDrafts(nextDrafts);
    try {
      commit(zpkToModel({
        gain: Number(nextDrafts.gain),
        zeros: ensureConjugates(parseRootList(nextDrafts.zeros)),
        poles: ensureConjugates(parseRootList(nextDrafts.poles)),
      }), "zpk");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "零极点格式不正确");
    }
  }, [commit, drafts]);

  const addRoot = useCallback((kind: "zero" | "pole", root: Complex) => {
    const zpk = modelToZpk(model);
    const target = kind === "zero" ? zpk.zeros : zpk.poles;
    target.push(root);
    if (Math.abs(root.im) > 1e-8) target.push({ re: root.re, im: -root.im });
    commit(zpkToModel(zpk), "external");
  }, [commit, model]);

  const removeRoot = useCallback((kind: "zero" | "pole", root: Complex) => {
    const zpk = modelToZpk(model);
    const target = kind === "zero" ? zpk.zeros : zpk.poles;
    const removeOne = (candidate: Complex) => {
      const index = target.findIndex((value) => Math.abs(value.re - candidate.re) < 1e-6 && Math.abs(value.im - candidate.im) < 1e-6);
      if (index >= 0) target.splice(index, 1);
    };
    removeOne(root);
    if (Math.abs(root.im) > 1e-8) removeOne({ re: root.re, im: -root.im });
    commit(zpkToModel(zpk), "external");
  }, [commit, model]);

  const loadModel = useCallback((next: TransferModel) => commit(next, "external"), [commit]);
  const zpk = useMemo(() => modelToZpk(model), [model]);

  return {
    model,
    zpk,
    mode,
    setMode,
    drafts,
    error,
    updateCoefficients,
    updateExpression,
    updateZpk,
    addRoot,
    removeRoot,
    loadModel,
  };
}
