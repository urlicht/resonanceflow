import type { BleConnectionStatus } from "../../ble/types";
import { formatSeconds } from "../../utils/time";
import { BreathingPacer } from "./BreathingPacer";
import { Card } from "./Card";
import { LiveMetrics } from "./LiveMetrics";
import { RealtimeCharts } from "./RealtimeCharts";
import { SessionControls } from "./SessionControls";

interface Point {
  t: number;
  v: number;
}

interface HRVBSessionViewProps {
  running: boolean;
  elapsedSec: number;
  status: BleConnectionStatus;
  deviceName?: string;
  hr?: number;
  rr?: number;
  signalQualityScore?: number;
  signalQualityLabel?: string;
  hrSeries: Point[];
  rrSeries: Point[];
  bpm: number;
  inhaleRatio: number;
  timerEnabled: boolean;
  timerDurationSec: number;
  timerRemainingSec: number;
  onBpmChange: (value: number) => void;
  onInhaleRatioChange: (value: number) => void;
  onTimerEnabledChange: (enabled: boolean) => void;
  onTimerDurationSecChange: (seconds: number) => void;
  onStart: () => void;
  onStop: () => void;
}

export function HRVBSessionView({
  running,
  elapsedSec,
  status,
  deviceName,
  hr,
  rr,
  signalQualityScore,
  signalQualityLabel,
  hrSeries,
  rrSeries,
  bpm,
  inhaleRatio,
  timerEnabled,
  timerDurationSec,
  timerRemainingSec,
  onBpmChange,
  onInhaleRatioChange,
  onTimerEnabledChange,
  onTimerDurationSecChange,
  onStart,
  onStop,
}: HRVBSessionViewProps): JSX.Element {
  const timerOptionsSec = [300, 600, 900, 1200];
  const timerMinutes = Math.max(1, Math.round(timerDurationSec / 60));

  return (
    <div className="view-stack">
      <div className="session-header-row">
        <Card title="HRVB Session" subtitle="Live biofeedback session controls">
          <SessionControls running={running} onStart={onStart} onStop={onStop} />
        </Card>

        <Card title="Session Config" subtitle="Configure optional auto-stop timer for this session">
          <div className="session-config-grid">
            <div className="duration-buttons">
              <button
                type="button"
                className={!timerEnabled ? "chip active" : "chip"}
                disabled={running}
                onClick={() => onTimerEnabledChange(false)}
              >
                No Timer
              </button>
              <button
                type="button"
                className={timerEnabled ? "chip active" : "chip"}
                disabled={running}
                onClick={() => onTimerEnabledChange(true)}
              >
                Use Timer
              </button>
            </div>

            {timerEnabled && (
              <>
                <div className="duration-buttons">
                  {timerOptionsSec.map((seconds) => (
                    <button
                      key={seconds}
                      type="button"
                      className={timerDurationSec === seconds ? "chip active" : "chip"}
                      disabled={running}
                      onClick={() => onTimerDurationSecChange(seconds)}
                    >
                      {Math.round(seconds / 60)} Min
                    </button>
                  ))}
                </div>

                <div className="session-timer-custom">
                  <label htmlFor="session-timer-minutes">Custom Timer (Minutes)</label>
                  <div className="session-timer-input-row">
                    <input
                      id="session-timer-minutes"
                      type="range"
                      min={1}
                      max={180}
                      step={1}
                      disabled={running}
                      value={timerMinutes}
                      onChange={(event) => onTimerDurationSecChange(Number(event.target.value) * 60)}
                    />
                    <input
                      type="number"
                      min={1}
                      max={180}
                      step={1}
                      disabled={running}
                      value={timerMinutes}
                      onChange={(event) => {
                        const parsed = Number(event.target.value);
                        if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 180) {
                          onTimerDurationSecChange(Math.round(parsed) * 60);
                        }
                      }}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="inline-meta">
              <span>Elapsed: {formatSeconds(elapsedSec)}</span>
              {timerEnabled ? (
                <span>Timer Remaining: {formatSeconds(timerRemainingSec)}</span>
              ) : (
                <span>Timer: Off (Manual Stop)</span>
              )}
            </div>
          </div>
        </Card>
      </div>

      <BreathingPacer
        bpm={bpm}
        inhaleRatio={inhaleRatio}
        onBpmChange={onBpmChange}
        onInhaleRatioChange={onInhaleRatioChange}
        running={running}
        elapsedSec={elapsedSec}
        hr={hr}
        rr={rr}
        rrSeries={rrSeries}
        canStartSession={status === "connected"}
        onStartSession={onStart}
        onStopSession={onStop}
      />

      <LiveMetrics
        status={status}
        deviceName={deviceName}
        hr={hr}
        rr={rr}
        elapsedSec={elapsedSec}
        signalQualityScore={signalQualityScore}
        signalQualityLabel={signalQualityLabel}
      />
      <RealtimeCharts hr={hrSeries} rr={rrSeries} />
    </div>
  );
}
