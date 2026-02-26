import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatSeconds } from "../../utils/time";
import { Card } from "./Card";

interface Point {
  t: number;
  v: number;
}

interface BreathingPacerProps {
  bpm: number;
  inhaleRatio: number;
  onBpmChange: (value: number) => void;
  onInhaleRatioChange: (value: number) => void;
  disabled?: boolean;
  running?: boolean;
  elapsedSec?: number;
  hr?: number;
  rr?: number;
  rrSeries?: Point[];
  liveCoherenceScore?: number;
  liveCoherenceTrend?: "rising" | "steady" | "falling";
  canStartSession?: boolean;
  onStartSession?: () => void;
  onStopSession?: () => void;
}

type VisualMode = "orb" | "ring";

interface AmbientAudioNodes {
  context: AudioContext;
  masterGain: GainNode;
  oscillators: OscillatorNode[];
  lfoOscillator: OscillatorNode;
}

export function BreathingPacer({
  bpm,
  inhaleRatio,
  onBpmChange,
  onInhaleRatioChange,
  disabled,
  running,
  elapsedSec,
  hr,
  rr,
  rrSeries = [],
  liveCoherenceScore,
  liveCoherenceTrend,
  canStartSession,
  onStartSession,
  onStopSession,
}: BreathingPacerProps): JSX.Element {
  const [phase, setPhase] = useState(0);
  const [visualMode, setVisualMode] = useState<VisualMode>("orb");
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [focusModeActive, setFocusModeActive] = useState(false);
  const [ambientMusicEnabled, setAmbientMusicEnabled] = useState(false);

  const cueAudioContextRef = useRef<AudioContext | null>(null);
  const ambientAudioRef = useRef<AmbientAudioNodes | null>(null);
  const previousInhaleStateRef = useRef<boolean | null>(null);
  const previousRunningRef = useRef(Boolean(running));

  useEffect(() => {
    let frameId = 0;
    const startedAt = performance.now();

    const tick = (now: number): void => {
      const cycleMs = (60 / bpm) * 1000;
      const nextPhase = ((now - startedAt) % cycleMs) / cycleMs;
      setPhase(nextPhase);
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [bpm]);

  const inhaleActive = phase <= inhaleRatio;

  const phaseProgress = useMemo(() => {
    if (inhaleActive) {
      return phase / Math.max(0.001, inhaleRatio);
    }
    return (phase - inhaleRatio) / Math.max(0.001, 1 - inhaleRatio);
  }, [inhaleActive, inhaleRatio, phase]);

  const easedProgress = 0.5 - 0.5 * Math.cos(Math.PI * phaseProgress);
  const scale = inhaleActive ? 0.82 + easedProgress * 0.55 : 1.37 - easedProgress * 0.55;

  const playCue = useCallback(
    (isInhale: boolean): void => {
      if (!audioEnabled || !running) {
        return;
      }

      const context = cueAudioContextRef.current ?? new AudioContext();
      cueAudioContextRef.current = context;

      if (context.state === "suspended") {
        void context.resume().catch(() => undefined);
      }

      const now = context.currentTime + 0.001;
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1900, now);
      filter.Q.setValueAtTime(0.7, now);

      const masterGain = context.createGain();
      masterGain.gain.setValueAtTime(0.0001, now);
      masterGain.gain.exponentialRampToValueAtTime(0.11, now + 0.02);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);

      const primaryOscillator = context.createOscillator();
      const harmonyOscillator = context.createOscillator();
      const shimmerOscillator = context.createOscillator();

      const primaryGain = context.createGain();
      const harmonyGain = context.createGain();
      const shimmerGain = context.createGain();

      const baseFrequency = isInhale ? 622 : 494;
      const harmonyFrequency = baseFrequency * 1.33;
      const shimmerFrequency = baseFrequency * 2;

      primaryOscillator.type = "sine";
      primaryOscillator.frequency.setValueAtTime(baseFrequency, now);
      primaryOscillator.frequency.linearRampToValueAtTime(baseFrequency * 1.02, now + 0.22);

      harmonyOscillator.type = "triangle";
      harmonyOscillator.frequency.setValueAtTime(harmonyFrequency, now);
      harmonyOscillator.frequency.linearRampToValueAtTime(harmonyFrequency * 0.99, now + 0.22);

      shimmerOscillator.type = "sine";
      shimmerOscillator.frequency.setValueAtTime(shimmerFrequency, now + 0.03);

      primaryGain.gain.setValueAtTime(0.8, now);
      harmonyGain.gain.setValueAtTime(0.42, now);
      shimmerGain.gain.setValueAtTime(0.18, now);

      primaryOscillator.connect(primaryGain);
      harmonyOscillator.connect(harmonyGain);
      shimmerOscillator.connect(shimmerGain);

      primaryGain.connect(masterGain);
      harmonyGain.connect(masterGain);
      shimmerGain.connect(masterGain);
      masterGain.connect(filter);
      filter.connect(context.destination);

      primaryOscillator.start(now);
      harmonyOscillator.start(now);
      shimmerOscillator.start(now + 0.015);

      primaryOscillator.stop(now + 0.4);
      harmonyOscillator.stop(now + 0.4);
      shimmerOscillator.stop(now + 0.36);
    },
    [audioEnabled, running],
  );

  const stopAmbientMusic = useCallback((): void => {
    const ambientNodes = ambientAudioRef.current;
    if (!ambientNodes) {
      return;
    }

    ambientAudioRef.current = null;

    const now = ambientNodes.context.currentTime;
    const currentGain = Math.max(ambientNodes.masterGain.gain.value, 0.0001);
    ambientNodes.masterGain.gain.cancelScheduledValues(now);
    ambientNodes.masterGain.gain.setValueAtTime(currentGain, now);
    ambientNodes.masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    window.setTimeout(() => {
      for (const oscillator of ambientNodes.oscillators) {
        try {
          oscillator.stop();
        } catch {
          // noop
        }
      }
      try {
        ambientNodes.lfoOscillator.stop();
      } catch {
        // noop
      }
      void ambientNodes.context.close().catch(() => undefined);
    }, 500);
  }, []);

  const startAmbientMusic = useCallback((): void => {
    if (ambientAudioRef.current) {
      return;
    }

    const context = new AudioContext();
    if (context.state === "suspended") {
      void context.resume().catch(() => undefined);
    }

    const now = context.currentTime + 0.02;

    const masterGain = context.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.exponentialRampToValueAtTime(0.03, now + 1.8);

    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1150, now);
    filter.Q.setValueAtTime(0.6, now);

    const ambientFrequencies = [174.61, 261.63, 392];
    const ambientLevels = [0.62, 0.3, 0.16];

    const oscillators: OscillatorNode[] = [];

    ambientFrequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.detune.setValueAtTime(index === 0 ? -7 : index === 2 ? 9 : 0, now);

      const voiceGain = context.createGain();
      voiceGain.gain.setValueAtTime(ambientLevels[index], now);

      oscillator.connect(voiceGain);
      voiceGain.connect(masterGain);
      oscillator.start(now);
      oscillators.push(oscillator);
    });

    const lfoOscillator = context.createOscillator();
    const lfoGain = context.createGain();

    lfoOscillator.type = "sine";
    lfoOscillator.frequency.setValueAtTime(0.065, now);
    lfoGain.gain.setValueAtTime(0.0095, now);

    lfoOscillator.connect(lfoGain);
    lfoGain.connect(masterGain.gain);

    lfoOscillator.start(now);

    masterGain.connect(filter);
    filter.connect(context.destination);

    ambientAudioRef.current = {
      context,
      masterGain,
      oscillators,
      lfoOscillator,
    };
  }, []);

  const enterFocusMode = useCallback((): void => {
    setFocusModeActive(true);
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      void document.documentElement.requestFullscreen().catch(() => undefined);
    }
  }, []);

  const exitFocusMode = useCallback((): void => {
    setFocusModeActive(false);

    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const previous = previousInhaleStateRef.current;

    if (previous === null) {
      previousInhaleStateRef.current = inhaleActive;
      return;
    }

    if (previous !== inhaleActive) {
      previousInhaleStateRef.current = inhaleActive;
      playCue(inhaleActive);
    }
  }, [inhaleActive, playCue]);

  useEffect(() => {
    const onFullscreenChange = (): void => {
      if (focusModeActive && !document.fullscreenElement) {
        setFocusModeActive(false);
      }
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [focusModeActive]);

  useEffect(() => {
    const wasRunning = previousRunningRef.current;
    const isRunning = Boolean(running);

    if (focusModeActive && wasRunning && !isRunning) {
      exitFocusMode();
    }

    previousRunningRef.current = isRunning;
  }, [exitFocusMode, focusModeActive, running]);

  useEffect(() => {
    if (focusModeActive && ambientMusicEnabled) {
      startAmbientMusic();
      return;
    }

    stopAmbientMusic();
  }, [ambientMusicEnabled, focusModeActive, startAmbientMusic, stopAmbientMusic]);

  useEffect(() => {
    return () => {
      stopAmbientMusic();

      const context = cueAudioContextRef.current;
      cueAudioContextRef.current = null;
      if (context) {
        void context.close().catch(() => undefined);
      }
    };
  }, [stopAmbientMusic]);

  const ringDegrees = Math.max(1, Math.round(phaseProgress * 360));
  const elapsedDisplay = running && typeof elapsedSec === "number" ? formatSeconds(elapsedSec) : "--:--";
  const hrDisplay = typeof hr === "number" && Number.isFinite(hr) ? `${Math.round(hr)} bpm` : "--";
  const rrDisplay =
    typeof rr === "number" && Number.isFinite(rr) ? `${Math.round(rr * 1000)} ms` : "--";
  const coherenceRatio =
    typeof liveCoherenceScore === "number" && Number.isFinite(liveCoherenceScore)
      ? Math.min(1, Math.max(0, liveCoherenceScore))
      : undefined;
  const coherenceDegrees = Math.round((coherenceRatio ?? 0) * 360);
  const coherenceRatioDisplay = typeof coherenceRatio === "number" ? coherenceRatio.toFixed(2) : "--";
  const coherencePercentDisplay =
    typeof coherenceRatio === "number" ? `${Math.round(coherenceRatio * 100)}%` : "--";
  const coherenceBandLabel =
    typeof coherenceRatio !== "number"
      ? "Collecting"
      : coherenceRatio >= 0.45
        ? "High"
        : coherenceRatio >= 0.28
          ? "Moderate"
          : "Low";
  const coherenceTrendLabel =
    typeof coherenceRatio !== "number"
      ? "Stable"
      : liveCoherenceTrend === "rising"
        ? "Rising"
        : liveCoherenceTrend === "falling"
          ? "Falling"
          : "Stable";

  const tachogramPath = useMemo(() => {
    if (rrSeries.length < 2) {
      return "";
    }

    const latestTime = rrSeries[rrSeries.length - 1]?.t;
    if (!Number.isFinite(latestTime)) {
      return "";
    }

    const width = 520;
    const height = 116;
    const paddingX = 8;
    const paddingY = 10;
    const windowSec = 72;
    const usableWidth = width - paddingX * 2;
    const usableHeight = height - paddingY * 2;

    const points = rrSeries.filter((point) => {
      const age = latestTime - point.t;
      return Number.isFinite(point.v) && Number.isFinite(point.t) && age >= 0 && age <= windowSec;
    });

    if (points.length < 2) {
      return "";
    }

    const values = points.map((point) => point.v);
    const low = Math.max(0.3, Math.min(...values) - 0.03);
    const high = Math.min(2.0, Math.max(...values) + 0.03);
    const span = Math.max(0.1, high - low);

    return points
      .map((point, index) => {
        const age = latestTime - point.t;
        const x = width - paddingX - (age / windowSec) * usableWidth;
        const y = paddingY + ((high - point.v) / span) * usableHeight;
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }, [rrSeries]);

  return (
    <>
      <Card title="Breathing Pacer" subtitle="Default Target 5.4 Breaths/Min · 50/50 Inhale/Exhale">
        <div className="pacer-stack">
          <div className="pacer-toggles">
            <button type="button" className="button-primary pacer-focus-cta" onClick={enterFocusMode}>
              Open Fullscreen Guide
            </button>

            <div className="pacer-mode-toggle" role="group" aria-label="Pacer Visual Mode">
              <button
                type="button"
                className={visualMode === "orb" ? "chip active" : "chip"}
                onClick={() => setVisualMode("orb")}
              >
                Orb Mode
              </button>
              <button
                type="button"
                className={visualMode === "ring" ? "chip active" : "chip"}
                onClick={() => setVisualMode("ring")}
              >
                Ring Mode
              </button>
            </div>

            <button
              type="button"
              className={audioEnabled ? "chip active" : "chip"}
              onClick={() => setAudioEnabled((previous) => !previous)}
            >
              Cue Audio {audioEnabled ? "On" : "Off"}
            </button>
          </div>

          <div className="pacer-visual-wrap">
            {visualMode === "orb" ? (
              <div
                className={`pacer-visual ${inhaleActive ? "inhale" : "exhale"}`}
                style={{ transform: `scale(${scale.toFixed(3)})` }}
              >
                <span>{inhaleActive ? "Inhale" : "Exhale"}</span>
              </div>
            ) : (
              <div
                className={`pacer-ring ${inhaleActive ? "inhale" : "exhale"}`}
                style={{
                  background: `conic-gradient(currentColor ${ringDegrees}deg, rgba(132, 152, 184, 0.2) ${ringDegrees}deg 360deg)`,
                }}
              >
                <div className="pacer-ring-center">{inhaleActive ? "Inhale" : "Exhale"}</div>
              </div>
            )}
          </div>

          <div className="slider-group">
            <label htmlFor="pacer-bpm">Breaths/Min ({bpm.toFixed(1)})</label>
            <input
              id="pacer-bpm"
              type="range"
              min={3.5}
              max={8}
              step={0.1}
              disabled={disabled}
              value={bpm}
              onChange={(event) => onBpmChange(Number(event.target.value))}
            />
          </div>

          <div className="slider-group">
            <label htmlFor="pacer-inhale">Inhale Ratio ({Math.round(inhaleRatio * 100)}%)</label>
            <input
              id="pacer-inhale"
              type="range"
              min={0.3}
              max={0.7}
              step={0.01}
              disabled={disabled}
              value={inhaleRatio}
              onChange={(event) => onInhaleRatioChange(Number(event.target.value))}
            />
          </div>
        </div>
      </Card>

      {focusModeActive && (
        <div className="focus-mode-overlay">
          <div className="focus-bg-shape focus-bg-shape-a" />
          <div className="focus-bg-shape focus-bg-shape-b" />
          <div className="focus-bg-shape focus-bg-shape-c" />

          <div className="focus-overlay-topbar">
            <div className="focus-overlay-status">
              <div className="focus-vitals-row">
                <div className="focus-vital-card">
                  <small>Elapsed</small>
                  <span>{elapsedDisplay}</span>
                </div>
                <div className="focus-vital-card">
                  <small>Latest RR</small>
                  <span>{rrDisplay}</span>
                </div>
                <div className="focus-vital-card">
                  <small>Heart Rate</small>
                  <span>{hrDisplay}</span>
                </div>
                <div className="focus-vital-card">
                  <small>Breathing</small>
                  <span>
                    {inhaleActive ? "Inhale" : "Exhale"} · {bpm.toFixed(1)} / Min
                  </span>
                </div>
              </div>

              <div className="focus-insights-row">
                <div className="focus-coherence-card" aria-label="Live coherence gauge">
                  <small>Live Coherence</small>
                  <div
                    className="focus-coherence-gauge"
                    style={{ ["--coherence-progress" as string]: `${coherenceDegrees}deg` }}
                  >
                    <div className="focus-coherence-gauge-center">
                      <strong>{coherenceRatioDisplay}</strong>
                      <span>Ratio</span>
                    </div>
                  </div>
                  <div className="focus-coherence-meta">
                    <span>{coherencePercentDisplay}</span>
                    <span>{coherenceBandLabel}</span>
                    <span>{coherenceTrendLabel}</span>
                  </div>
                </div>

                <div className="focus-tachogram" aria-label="Live RR Tachogram">
                  <svg viewBox="0 0 520 116" preserveAspectRatio="none">
                    <path
                      className="focus-tachogram-baseline"
                      d="M8 82 L512 82"
                    />
                    {tachogramPath ? (
                      <>
                        <path className="focus-tachogram-line-glow" d={tachogramPath} />
                        <path className="focus-tachogram-line" d={tachogramPath} />
                      </>
                    ) : null}
                  </svg>
                </div>
              </div>
            </div>

            <div className="focus-overlay-actions">
              <button
                type="button"
                className={ambientMusicEnabled ? "chip active" : "chip"}
                onClick={() => setAmbientMusicEnabled((previous) => !previous)}
              >
                Ambient Music {ambientMusicEnabled ? "On" : "Off"}
              </button>
              {running ? (
                onStopSession ? (
                  <button
                    type="button"
                    className="button-secondary focus-session-button"
                    onClick={onStopSession}
                  >
                    Stop Session
                  </button>
                ) : null
              ) : onStartSession ? (
                <button
                  type="button"
                  className="button-primary focus-session-button"
                  onClick={onStartSession}
                  disabled={!canStartSession}
                >
                  Start Session
                </button>
              ) : null}
              <button type="button" className="button-back" onClick={exitFocusMode}>
                Exit
              </button>
            </div>
          </div>

          <div className="focus-guide-center">
            {visualMode === "orb" ? (
              <div
                className={`focus-guide-orb ${inhaleActive ? "inhale" : "exhale"}`}
                style={{ transform: `scale(${(0.92 + (scale - 1) * 0.8).toFixed(3)})` }}
              >
                <div className="focus-guide-label">{inhaleActive ? "Inhale" : "Exhale"}</div>
              </div>
            ) : (
              <div
                className={`focus-guide-ring ${inhaleActive ? "inhale" : "exhale"}`}
                style={{
                  background: `conic-gradient(currentColor ${ringDegrees}deg, rgba(170, 192, 225, 0.16) ${ringDegrees}deg 360deg)`,
                }}
              >
                <div className="focus-guide-ring-center">{inhaleActive ? "Inhale" : "Exhale"}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
