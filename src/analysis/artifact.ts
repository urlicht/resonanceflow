import type { CleanedRrData } from "./types";

interface ArtifactOptions {
  minRrSec?: number;
  maxRrSec?: number;
  windowSize?: number;
  sigma?: number;
}

const DEFAULT_OPTIONS: Required<ArtifactOptions> = {
  minRrSec: 0.3,
  maxRrSec: 2,
  windowSize: 5,
  sigma: 3,
};

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

export function cleanRrSeries(
  rrTimes_s: number[],
  rr_s: number[],
  options: ArtifactOptions = {},
): CleanedRrData {
  const config = { ...DEFAULT_OPTIONS, ...options };

  if (rrTimes_s.length !== rr_s.length) {
    throw new Error("rrTimes_s and rr_s lengths do not match");
  }

  const rangeTimes: number[] = [];
  const rangeValues: number[] = [];

  for (let i = 0; i < rr_s.length; i += 1) {
    const value = rr_s[i];
    const time = rrTimes_s[i];

    if (!Number.isFinite(value) || !Number.isFinite(time)) {
      continue;
    }

    if (value < config.minRrSec || value > config.maxRrSec) {
      continue;
    }

    rangeTimes.push(time);
    rangeValues.push(value);
  }

  if (rangeValues.length < 3) {
    return {
      rrTimes_s: rangeTimes,
      rr_s: rangeValues,
    };
  }

  const halfWindow = Math.floor(config.windowSize / 2);
  const filteredTimes: number[] = [];
  const filteredValues: number[] = [];

  for (let i = 0; i < rangeValues.length; i += 1) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(rangeValues.length - 1, i + halfWindow);
    const local = rangeValues.slice(start, end + 1);

    const localMedian = median(local);
    const deviations = local.map((value) => Math.abs(value - localMedian));
    const mad = median(deviations);

    if (mad === 0) {
      filteredTimes.push(rangeTimes[i]);
      filteredValues.push(rangeValues[i]);
      continue;
    }

    const scaledMad = 1.4826 * mad;
    const threshold = config.sigma * scaledMad;
    const delta = Math.abs(rangeValues[i] - localMedian);

    if (delta <= threshold) {
      filteredTimes.push(rangeTimes[i]);
      filteredValues.push(rangeValues[i]);
    }
  }

  return {
    rrTimes_s: filteredTimes,
    rr_s: filteredValues,
  };
}
