import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HrService } from "../ble/hrService";
import type { BleConnectionStatus } from "../ble/types";
import type {
  AnalyzePayload,
  AnalysisResult,
  CalibrationPoint,
  CalibrationSummary,
  WorkerAnalyzeMessage,
  WorkerResponseMessage,
} from "../analysis/types";
import { exportSessionCsv, exportSessionJson } from "../session/export";
import type { RawEvent, Session, SessionMode, SessionSettings } from "../session/models";
import { SessionRecorder } from "../session/recorder";
import { RingBuffer } from "../utils/ringBuffer";
import { CalibrationView } from "../ui/components/CalibrationView";
import { ConnectButton } from "../ui/components/ConnectButton";
import { HRVBSessionView } from "../ui/components/HRVBSessionView";
import { MeasurementView } from "../ui/components/MeasurementView";
import { ModeMenu } from "../ui/components/ModeMenu";
import { ReportView } from "../ui/components/ReportView";
import { ThemeToggle } from "../ui/components/ThemeToggle";
import { Card } from "../ui/components/Card";

interface Point {
  t: number;
  v: number;
}

interface SignalQualityState {
  score: number;
  label: string;
}

type Screen = "menu" | "report" | SessionMode;

const LIVE_WINDOW_SECONDS = 5 * 60;
const HR_CAPACITY = LIVE_WINDOW_SECONDS * 5;
const RR_CAPACITY = LIVE_WINDOW_SECONDS * 8;
const SIGNAL_QUALITY_WINDOW_MS = 30_000;
const CHART_FPS = 15;
const CALIBRATION_FREQUENCIES_HZ = [0.07, 0.08, 0.09, 0.1, 0.11, 0.12];
const CALIBRATION_STEP_SEC = 20;
const CREATOR_WEBSITE = "https://jungsoo.kim";
const SCIENCE_LINKS: Array<{ label: string; href: string }> = [
  {
    label: "Lehrer et al. (2000): Resonant Frequency Biofeedback Rationale",
    href: "https://pubmed.ncbi.nlm.nih.gov/10999236/",
  },
  {
    label: "Vaschillo et al. (2002): Resonance and Baroreflex Mechanisms",
    href: "https://pubmed.ncbi.nlm.nih.gov/12001882/",
  },
  {
    label: "Lehrer et al. (2003): HRV Biofeedback and Baroreflex Gain",
    href: "https://pubmed.ncbi.nlm.nih.gov/14508023/",
  },
  {
    label: "Grossman and Taylor (2007): RSA and Cardiac Vagal Tone",
    href: "https://pubmed.ncbi.nlm.nih.gov/17081672/",
  },
  {
    label: "Goessl et al. (2017): Meta-Analysis on Stress and Anxiety",
    href: "https://pubmed.ncbi.nlm.nih.gov/28478782/",
  },
  {
    label: "Pizzoli et al. (2021): Meta-Analysis on Depressive Symptoms",
    href: "https://pubmed.ncbi.nlm.nih.gov/33758260/",
  },
];

function parseBleError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotFoundError") {
      return "No device selected in the Bluetooth picker";
    }
    if (error.name === "NotAllowedError") {
      return "Bluetooth access denied. Check browser permission settings.";
    }
    if (error.name === "SecurityError") {
      return "Web Bluetooth requires a secure context (localhost or HTTPS).";
    }
    return `${error.name}: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected Bluetooth error";
}

function extractRr(rawEvents: RawEvent[]): { rrTimes_s: number[]; rr_s: number[] } {
  const rrTimes_s: number[] = [];
  const rr_s: number[] = [];

  let elapsed = 0;

  for (const event of rawEvents) {
    // rr values represent interval duration, so build a cumulative beat-time axis
    for (const rrValue of event.rr_s ?? []) {
      if (!Number.isFinite(rrValue)) {
        continue;
      }

      elapsed += rrValue;
      rrTimes_s.push(elapsed);
      rr_s.push(rrValue);
    }
  }

  return { rrTimes_s, rr_s };
}

function calculateCalibrationSegments(
  rrTimes_s: number[],
  rr_s: number[],
  frequenciesHz: number[],
  stepSec: number,
): Array<{ frequencyHz: number; rrTimes_s: number[]; rr_s: number[] }> {
  return frequenciesHz.map((frequencyHz, index) => {
    const start = index * stepSec;
    const end = (index + 1) * stepSec;
    const times: number[] = [];
    const values: number[] = [];

    for (let i = 0; i < rr_s.length; i += 1) {
      const t = rrTimes_s[i];
      if (t >= start && t <= end) {
        times.push(t);
        values.push(rr_s[i]);
      }
    }

    return {
      frequencyHz,
      rrTimes_s: times,
      rr_s: values,
    };
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

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

function computeSignalQuality(rrWindow_s: number[], staleMs: number): SignalQualityState {
  if (rrWindow_s.length < 6) {
    return staleMs > 8_000
      ? { score: 0, label: "No RR Signal" }
      : { score: 0, label: "Searching" };
  }

  const inRange = rrWindow_s.filter((rr) => rr >= 0.3 && rr <= 2);
  if (inRange.length === 0) {
    return { score: 0, label: "Poor" };
  }

  const med = median(inRange);
  const deviations = inRange.map((rr) => Math.abs(rr - med));
  const mad = median(deviations);
  const threshold = mad > 0 ? 3 * 1.4826 * mad : 0.18;
  const outlierCount = inRange.filter((rr) => Math.abs(rr - med) > threshold).length;

  const validRatio = inRange.length / rrWindow_s.length;
  const outlierRatio = inRange.length > 0 ? outlierCount / inRange.length : 1;
  const mean = inRange.reduce((sum, rr) => sum + rr, 0) / inRange.length;
  const variance =
    inRange.reduce((sum, rr) => {
      const delta = rr - mean;
      return sum + delta * delta;
    }, 0) / inRange.length;
  const sd = Math.sqrt(variance);
  const cv = mean > 0 ? sd / mean : 1;
  const stabilityScore = clamp(1 - cv / 0.25, 0, 1);
  const freshnessScore = clamp(1 - staleMs / 5_000, 0, 1);

  const rawScore =
    100 * (0.45 * validRatio + 0.2 * (1 - outlierRatio) + 0.2 * stabilityScore + 0.15 * freshnessScore);

  const score = staleMs > 8_000 ? 0 : Math.round(clamp(rawScore, 0, 100));

  if (score >= 85) {
    return { score, label: "Excellent" };
  }
  if (score >= 70) {
    return { score, label: "Good" };
  }
  if (score >= 50) {
    return { score, label: "Fair" };
  }
  if (score > 0) {
    return { score, label: "Poor" };
  }
  return staleMs > 8_000 ? { score, label: "No RR Signal" } : { score, label: "Searching" };
}

export default function App(): JSX.Element {
  const supportsBluetooth = typeof navigator !== "undefined" && "bluetooth" in navigator;

  const [screen, setScreen] = useState<Screen>("menu");
  const [connectionStatus, setConnectionStatus] = useState<BleConnectionStatus>(
    supportsBluetooth ? "disconnected" : "unsupported",
  );
  const [connectionError, setConnectionError] = useState<string | undefined>(undefined);
  const [deviceName, setDeviceName] = useState<string | undefined>(undefined);

  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);

  const [liveHr, setLiveHr] = useState<number | undefined>(undefined);
  const [liveRr, setLiveRr] = useState<number | undefined>(undefined);
  const [hrSeries, setHrSeries] = useState<Point[]>([]);
  const [rrSeries, setRrSeries] = useState<Point[]>([]);

  const [breathingBpm, setBreathingBpm] = useState(5.4);
  const [inhaleRatio, setInhaleRatio] = useState(0.5);

  const [measurementDurationSec, setMeasurementDurationSec] = useState(45);
  const [measurementRemainingSec, setMeasurementRemainingSec] = useState(45);
  const [sessionElapsedSec, setSessionElapsedSec] = useState(0);
  const [hrvbTimerEnabled, setHrvbTimerEnabled] = useState(false);
  const [hrvbTimerDurationSec, setHrvbTimerDurationSec] = useState(10 * 60);
  const [hrvbTimerRemainingSec, setHrvbTimerRemainingSec] = useState(10 * 60);

  const [calibrationIndex, setCalibrationIndex] = useState(0);
  const [calibrationStepRemainingSec, setCalibrationStepRemainingSec] =
    useState(CALIBRATION_STEP_SEC);

  const [completedSession, setCompletedSession] = useState<Session | undefined>(undefined);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | undefined>(undefined);
  const [calibrationSummary, setCalibrationSummary] = useState<CalibrationSummary | undefined>(
    undefined,
  );
  const [signalQuality, setSignalQuality] = useState<SignalQualityState>({
    score: 0,
    label: "Searching",
  });

  const hrBufferRef = useRef(new RingBuffer<Point>(HR_CAPACITY));
  const rrBufferRef = useRef(new RingBuffer<Point>(RR_CAPACITY));
  const rrTimelineRef = useRef(0);
  const signalQualityRrRef = useRef<Array<{ t_ms: number; rr_s: number }>>([]);
  const lastRrAtMsRef = useRef<number | null>(null);

  const hrServiceRef = useRef(new HrService());
  const recorderRef = useRef<SessionRecorder | null>(null);
  const workerRef = useRef<Worker | null>(null);

  const measurementTimerRef = useRef<number | null>(null);
  const calibrationTimerRef = useRef<number | null>(null);
  const sessionElapsedTimerRef = useRef<number | null>(null);
  const hrvbTimerRef = useRef<number | null>(null);
  const stoppingRef = useRef(false);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    const worker = new Worker(new URL("../analysis/worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const frameInterval = window.setInterval(() => {
      setHrSeries(hrBufferRef.current.toArray());
      setRrSeries(rrBufferRef.current.toArray());
    }, 1000 / CHART_FPS);

    return () => {
      window.clearInterval(frameInterval);
    };
  }, []);

  useEffect(() => {
    if (!running) {
      setHrvbTimerRemainingSec(hrvbTimerDurationSec);
    }
  }, [hrvbTimerDurationSec, running]);

  const recalculateSignalQuality = useCallback(() => {
    const nowMs = Date.now();
    signalQualityRrRef.current = signalQualityRrRef.current.filter(
      (sample) => nowMs - sample.t_ms <= SIGNAL_QUALITY_WINDOW_MS,
    );

    const staleMs =
      lastRrAtMsRef.current === null ? SIGNAL_QUALITY_WINDOW_MS : nowMs - lastRrAtMsRef.current;
    const next = computeSignalQuality(
      signalQualityRrRef.current.map((sample) => sample.rr_s),
      staleMs,
    );

    setSignalQuality((previous) => {
      if (previous.score === next.score && previous.label === next.label) {
        return previous;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      recalculateSignalQuality();
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [recalculateSignalQuality]);

  const clearTimers = useCallback(() => {
    if (measurementTimerRef.current !== null) {
      window.clearInterval(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }
    if (calibrationTimerRef.current !== null) {
      window.clearInterval(calibrationTimerRef.current);
      calibrationTimerRef.current = null;
    }
    if (sessionElapsedTimerRef.current !== null) {
      window.clearInterval(sessionElapsedTimerRef.current);
      sessionElapsedTimerRef.current = null;
    }
    if (hrvbTimerRef.current !== null) {
      window.clearInterval(hrvbTimerRef.current);
      hrvbTimerRef.current = null;
    }
  }, []);

  const resetLiveData = useCallback(() => {
    hrBufferRef.current.clear();
    rrBufferRef.current.clear();
    setHrSeries([]);
    setRrSeries([]);
    setLiveHr(undefined);
    setLiveRr(undefined);
    setSignalQuality({ score: 0, label: "Searching" });
    rrTimelineRef.current = performance.now() / 1000;
    signalQualityRrRef.current = [];
    lastRrAtMsRef.current = null;
  }, []);

  const analyzeInWorker = useCallback((payload: AnalyzePayload): Promise<AnalysisResult> => {
    const worker = workerRef.current;
    if (!worker) {
      return Promise.reject(new Error("analysis worker is not ready"));
    }

    return new Promise((resolve, reject) => {
      const onMessage = (event: MessageEvent<WorkerResponseMessage>): void => {
        const message = event.data;
        if (message.type === "result") {
          worker.removeEventListener("message", onMessage);
          resolve(message.payload);
        }

        if (message.type === "error") {
          worker.removeEventListener("message", onMessage);
          reject(new Error(message.payload.message));
        }
      };

      worker.addEventListener("message", onMessage);

      const request: WorkerAnalyzeMessage = {
        type: "analyze",
        payload,
      };
      worker.postMessage(request);
    });
  }, []);

  const performCalibrationSummary = useCallback(
    async (rrTimes_s: number[], rr_s: number[]): Promise<CalibrationSummary> => {
      const segments = calculateCalibrationSegments(
        rrTimes_s,
        rr_s,
        CALIBRATION_FREQUENCIES_HZ,
        CALIBRATION_STEP_SEC,
      );

      const scanned: CalibrationPoint[] = [];

      for (const segment of segments) {
        if (segment.rr_s.length < 16) {
          scanned.push({
            frequencyHz: segment.frequencyHz,
            breathsPerMin: segment.frequencyHz * 60,
            score: 0,
            peakFrequencyHz: 0,
            peakPower: 0,
          });
          continue;
        }

        const result = await analyzeInWorker({
          rrTimes_s: segment.rrTimes_s,
          rr_s: segment.rr_s,
          targetHz: segment.frequencyHz,
        });

        scanned.push({
          frequencyHz: segment.frequencyHz,
          breathsPerMin: segment.frequencyHz * 60,
          score: result.metrics.coherenceScore,
          peakFrequencyHz: result.metrics.peakFrequencyHz,
          peakPower: result.metrics.peakPower,
        });
      }

      const best = scanned.reduce<CalibrationPoint | undefined>((current, point) => {
        if (!current) {
          return point;
        }
        return point.score > current.score ? point : current;
      }, undefined);

      return {
        scanned,
        best,
      };
    },
    [analyzeInWorker],
  );

  const stopCurrentSession = useCallback(async (): Promise<void> => {
    if (stoppingRef.current || !runningRef.current) {
      return;
    }

    stoppingRef.current = true;
    clearTimers();
    setRunning(false);
    runningRef.current = false;

    const recorder = recorderRef.current;
    recorderRef.current = null;

    if (!recorder) {
      stoppingRef.current = false;
      return;
    }

    try {
      const draftSession = recorder.stop({});
      const rrData = extractRr(draftSession.rawEvents);

      let derivedAnalysis: AnalysisResult | undefined;
      let derivedCalibration: CalibrationSummary | undefined;

      if (rrData.rr_s.length >= 16) {
        if (draftSession.mode === "calibration") {
          derivedCalibration = await performCalibrationSummary(rrData.rrTimes_s, rrData.rr_s);
        }

        const targetHz =
          draftSession.mode === "calibration"
            ? derivedCalibration?.best?.frequencyHz ?? CALIBRATION_FREQUENCIES_HZ[0]
            : breathingBpm / 60;

        derivedAnalysis = await analyzeInWorker({
          rrTimes_s: rrData.rrTimes_s,
          rr_s: rrData.rr_s,
          targetHz,
        });
      }

      const session = recorder.stop({
        analysis: derivedAnalysis,
        calibration: derivedCalibration,
      });

      setCompletedSession(session);
      setAnalysisResult(derivedAnalysis);
      setCalibrationSummary(derivedCalibration);

      if (derivedAnalysis) {
        setScreen("report");
      } else {
        setConnectionError("Session ended, but not enough RR intervals were captured for analysis.");
      }
    } catch (error) {
      setConnectionError(
        error instanceof Error ? error.message : "Failed to finalize and analyze session.",
      );
    } finally {
      stoppingRef.current = false;
    }
  }, [analyzeInWorker, breathingBpm, clearTimers, performCalibrationSummary]);

  const handleMeasurementEvent = useCallback((event: RawEvent): void => {
    const nowSec = performance.now() / 1000;

    if (typeof event.hr === "number") {
      setLiveHr(event.hr);
      hrBufferRef.current.push({ t: nowSec, v: event.hr });
    }

    if (event.rr_s && event.rr_s.length > 0) {
      for (const rr of event.rr_s) {
        rrTimelineRef.current += rr;
        rrBufferRef.current.push({ t: rrTimelineRef.current, v: rr });
        setLiveRr(rr);
        signalQualityRrRef.current.push({ t_ms: event.t_ms, rr_s: rr });
      }
      lastRrAtMsRef.current = event.t_ms;
      recalculateSignalQuality();
    }

    if (runningRef.current && recorderRef.current) {
      recorderRef.current.addEvent(event);
    }
  }, [recalculateSignalQuality]);

  const handleDisconnected = useCallback(() => {
    setConnectionStatus("disconnected");
    setConnectionError("Device disconnected.");
    setDeviceName(undefined);
    setSignalQuality({ score: 0, label: "No RR Signal" });

    if (runningRef.current) {
      void stopCurrentSession();
    }
  }, [stopCurrentSession]);

  const connectDevice = useCallback(async () => {
    if (!supportsBluetooth) {
      setConnectionStatus("unsupported");
      setConnectionError("Web Bluetooth is unavailable in this browser.");
      return;
    }

    setConnectionStatus("connecting");
    setConnectionError(undefined);

    try {
      const info = await hrServiceRef.current.connect(handleMeasurementEvent, handleDisconnected);
      setConnectionStatus("connected");
      setDeviceName(info.name);
      rrTimelineRef.current = performance.now() / 1000;
    } catch (error) {
      setConnectionStatus("error");
      setConnectionError(parseBleError(error));
    }
  }, [handleDisconnected, handleMeasurementEvent, supportsBluetooth]);

  const disconnectDevice = useCallback(() => {
    hrServiceRef.current.disconnect();
    setConnectionStatus("disconnected");
    setDeviceName(undefined);
    if (runningRef.current) {
      void stopCurrentSession();
    }
  }, [stopCurrentSession]);

  const startSession = useCallback(
    (mode: SessionMode) => {
      if (connectionStatus !== "connected") {
        setConnectionError("Connect to a BLE heart rate strap before starting a session.");
        return;
      }

      if (runningRef.current) {
        return;
      }

      resetLiveData();
      clearTimers();
      setConnectionError(undefined);

      const settings: SessionSettings = {
        targetHz: breathingBpm / 60,
        inhaleRatio,
        measurementDurationSec: mode === "measurement" ? measurementDurationSec : undefined,
        sessionTimerEnabled: mode === "hrvb" ? hrvbTimerEnabled : undefined,
        sessionTimerSec: mode === "hrvb" && hrvbTimerEnabled ? hrvbTimerDurationSec : undefined,
        calibrationFrequenciesHz:
          mode === "calibration" ? [...CALIBRATION_FREQUENCIES_HZ] : undefined,
        calibrationStepSec: mode === "calibration" ? CALIBRATION_STEP_SEC : undefined,
      };

      recorderRef.current = new SessionRecorder(mode, settings);
      setRunning(true);
      runningRef.current = true;
      setCompletedSession(undefined);
      setAnalysisResult(undefined);
      setCalibrationSummary(undefined);
      setSessionElapsedSec(0);
      setHrvbTimerRemainingSec(hrvbTimerDurationSec);

      sessionElapsedTimerRef.current = window.setInterval(() => {
        setSessionElapsedSec((previous) => previous + 1);
      }, 1000);

      if (mode === "measurement") {
        setMeasurementRemainingSec(measurementDurationSec);
        measurementTimerRef.current = window.setInterval(() => {
          setMeasurementRemainingSec((previous) => {
            const next = previous - 1;
            if (next <= 0) {
              window.setTimeout(() => {
                void stopCurrentSession();
              }, 0);
              return 0;
            }
            return next;
          });
        }, 1000);
      }

      if (mode === "hrvb" && hrvbTimerEnabled) {
        setHrvbTimerRemainingSec(hrvbTimerDurationSec);
        hrvbTimerRef.current = window.setInterval(() => {
          setHrvbTimerRemainingSec((previous) => {
            const next = previous - 1;
            if (next <= 0) {
              window.setTimeout(() => {
                void stopCurrentSession();
              }, 0);
              return 0;
            }
            return next;
          });
        }, 1000);
      }

      if (mode === "calibration") {
        setCalibrationIndex(0);
        setCalibrationStepRemainingSec(CALIBRATION_STEP_SEC);

        let elapsedSec = 0;
        calibrationTimerRef.current = window.setInterval(() => {
          elapsedSec += 1;
          const nextIndex = Math.min(
            Math.floor(elapsedSec / CALIBRATION_STEP_SEC),
            CALIBRATION_FREQUENCIES_HZ.length - 1,
          );
          const stepElapsed = elapsedSec % CALIBRATION_STEP_SEC;

          setCalibrationIndex(nextIndex);
          setCalibrationStepRemainingSec(CALIBRATION_STEP_SEC - stepElapsed);

          if (elapsedSec >= CALIBRATION_STEP_SEC * CALIBRATION_FREQUENCIES_HZ.length) {
            window.setTimeout(() => {
              void stopCurrentSession();
            }, 0);
          }
        }, 1000);
      }
    },
    [
      breathingBpm,
      clearTimers,
      connectionStatus,
      hrvbTimerDurationSec,
      hrvbTimerEnabled,
      inhaleRatio,
      measurementDurationSec,
      resetLiveData,
      stopCurrentSession,
    ],
  );

  const exportCompletedJson = useCallback(() => {
    if (!completedSession) {
      return;
    }

    exportSessionJson(completedSession);
  }, [completedSession]);

  const exportCompletedCsv = useCallback(() => {
    if (!completedSession) {
      return;
    }

    exportSessionCsv(completedSession);
  }, [completedSession]);

  useEffect(() => {
    const hrService = hrServiceRef.current;
    return () => {
      clearTimers();
      hrService.disconnect();
    };
  }, [clearTimers]);

  const reportTargetHz = useMemo(() => {
    if (!completedSession) {
      return breathingBpm / 60;
    }

    if (completedSession.mode === "calibration") {
      return calibrationSummary?.best?.frequencyHz ?? CALIBRATION_FREQUENCIES_HZ[0];
    }

    return completedSession.settings.targetHz;
  }, [breathingBpm, calibrationSummary, completedSession]);

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand-block">
          <h1>ResonanceFlow</h1>
          <p>Desktop Web HRV Biofeedback Training for Bluetooth HR Chest Straps</p>
        </div>

        <div className="top-actions">
          <ThemeToggle />
          <ConnectButton
            status={connectionStatus}
            deviceName={deviceName}
            error={connectionError}
            onConnect={connectDevice}
            onDisconnect={disconnectDevice}
          />
        </div>
      </header>

      <main className="main-content">
        {screen === "menu" && (
          <>
            <ModeMenu
              onSelect={(mode) => {
                setScreen(mode);
                setConnectionError(undefined);
                if (mode === "measurement") {
                  setMeasurementRemainingSec(measurementDurationSec);
                }
              }}
            />

            <Card
              title="HRV Biofeedback: Evidence Overview"
              subtitle="Science-based background on breathing training, RSA, and autonomic regulation"
            >
              <div className="science-copy">
                <p>
                  <strong>What It Is:</strong> HRV biofeedback is a self-regulation method that
                  uses realtime heart rhythm feedback while you practice paced breathing. HRV
                  reflects beat-to-beat variation in RR intervals, and training aims to improve
                  cardiorespiratory regulation rather than diagnose disease.
                </p>
                <p>
                  <strong>How It Works:</strong> Many users train near their resonance frequency
                  (often around 0.1 Hz, approximately 6 breaths/min). At this rate, respiratory and
                  baroreflex-related oscillations can amplify heart rate swings, which is associated
                  with increased baroreflex gain in controlled studies.
                </p>
                <p>
                  <strong>RSA and Vagus Nerve:</strong> Respiratory sinus arrhythmia (RSA) is the
                  pattern where heart rate typically rises during inhalation and falls during
                  exhalation. RSA is strongly influenced by vagal (parasympathetic) cardiac control,
                  but it is not a perfect standalone measure of vagal tone because respiration,
                  posture, and activity can affect it.
                </p>
                <p>
                  <strong>What Outcomes Are Supported:</strong> Meta-analyses report improvements
                  in self-reported stress, anxiety, and depressive symptoms in multiple study
                  contexts. Results vary by protocol and population, so HRV biofeedback should be
                  viewed as a supportive training tool, not a replacement for medical care.
                </p>

                <div className="science-links" aria-label="Scientific References">
                  {SCIENCE_LINKS.map((study) => (
                    <a key={study.href} href={study.href} target="_blank" rel="noreferrer">
                      {study.label}
                    </a>
                  ))}
                </div>
              </div>
            </Card>
          </>
        )}

        {screen === "measurement" && (
          <>
            <div className="screen-actions">
              <button
                type="button"
                className="button-back"
                onClick={() => setScreen("menu")}
                disabled={running}
              >
                &larr; Back to Menu
              </button>
            </div>
            <MeasurementView
              running={running}
              durationSec={measurementDurationSec}
              remainingSec={measurementRemainingSec}
              elapsedSec={sessionElapsedSec}
              status={connectionStatus}
              deviceName={deviceName}
              hr={liveHr}
              rr={liveRr}
              signalQualityScore={signalQuality.score}
              signalQualityLabel={signalQuality.label}
              hrSeries={hrSeries}
              rrSeries={rrSeries}
              onDurationChange={(seconds) => {
                setMeasurementDurationSec(seconds);
                setMeasurementRemainingSec(seconds);
              }}
              onStart={() => startSession("measurement")}
              onStop={() => {
                void stopCurrentSession();
              }}
            />
          </>
        )}

        {screen === "hrvb" && (
          <>
            <div className="screen-actions">
              <button
                type="button"
                className="button-back"
                onClick={() => setScreen("menu")}
                disabled={running}
              >
                &larr; Back to Menu
              </button>
            </div>
            <HRVBSessionView
              running={running}
              elapsedSec={sessionElapsedSec}
              status={connectionStatus}
              deviceName={deviceName}
              hr={liveHr}
              rr={liveRr}
              signalQualityScore={signalQuality.score}
              signalQualityLabel={signalQuality.label}
              hrSeries={hrSeries}
              rrSeries={rrSeries}
              bpm={breathingBpm}
              inhaleRatio={inhaleRatio}
              timerEnabled={hrvbTimerEnabled}
              timerDurationSec={hrvbTimerDurationSec}
              timerRemainingSec={hrvbTimerRemainingSec}
              onBpmChange={setBreathingBpm}
              onInhaleRatioChange={setInhaleRatio}
              onTimerEnabledChange={setHrvbTimerEnabled}
              onTimerDurationSecChange={setHrvbTimerDurationSec}
              onStart={() => startSession("hrvb")}
              onStop={() => {
                void stopCurrentSession();
              }}
            />
          </>
        )}

        {screen === "calibration" && (
          <>
            <div className="screen-actions">
              <button
                type="button"
                className="button-back"
                onClick={() => setScreen("menu")}
                disabled={running}
              >
                &larr; Back to Menu
              </button>
            </div>
            <CalibrationView
              running={running}
              frequenciesHz={CALIBRATION_FREQUENCIES_HZ}
              currentIndex={calibrationIndex}
              stepRemainingSec={calibrationStepRemainingSec}
              elapsedSec={sessionElapsedSec}
              inhaleRatio={inhaleRatio}
              status={connectionStatus}
              deviceName={deviceName}
              hr={liveHr}
              rr={liveRr}
              signalQualityScore={signalQuality.score}
              signalQualityLabel={signalQuality.label}
              hrSeries={hrSeries}
              rrSeries={rrSeries}
              summary={calibrationSummary}
              onStart={() => startSession("calibration")}
              onStop={() => {
                void stopCurrentSession();
              }}
            />
          </>
        )}

        {screen === "report" && completedSession && analysisResult && (
          <ReportView
            session={completedSession}
            analysis={analysisResult}
            targetHz={reportTargetHz}
            calibration={calibrationSummary}
            onBack={() => setScreen(completedSession.mode)}
            onExportJson={exportCompletedJson}
            onExportCsv={exportCompletedCsv}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>
          Disclaimer: This application is for wellness, education, and self-tracking only. It is
          not a medical device and does not provide diagnosis, treatment, prevention, or emergency
          monitoring. Always consult a licensed healthcare professional for medical decisions.
        </p>
        <p>
          Designed and Developed by Jungsoo Kim.
          Website:{" "}
          <a href={CREATOR_WEBSITE} target="_blank" rel="noreferrer">
            {CREATOR_WEBSITE}
          </a>
        </p>
      </footer>
    </div>
  );
}
