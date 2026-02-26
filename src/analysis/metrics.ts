import type { TimeDomainMetrics } from "./types";

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function std(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }
  const m = mean(values);
  const variance = values.reduce((sum, value) => {
    const delta = value - m;
    return sum + delta * delta;
  }, 0);
  return Math.sqrt(variance / (values.length - 1));
}

export function computeTimeDomain(rr_s: number[]): TimeDomainMetrics {
  if (rr_s.length === 0) {
    return {
      meanHr: 0,
      meanRr: 0,
      rmssd: 0,
      sdnn: 0,
      pnn50: 0,
    };
  }

  const meanRr = mean(rr_s);
  const meanHr = meanRr > 0 ? 60 / meanRr : 0;
  const sdnn = std(rr_s);

  const diffs: number[] = [];
  for (let i = 1; i < rr_s.length; i += 1) {
    diffs.push(rr_s[i] - rr_s[i - 1]);
  }

  const rmssd =
    diffs.length > 0
      ? Math.sqrt(diffs.reduce((sum, value) => sum + value * value, 0) / diffs.length)
      : 0;

  const nn50Count = diffs.filter((value) => Math.abs(value) > 0.05).length;
  const pnn50 = diffs.length > 0 ? (nn50Count / diffs.length) * 100 : 0;

  return {
    meanHr,
    meanRr,
    rmssd,
    sdnn,
    pnn50,
  };
}
