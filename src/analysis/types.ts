export interface AnalyzePayload {
  rrTimes_s: number[];
  rr_s: number[];
  targetHz: number;
}

export interface TimeDomainMetrics {
  meanHr: number;
  meanRr: number;
  rmssd: number;
  sdnn: number;
  pnn50: number;
}

export interface FrequencyDomainMetrics {
  lfPower: number;
  hfPower: number;
  totalPower: number;
}

export interface CoherenceMetrics {
  coherenceScore: number;
  peakFrequencyHz: number;
  peakPower: number;
  targetBandPower: number;
}

export interface AnalysisMetrics
  extends TimeDomainMetrics,
    FrequencyDomainMetrics,
    CoherenceMetrics {}

export interface PsdData {
  f: number[];
  p: number[];
}

export interface CleanedRrData {
  rrTimes_s: number[];
  rr_s: number[];
}

export interface AnalysisResult {
  metrics: AnalysisMetrics;
  psd: PsdData;
  cleaned: CleanedRrData;
}

export interface WorkerAnalyzeMessage {
  type: "analyze";
  payload: AnalyzePayload;
}

export interface WorkerResultMessage {
  type: "result";
  payload: AnalysisResult;
}

export interface WorkerErrorMessage {
  type: "error";
  payload: {
    message: string;
  };
}

export type WorkerResponseMessage = WorkerResultMessage | WorkerErrorMessage;

export interface CalibrationPoint {
  frequencyHz: number;
  breathsPerMin: number;
  score: number;
  peakFrequencyHz: number;
  peakPower: number;
}

export interface CalibrationSummary {
  scanned: CalibrationPoint[];
  best?: CalibrationPoint;
}
