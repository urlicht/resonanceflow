import type { BleConnectionStatus } from "../../ble/types";
import { formatSeconds } from "../../utils/time";
import { Card } from "./Card";

interface LiveMetricsProps {
  status: BleConnectionStatus;
  deviceName?: string;
  hr?: number;
  rr?: number;
  elapsedSec: number;
  signalQualityScore?: number;
  signalQualityLabel?: string;
}

export function LiveMetrics({
  status,
  deviceName,
  hr,
  rr,
  elapsedSec,
  signalQualityScore,
  signalQualityLabel,
}: LiveMetricsProps): JSX.Element {
  const hrLabel = typeof hr === "number" ? Math.round(hr).toString() : "--";
  const rrLabel = typeof rr === "number" ? (rr * 1000).toFixed(0) : "--";
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
  const qualityLabel =
    typeof signalQualityScore === "number" ? `${signalQualityScore.toFixed(0)}%` : "--";

  return (
    <div className="metrics-grid live-metrics-grid">
      <Card title="Connection">
        <div className="metric-value">{statusLabel}</div>
        <div className="metric-subtle">{deviceName ?? "No Device"}</div>
      </Card>
      <Card title="Heart Rate">
        <div className="metric-value">{hrLabel}</div>
        <div className="metric-subtle">BPM</div>
      </Card>
      <Card title="Latest RR">
        <div className="metric-value">{rrLabel}</div>
        <div className="metric-subtle">ms</div>
      </Card>
      <Card title="Elapsed Time">
        <div className="metric-value">{formatSeconds(elapsedSec)}</div>
        <div className="metric-subtle">mm:ss</div>
      </Card>
      <Card title="Signal Quality">
        <div className="metric-value">{qualityLabel}</div>
        <div className="metric-subtle">{signalQualityLabel ?? "Searching"}</div>
      </Card>
    </div>
  );
}
