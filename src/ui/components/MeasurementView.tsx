import type { BleConnectionStatus } from "../../ble/types";
import { formatSeconds } from "../../utils/time";
import { Card } from "./Card";
import { LiveMetrics } from "./LiveMetrics";
import { RealtimeCharts } from "./RealtimeCharts";
import { SessionControls } from "./SessionControls";

interface Point {
  t: number;
  v: number;
}

interface MeasurementViewProps {
  running: boolean;
  durationSec: number;
  remainingSec: number;
  elapsedSec: number;
  status: BleConnectionStatus;
  deviceName?: string;
  hr?: number;
  rr?: number;
  signalQualityScore?: number;
  signalQualityLabel?: string;
  hrSeries: Point[];
  rrSeries: Point[];
  onDurationChange: (seconds: number) => void;
  onStart: () => void;
  onStop: () => void;
}

const DURATIONS = [30, 45, 60];

export function MeasurementView({
  running,
  durationSec,
  remainingSec,
  elapsedSec,
  status,
  deviceName,
  hr,
  rr,
  signalQualityScore,
  signalQualityLabel,
  hrSeries,
  rrSeries,
  onDurationChange,
  onStart,
  onStop,
}: MeasurementViewProps): JSX.Element {
  return (
    <div className="view-stack">
      <Card
        title="Measurement"
        subtitle="Guided short recording with automatic post-analysis"
      >
        <div className="duration-buttons">
          {DURATIONS.map((seconds) => (
            <button
              key={seconds}
              type="button"
              className={seconds === durationSec ? "chip active" : "chip"}
              onClick={() => onDurationChange(seconds)}
              disabled={running}
            >
              {seconds}s
            </button>
          ))}
        </div>

        <div className="inline-meta">
          <span>Remaining: {formatSeconds(remainingSec)}</span>
          <span>Target Mode: Short Measurement</span>
        </div>

        <SessionControls running={running} onStart={onStart} onStop={onStop} />
      </Card>

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
