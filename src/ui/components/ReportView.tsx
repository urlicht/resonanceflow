import type { AnalysisResult, CalibrationSummary } from "../../analysis/types";
import type { Session } from "../../session/models";
import { UPlotChart } from "../charts/UPlotChart";
import { Card } from "./Card";

interface ReportViewProps {
  session: Session;
  analysis: AnalysisResult;
  targetHz: number;
  calibration?: CalibrationSummary;
  onBack: () => void;
  onExportJson: () => void;
  onExportCsv: () => void;
}

interface MetricTitleProps {
  label: string;
  description: string;
}

function MetricTitle({ label, description }: MetricTitleProps): JSX.Element {
  return (
    <span className="metric-title-wrap">
      {label}
      <span className="metric-info">
        <button type="button" className="info-icon" aria-label={`${label} description`}>
          i
        </button>
        <span className="info-tooltip" role="tooltip">
          {description}
        </span>
      </span>
    </span>
  );
}

function fmt(value: number, digits = 3): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "0.000";
}

function hrSeriesFromSession(session: Session): [number[], number[]] {
  const rows = session.rawEvents.filter((event) => Number.isFinite(event.hr));
  if (rows.length === 0) {
    return [[], []];
  }

  const t0 = rows[0].t_ms;
  return [
    rows.map((event) => (event.t_ms - t0) / 1000),
    rows.map((event) => event.hr ?? 0),
  ];
}

function rrSeriesFromSession(session: Session): [number[], number[]] {
  const t: number[] = [];
  const rr: number[] = [];

  let elapsed = 0;
  for (const event of session.rawEvents) {
    for (const rrValue of event.rr_s ?? []) {
      elapsed += rrValue;
      t.push(elapsed);
      rr.push(rrValue);
    }
  }

  return [t, rr];
}

export function ReportView({
  session,
  analysis,
  targetHz,
  calibration,
  onBack,
  onExportJson,
  onExportCsv,
}: ReportViewProps): JSX.Element {
  const { metrics, psd } = analysis;

  return (
    <div className="view-stack">
      <Card
        title="Post-Session Report"
        action={
          <div className="report-header-actions">
            <button type="button" className="button-secondary" onClick={onExportJson}>
              Export JSON
            </button>
            <button type="button" className="button-secondary" onClick={onExportCsv}>
              Export CSV
            </button>
            <button type="button" className="button-back" onClick={onBack}>
              &larr; Back
            </button>
          </div>
        }
      >
        <div className="metrics-grid report-cards">
          <Card
            title={<MetricTitle label="Mean HR" description="Average heart rate across the session." />}
          >
            <div className="metric-value">{fmt(metrics.meanHr, 1)}</div>
            <div className="metric-subtle">BPM</div>
          </Card>
          <Card
            title={
              <MetricTitle
                label="Mean RR"
                description="Average beat-to-beat interval. Higher generally indicates lower heart rate."
              />
            }
          >
            <div className="metric-value">{fmt(metrics.meanRr * 1000, 1)}</div>
            <div className="metric-subtle">ms</div>
          </Card>
          <Card
            title={
              <MetricTitle
                label="RMSSD"
                description="Short-term HRV based on consecutive RR interval differences."
              />
            }
          >
            <div className="metric-value">{fmt(metrics.rmssd * 1000, 1)}</div>
            <div className="metric-subtle">ms</div>
          </Card>
          <Card
            title={
              <MetricTitle
                label="SDNN"
                description="Overall HRV represented by standard deviation of normal RR intervals."
              />
            }
          >
            <div className="metric-value">{fmt(metrics.sdnn * 1000, 1)}</div>
            <div className="metric-subtle">ms</div>
          </Card>
          <Card
            title={
              <MetricTitle
                label="PNN50"
                description="Percentage of adjacent RR interval changes greater than 50 ms."
              />
            }
          >
            <div className="metric-value">{fmt(metrics.pnn50, 1)}</div>
            <div className="metric-subtle">%</div>
          </Card>
          <Card
            title={
              <MetricTitle
                label="Coherence Score"
                description="Target-band breathing power divided by total LF-HF band power (0.04-0.4 Hz)."
              />
            }
          >
            <div className="metric-value">{fmt(metrics.coherenceScore, 3)}</div>
            <div className="metric-subtle">Ratio</div>
          </Card>
        </div>

        <div className="inline-meta">
          <span>Target Frequency: {targetHz.toFixed(3)} Hz ({(targetHz * 60).toFixed(1)} BPM)</span>
          <span>Estimated Peak: {metrics.peakFrequencyHz.toFixed(3)} Hz</span>
          <span>Peak Power: {metrics.peakPower.toFixed(5)}</span>
        </div>
      </Card>

      {calibration && calibration.scanned.length > 0 && (
        <Card title="Calibration Summary" subtitle="Scanned frequencies and per-frequency score">
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
              {calibration.scanned.map((row) => (
                <tr key={row.frequencyHz}>
                  <td>{row.frequencyHz.toFixed(3)}</td>
                  <td>{row.breathsPerMin.toFixed(1)}</td>
                  <td>{row.score.toFixed(3)}</td>
                  <td>{row.peakFrequencyHz.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {calibration.best && (
            <p className="best-line">
              Recommended Best Frequency: {calibration.best.frequencyHz.toFixed(3)} Hz (
              {calibration.best.breathsPerMin.toFixed(1)} BPM)
            </p>
          )}
        </Card>
      )}

      <div className="chart-grid">
        <Card title="PSD">
          <UPlotChart
            title="Frequency-Domain PSD"
            yLabel="Power"
            stroke="#da7f3a"
            data={[psd.f, psd.p]}
            tooltipFormatter={(frequencyHz, power) =>
              `Frequency: ${frequencyHz.toFixed(3)} Hz (${(frequencyHz * 60).toFixed(1)} BPM)\nPower: ${power.toExponential(3)}`
            }
          />
        </Card>
        <Card title="HR Over Time">
          <UPlotChart title="HR Over Time" yLabel="BPM" stroke="#5a7bff" data={hrSeriesFromSession(session)} />
        </Card>
      </div>

      <Card title="RR Over Time">
        <UPlotChart title="RR Over Time" yLabel="Seconds" stroke="#2ba37a" data={rrSeriesFromSession(session)} />
      </Card>
    </div>
  );
}
