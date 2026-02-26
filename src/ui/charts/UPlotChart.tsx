import { useEffect, useRef } from "react";
import uPlot from "uplot";
import { createLineOptions } from "./uplotHelpers";

interface UPlotChartProps {
  title: string;
  yLabel: string;
  stroke?: string;
  height?: number;
  data: [number[], number[]];
  tooltipFormatter?: (x: number, y: number) => string;
}

export function UPlotChart({
  title,
  yLabel,
  stroke = "#2d6cdf",
  height = 240,
  data,
  tooltipFormatter,
}: UPlotChartProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<uPlot | null>(null);
  const tooltipFormatterRef = useRef<typeof tooltipFormatter>(tooltipFormatter);

  useEffect(() => {
    tooltipFormatterRef.current = tooltipFormatter;
  }, [tooltipFormatter]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const width = Math.max(320, containerRef.current.clientWidth);
    const chart = new uPlot(
      createLineOptions({
        title,
        yLabel,
        stroke,
        width,
        height,
      }),
      [[], []],
      containerRef.current,
    );

    chartRef.current = chart;

    const observer = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) {
        return;
      }
      chartRef.current.setSize({
        width: Math.max(320, containerRef.current.clientWidth),
        height,
      });
    });

    observer.observe(containerRef.current);

    const overlay = chart.root.querySelector<HTMLElement>(".u-over");
    let tooltip: HTMLDivElement | null = null;
    const enableTooltip = Boolean(tooltipFormatterRef.current);

    const handleMouseMove = (event: MouseEvent): void => {
      if (!tooltip || !overlay) {
        return;
      }

      const overlayRect = overlay.getBoundingClientRect();
      const xPx = event.clientX - overlayRect.left;
      const yPx = event.clientY - overlayRect.top;

      if (xPx < 0 || xPx > overlayRect.width || yPx < 0 || yPx > overlayRect.height) {
        tooltip.style.opacity = "0";
        return;
      }

      const index = chart.posToIdx(xPx);
      if (index < 0) {
        tooltip.style.opacity = "0";
        return;
      }

      const xValues = chart.data[0] as number[];
      const yValues = chart.data[1] as number[];
      const x = xValues[index];
      const y = yValues[index];

      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        tooltip.style.opacity = "0";
        return;
      }

      const formatter = tooltipFormatterRef.current;
      const tooltipText = formatter ? formatter(x, y) : `${x.toFixed(3)}, ${y.toFixed(3)}`;
      tooltip.textContent = tooltipText;
      tooltip.style.opacity = "1";

      const tooltipX = Math.max(10, Math.min(xPx + 10, overlay.clientWidth - 220));
      const tooltipY = Math.max(10, yPx - 56);
      tooltip.style.left = `${tooltipX}px`;
      tooltip.style.top = `${tooltipY}px`;
    };

    const handleMouseLeave = (): void => {
      if (tooltip) {
        tooltip.style.opacity = "0";
      }
    };

    if (overlay && enableTooltip) {
      tooltip = document.createElement("div");
      tooltip.className = "uplot-tooltip";
      overlay.appendChild(tooltip);
      overlay.addEventListener("mousemove", handleMouseMove);
      overlay.addEventListener("mouseleave", handleMouseLeave);
    }

    return () => {
      if (overlay && enableTooltip) {
        overlay.removeEventListener("mousemove", handleMouseMove);
        overlay.removeEventListener("mouseleave", handleMouseLeave);
      }
      observer.disconnect();
      chart.destroy();
      chartRef.current = null;
    };
  }, [title, yLabel, stroke, height]);

  useEffect(() => {
    chartRef.current?.setData(data);
  }, [data]);

  return <div className="uplot-wrapper" ref={containerRef} />;
}
