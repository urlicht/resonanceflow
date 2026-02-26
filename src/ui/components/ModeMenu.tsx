import type { SessionMode } from "../../session/models";
import { Card } from "./Card";

interface ModeMenuProps {
  onSelect: (mode: SessionMode) => void;
}

const MODE_COPY: Record<SessionMode, { title: string; description: string }> = {
  measurement: {
    title: "Measurement",
    description: "Short guided snapshot with automatic HRV analysis.",
  },
  hrvb: {
    title: "HRVB Session",
    description: "Realtime biofeedback session with breathing pacer and live charts.",
  },
  calibration: {
    title: "Calibration",
    description: "Scan breathing frequencies and recommend your resonance frequency.",
  },
};

export function ModeMenu({ onSelect }: ModeMenuProps): JSX.Element {
  return (
    <div className="mode-grid">
      {(Object.keys(MODE_COPY) as SessionMode[]).map((mode) => (
        <Card key={mode} className="mode-card">
          <button type="button" className="mode-button" onClick={() => onSelect(mode)}>
            <span className="mode-title">{MODE_COPY[mode].title}</span>
            <span className="mode-description">{MODE_COPY[mode].description}</span>
          </button>
        </Card>
      ))}
    </div>
  );
}
