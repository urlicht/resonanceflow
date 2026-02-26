export const HEART_RATE_SERVICE_UUID = 0x180d;
export const HEART_RATE_MEASUREMENT_UUID = 0x2a37;

export type BleConnectionStatus =
  | "unsupported"
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface ParsedHeartRateMeasurement {
  hr: number;
  rr_s: number[];
}

export interface BleDeviceInfo {
  id: string;
  name: string;
}
