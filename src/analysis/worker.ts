/// <reference lib="webworker" />

import { cleanRrSeries } from "./artifact";
import { computeCoherence } from "./coherence";
import { computeTimeDomain } from "./metrics";
import { integrateBand, resampleRrToUniform, welchPsd } from "./psd";
import type {
  AnalysisResult,
  WorkerAnalyzeMessage,
  WorkerErrorMessage,
  WorkerResultMessage,
} from "./types";

function analyze(
  rrTimes_s: number[],
  rr_s: number[],
  targetHz: number,
): AnalysisResult {
  // cleanup first so all downstream metrics use artifact-filtered beats
  const cleaned = cleanRrSeries(rrTimes_s, rr_s);
  const timeMetrics = computeTimeDomain(cleaned.rr_s);

  const resampled = resampleRrToUniform(cleaned.rrTimes_s, cleaned.rr_s, 4);
  const psd = welchPsd(resampled.y, resampled.fs);
  const coherence = computeCoherence(psd, targetHz);

  const lfPower = integrateBand(psd, 0.04, 0.15);
  const hfPower = integrateBand(psd, 0.15, 0.4);
  const totalPower = integrateBand(psd, 0.04, 0.4);

  return {
    metrics: {
      ...timeMetrics,
      ...coherence,
      lfPower,
      hfPower,
      totalPower,
    },
    psd,
    cleaned,
  };
}

self.addEventListener("message", (event: MessageEvent<WorkerAnalyzeMessage>) => {
  const message = event.data;
  if (message.type !== "analyze") {
    return;
  }

  try {
    const result = analyze(
      message.payload.rrTimes_s,
      message.payload.rr_s,
      message.payload.targetHz,
    );

    const output: WorkerResultMessage = {
      type: "result",
      payload: result,
    };
    self.postMessage(output);
  } catch (error) {
    const output: WorkerErrorMessage = {
      type: "error",
      payload: {
        message: error instanceof Error ? error.message : "analysis worker error",
      },
    };
    self.postMessage(output);
  }
});

export {};
