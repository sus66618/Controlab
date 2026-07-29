"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { rk4Step } from "@/lib/simulation/core/integrate";
import { signalValue } from "@/lib/simulation/core/signals";
import type { PlantDerivative, PlantHistoryPoint, PlantSignal } from "@/lib/simulation/core/types";

type PlantSimulationOptions = {
  initialState: number[];
  derivative: PlantDerivative;
  signal: PlantSignal;
  manualInput: number;
  dt?: number;
  resetKey: string;
};

export function usePlantSimulation({ initialState, derivative, signal, manualInput, dt = 0.002, resetKey }: PlantSimulationOptions) {
  const [state, setState] = useState(() => [...initialState]);
  const [time, setTime] = useState(0);
  const [history, setHistory] = useState<PlantHistoryPoint[]>([]);
  const [running, setRunning] = useState(true);
  const [error, setError] = useState("");
  const stateRef = useRef([...initialState]);
  const timeRef = useRef(0);
  const derivativeRef = useRef(derivative);
  const signalRef = useRef(signal);
  const manualRef = useRef(manualInput);
  const lastSampleRef = useRef(-Infinity);

  useEffect(() => { derivativeRef.current = derivative; }, [derivative]);
  useEffect(() => { signalRef.current = signal; }, [signal]);
  useEffect(() => { manualRef.current = manualInput; }, [manualInput]);

  const reset = useCallback(() => {
    stateRef.current = [...initialState];
    timeRef.current = 0;
    lastSampleRef.current = -Infinity;
    setState([...initialState]);
    setTime(0);
    setHistory([]);
    setError("");
  }, [initialState]);

  useEffect(() => {
    const frame = requestAnimationFrame(reset);
    return () => cancelAnimationFrame(frame);
  }, [reset, resetKey]);

  useEffect(() => {
    if (!running || error) return;
    let frame = 0;
    let previous = performance.now();
    let accumulator = 0;
    const tick = (now: number) => {
      accumulator += Math.min(0.04, (now - previous) / 1000);
      previous = now;
      try {
        let steps = 0;
        while (accumulator >= dt && steps < 20) {
          const currentTime = timeRef.current;
          const input = signalValue(signalRef.current, currentTime, manualRef.current);
          stateRef.current = rk4Step(stateRef.current, currentTime, dt, (nextTime, nextState) => derivativeRef.current(nextTime, nextState, signalValue(signalRef.current, nextTime, manualRef.current)));
          timeRef.current += dt;
          accumulator -= dt;
          steps += 1;
          if (timeRef.current - lastSampleRef.current >= 0.025) {
            const currentDerivative = derivativeRef.current(timeRef.current, stateRef.current, input);
            const point = { time: timeRef.current, input, state: [...stateRef.current], derivative: currentDerivative };
            setHistory((items) => [...items.slice(-599), point]);
            lastSampleRef.current = timeRef.current;
          }
        }
        setState([...stateRef.current]);
        setTime(timeRef.current);
        frame = requestAnimationFrame(tick);
      } catch (reason) {
        setRunning(false);
        setError(reason instanceof Error ? reason.message : "仿真无法继续");
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [dt, error, running]);

  return { state, time, history, running, error, setRunning, reset };
}
