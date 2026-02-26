import { Card } from "./Card";
import { UPlotChart } from "../charts/UPlotChart";

interface Point {
  t: number;
  v: number;
}

interface RealtimeChartsProps {
  hr: Point[];
  rr: Point[];
}

function toSeries(points: Point[]): [number[], number[]] {
  if (points.length === 0) {
    return [[], []];
  }

  const t0 = points[0].t;
  return [
    points.map((point) => point.t - t0),
    points.map((point) => point.v),
  ];
}

export function RealtimeCharts({ hr, rr }: RealtimeChartsProps): JSX.Element {
  return (
    <div className="chart-grid">
      <Card title="Live HR">
        <UPlotChart title="HR" yLabel="BPM" stroke="#5a7bff" data={toSeries(hr)} />
      </Card>
      <Card title="Live RR Tachogram">
        <UPlotChart title="RR" yLabel="Seconds" stroke="#2ba37a" data={toSeries(rr)} />
      </Card>
    </div>
  );
}
