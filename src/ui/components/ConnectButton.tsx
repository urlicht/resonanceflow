import type { BleConnectionStatus } from "../../ble/types";

interface ConnectButtonProps {
  status: BleConnectionStatus;
  deviceName?: string;
  error?: string;
  onConnect: () => Promise<void>;
  onDisconnect: () => void;
}

function statusLabel(status: BleConnectionStatus): string {
  switch (status) {
    case "unsupported":
      return "Bluetooth Unavailable";
    case "connecting":
      return "Connecting";
    case "connected":
      return "Connected";
    case "error":
      return "Connection Error";
    default:
      return "Disconnected";
  }
}

export function ConnectButton({
  status,
  deviceName,
  error,
  onConnect,
  onDisconnect,
}: ConnectButtonProps): JSX.Element {
  const disabled = status === "unsupported" || status === "connecting";
  const connected = status === "connected";

  return (
    <div className="connect-stack">
      <button
        type="button"
        className={connected ? "button-secondary" : "button-primary"}
        disabled={disabled}
        onClick={connected ? onDisconnect : () => void onConnect()}
      >
        {connected ? "Disconnect" : "Connect"}
      </button>
      <span className="status-line">
        {statusLabel(status)}
        {deviceName ? ` · ${deviceName}` : ""}
      </span>
      {error && <span className="status-error">{error}</span>}
    </div>
  );
}
