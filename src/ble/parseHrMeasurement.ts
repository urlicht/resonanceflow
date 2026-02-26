import type { ParsedHeartRateMeasurement } from "./types";

export function parseHrMeasurement(value: DataView): ParsedHeartRateMeasurement {
  if (value.byteLength < 2) {
    throw new Error("heart rate packet is too short");
  }

  // flags layout follows bluetooth heart rate measurement characteristic spec
  const flags = value.getUint8(0);
  const hrIsUint16 = (flags & 0x01) === 0x01;
  const hasEnergyExpended = (flags & 0x08) === 0x08;
  const hasRrIntervals = (flags & 0x10) === 0x10;

  let offset = 1;
  let hr: number;

  if (hrIsUint16) {
    if (offset + 1 >= value.byteLength) {
      throw new Error("invalid heart rate packet: missing uint16 HR value");
    }
    hr = value.getUint16(offset, true);
    offset += 2;
  } else {
    hr = value.getUint8(offset);
    offset += 1;
  }

  if (hasEnergyExpended) {
    offset += 2;
  }

  const rr_s: number[] = [];
  if (hasRrIntervals) {
    while (offset + 1 < value.byteLength) {
      const rr1024 = value.getUint16(offset, true);
      rr_s.push(rr1024 / 1024);
      offset += 2;
    }
  }

  return {
    hr,
    rr_s,
  };
}
