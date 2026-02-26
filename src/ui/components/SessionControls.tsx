interface SessionControlsProps {
  running: boolean;
  onStart: () => void;
  onStop: () => void;
}

export function SessionControls({
  running,
  onStart,
  onStop,
}: SessionControlsProps): JSX.Element {
  return (
    <div className="session-controls">
      <button type="button" className="button-primary" onClick={onStart} disabled={running}>
        Start
      </button>
      <button type="button" className="button-secondary" onClick={onStop} disabled={!running}>
        Stop
      </button>
    </div>
  );
}
