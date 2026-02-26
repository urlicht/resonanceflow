import { integrateBand } from "./psd";
import type { CoherenceMetrics, PsdData } from "./types";

const LF_LOW_HZ = 0.04;
const HF_HIGH_HZ = 0.4;
const TARGET_HALF_BAND_HZ = 0.015;

export function computeCoherence(psd: PsdData, targetHz: number): CoherenceMetrics {
  const totalPower = integrateBand(psd, LF_LOW_HZ, HF_HIGH_HZ);
  const targetLow = Math.max(LF_LOW_HZ, targetHz - TARGET_HALF_BAND_HZ);
  const targetHigh = Math.min(HF_HIGH_HZ, targetHz + TARGET_HALF_BAND_HZ);
  const targetBandPower = integrateBand(psd, targetLow, targetHigh);

  let peakFrequencyHz = 0;
  let peakPower = 0;

  for (let i = 0; i < psd.f.length; i += 1) {
    const frequency = psd.f[i];
    if (frequency < LF_LOW_HZ || frequency > HF_HIGH_HZ) {
      continue;
    }

    const power = psd.p[i];
    if (power > peakPower) {
      peakPower = power;
      peakFrequencyHz = frequency;
    }
  }

  return {
    coherenceScore: totalPower > 0 ? targetBandPower / totalPower : 0,
    peakFrequencyHz,
    peakPower,
    targetBandPower,
  };
}
