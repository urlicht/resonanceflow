import type { PsdData } from "./types";

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function highestPowerOfTwo(value: number): number {
  if (value < 1) {
    return 0;
  }
  return 2 ** Math.floor(Math.log2(value));
}

export interface ResampledSignal {
  fs: number;
  t: number[];
  y: number[];
}

export function resampleRrToUniform(
  rrTimes_s: number[],
  rr_s: number[],
  fs = 4,
): ResampledSignal {
  // linear interpolation maps uneven rr timing onto a uniform grid for spectral methods
  if (rrTimes_s.length !== rr_s.length || rr_s.length < 2) {
    return { fs, t: [], y: [] };
  }

  const dt = 1 / fs;
  const tStart = rrTimes_s[0];
  const tEnd = rrTimes_s[rrTimes_s.length - 1];

  if (tEnd <= tStart) {
    return { fs, t: [], y: [] };
  }

  const t: number[] = [];
  const y: number[] = [];
  let sourceIndex = 0;

  for (let currentTime = tStart; currentTime <= tEnd; currentTime += dt) {
    while (
      sourceIndex < rrTimes_s.length - 2 &&
      rrTimes_s[sourceIndex + 1] < currentTime
    ) {
      sourceIndex += 1;
    }

    const t0 = rrTimes_s[sourceIndex];
    const t1 = rrTimes_s[sourceIndex + 1];
    const y0 = rr_s[sourceIndex];
    const y1 = rr_s[sourceIndex + 1];

    const span = t1 - t0;
    if (span <= 0) {
      continue;
    }

    const alpha = (currentTime - t0) / span;
    const interpolated = y0 + alpha * (y1 - y0);

    t.push(currentTime);
    y.push(interpolated);
  }

  return { fs, t, y };
}

export function welchPsd(
  signal: number[],
  fs: number,
  segmentLength = 256,
  overlap = 0.5,
): PsdData {
  const usableLength = highestPowerOfTwo(Math.min(segmentLength, signal.length));
  if (usableLength < 16) {
    return { f: [], p: [] };
  }

  const step = Math.max(1, Math.floor(usableLength * (1 - overlap)));
  const bins = usableLength / 2 + 1;

  const window: number[] = [];
  for (let i = 0; i < usableLength; i += 1) {
    window.push(0.5 * (1 - Math.cos((2 * Math.PI * i) / (usableLength - 1))));
  }

  const windowPower = window.reduce((sum, value) => sum + value * value, 0);
  const accumulated = new Array<number>(bins).fill(0);
  let segmentCount = 0;

  for (let start = 0; start + usableLength <= signal.length; start += step) {
    const segment = signal.slice(start, start + usableLength);
    const segmentMean = mean(segment);

    for (let k = 0; k < bins; k += 1) {
      let re = 0;
      let im = 0;

      for (let n = 0; n < usableLength; n += 1) {
        const sample = (segment[n] - segmentMean) * window[n];
        const angle = (2 * Math.PI * k * n) / usableLength;
        re += sample * Math.cos(angle);
        im -= sample * Math.sin(angle);
      }

      const power = (re * re + im * im) / (fs * windowPower);
      accumulated[k] += power;
    }

    segmentCount += 1;
  }

  if (segmentCount === 0) {
    return { f: [], p: [] };
  }

  const f: number[] = [];
  const p: number[] = [];

  for (let k = 0; k < bins; k += 1) {
    const frequency = (k * fs) / usableLength;
    let power = accumulated[k] / segmentCount;

    if (k > 0 && k < bins - 1) {
      power *= 2;
    }

    f.push(frequency);
    p.push(power);
  }

  return { f, p };
}

export function integrateBand(psd: PsdData, lowHz: number, highHz: number): number {
  if (psd.f.length === 0 || psd.f.length !== psd.p.length) {
    return 0;
  }

  let area = 0;

  for (let i = 1; i < psd.f.length; i += 1) {
    const f0 = psd.f[i - 1];
    const f1 = psd.f[i];

    if (f1 < lowHz || f0 > highHz) {
      continue;
    }

    const p0 = psd.p[i - 1];
    const p1 = psd.p[i];
    const dx = f1 - f0;

    if (dx > 0) {
      area += ((p0 + p1) / 2) * dx;
    }
  }

  return area;
}
