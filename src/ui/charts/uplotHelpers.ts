import type uPlot from "uplot";

interface LinePlotOptions {
  title: string;
  width: number;
  height: number;
  yLabel: string;
  stroke: string;
}

export function createLineOptions(options: LinePlotOptions): uPlot.Options {
  return {
    title: options.title,
    width: options.width,
    height: options.height,
    legend: {
      show: false,
    },
    scales: {
      x: {
        time: false,
      },
      y: {
        auto: true,
      },
    },
    series: [
      {},
      {
        label: options.yLabel,
        stroke: options.stroke,
        width: 2,
      },
    ],
    axes: [
      {
        label: "Time (s)",
        stroke: "#7f8ca1",
        grid: { stroke: "rgba(127, 140, 161, 0.25)" },
      },
      {
        label: options.yLabel,
        stroke: "#7f8ca1",
        grid: { stroke: "rgba(127, 140, 161, 0.25)" },
      },
    ],
    cursor: {
      drag: {
        x: false,
        y: false,
      },
    },
  };
}
