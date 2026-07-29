import type { IdentificationDataset } from "../identificationData.ts";
import { identificationMetrics, residualAutocorrelation } from "./evaluate.ts";
import type { ChannelEvaluation, PolynomialModel } from "./types.ts";

export function modelStart(model: PolynomialModel) {
  return Math.max(model.na, model.nk + model.nb - 1);
}
export function predictPolynomial(dataset: IdentificationDataset, model: PolynomialModel, mode: "oneStep" | "simulation", splitIndex: number) {
  const start = modelStart(model);
  const result = dataset.outputs.map((row) => [...row]);
  for (let index = start; index < dataset.time.length; index += 1) {
    const resetAtValidation = mode === "simulation" && index === splitIndex;
    if (resetAtValidation) {
      for (let seed = Math.max(start, splitIndex - model.na); seed < splitIndex; seed += 1) result[seed] = [...dataset.outputs[seed]];
    }
    result[index] = model.outputNames.map((_, output) => {
      const history = mode === "oneStep" ? dataset.outputs : result;
      const outputPart = model.a[output].reduce((sum, coefficients, lag) => sum - coefficients.reduce((part, value, source) => part + value * history[index - lag - 1][source], 0), 0);
      const inputPart = model.b[output].reduce((sum, coefficients, lag) => sum + coefficients.reduce((part, value, input) => part + value * dataset.inputs[index - model.nk - lag][input], 0), 0);
      return model.bias[output] + outputPart + inputPart;
    });
  }
  return result;
}

export function evaluateChannels(dataset: IdentificationDataset, oneStep: number[][], simulation: number[][], splitIndex: number, start: number, parameterCount: number): ChannelEvaluation[] {
  return dataset.outputNames.map((name, output) => {
    const measured = dataset.outputs.map((row) => row[output]);
    const predicted = oneStep.map((row) => row[output]);
    const simulated = simulation.map((row) => row[output]);
    const residuals = measured.slice(start, splitIndex).map((value, index) => value - predicted[index + start]);
    return {
      name,
      train: {
        oneStep: identificationMetrics(measured.slice(start, splitIndex), predicted.slice(start, splitIndex), parameterCount),
        simulation: identificationMetrics(measured.slice(start, splitIndex), simulated.slice(start, splitIndex), parameterCount),
      },
      validation: {
        oneStep: identificationMetrics(measured.slice(splitIndex), predicted.slice(splitIndex), parameterCount),
        simulation: identificationMetrics(measured.slice(splitIndex), simulated.slice(splitIndex), parameterCount),
      },
      autocorrelation: residualAutocorrelation(residuals, 20),
    };
  });
}
