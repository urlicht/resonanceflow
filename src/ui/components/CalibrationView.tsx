import type { BleConnectionStatus } from "../../ble/types";
import type { CalibrationSummary } from "../../analysis/types";
import { BreathingPacer } from "./BreathingPacer";
import { Card } from "./Card";
import { LiveMetrics } from "./LiveMetrics";
import { RealtimeCharts } from "./RealtimeCharts";
import { SessionControls } from "./SessionControls";

interface Point {
  t: number;
  v: number;
}

interface CalibrationViewProps {
  running: boolean;
  frequenciesHz: number[];
  currentIndex: number;
  stepRemainingSec: number;
  elapsedSec: number;
  inhaleRatio: number;
  status: BleConnectionStatus;
  deviceName?: string;
  hr?: number;
  rr?: number;
  signalQualityScore?: number;
  signalQualityLabel?: string;
  liveCoherenceScore?: number;
  liveCoherenceTrend?: "rising" | "steady" | "falling";
  hrSeries: Point[];
  rrSeries: Point[];
  summary?: CalibrationSummary;
  onStart: () => void;
  onStop: () => void;
}

export function CalibrationView({
  running,
  frequenciesHz,
  currentIndex,
  stepRemainingSec,
  elapsedSec,
  inhaleRatio,
  status,
  deviceName,
  hr,
  rr,
  signalQualityScore,
  signalQualityLabel,
  liveCoherenceScore,
  liveCoherenceTrend,
  hrSeries,
  rrSeries,
  summary,
  onStart,
  onStop,
}: CalibrationViewProps): JSX.Element {
  const activeFrequency = frequenciesHz[Math.min(currentIndex, frequenciesHz.length - 1)] ?? 0;

  return (
    <div className="view-stack">
      <Card title="Calibration" subtitle="Scan frequencies and identify max coherence response">
        <div className="inline-meta">
          <span>
            Step {Math.min(currentIndex + 1, frequenciesHz.length)} / {frequenciesHz.length}
          </span>
          <span>
            Active {activeFrequency.toFixed(3)} Hz ({(activeFrequency * 60).toFixed(1)} BPM)
          </span>
          <span>Step Remaining {stepRemainingSec}s</span>
        </div>

        <SessionControls running={running} onStart={onStart} onStop={onStop} />
      </Card>

      <BreathingPacer
        bpm={activeFrequency * 60}
        inhaleRatio={inhaleRatio}
        onBpmChange={() => undefined}
        onInhaleRatioChange={() => undefined}
        disabled
        running={running}
        elapsedSec={elapsedSec}
        hr={hr}
        rr={rr}
        rrSeries={rrSeries}
        liveCoherenceScore={liveCoherenceScore}
        liveCoherenceTrend={liveCoherenceTrend}
        canStartSession={status === "connected"}
        onStartSession={onStart}
        onStopSession={onStop}
      />

      {summary && summary.scanned.length > 0 && (
        <Card title="Calibration Result" subtitle="Coherence score by scanned frequency">
          <table className="simple-table">
            <thead>
              <tr>
                <th>Frequency (Hz)</th>
                <th>Breaths/Min</th>
                <th>Score</th>
                <th>Peak (Hz)</th>
              </tr>
            </thead>
            <tbody>
              {summary.scanned.map((row) => (
                <tr key={row.frequencyHz}>
                  <td>{row.frequencyHz.toFixed(3)}</td>
                  <td>{row.breathsPerMin.toFixed(1)}</td>
                  <td>{row.score.toFixed(3)}</td>
                  <td>{row.peakFrequencyHz.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {summary.best && (
            <p className="best-line">
              Recommended: {summary.best.frequencyHz.toFixed(3)} Hz (
              {summary.best.breathsPerMin.toFixed(1)} BPM)
            </p>
          )}
        </Card>
      )}

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
