import type { AnalysisResult, CalibrationSummary } from "../analysis/types";

export type SessionMode = "measurement" | "hrvb" | "calibration";

export interface RawEvent {
  t_ms: number;
  hr?: number;
  rr_s?: number[];
}

export interface SessionSettings {
  targetHz: number;
  inhaleRatio: number;
  measurementDurationSec?: number;
  sessionTimerEnabled?: boolean;
  sessionTimerSec?: number;
  calibrationFrequenciesHz?: number[];
  calibrationStepSec?: number;
}

export interface SessionDerived {
  analysis?: AnalysisResult;
  calibration?: CalibrationSummary;
}

export interface Session {
  id: string;
  startedAt: string;
  endedAt: string;
  settings: SessionSettings;
  rawEvents: RawEvent[];
  derived: SessionDerived;
  version: number;
  mode: SessionMode;
}
