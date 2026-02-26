import { parseHrMeasurement } from "./parseHrMeasurement";
import {
  HEART_RATE_MEASUREMENT_UUID,
  HEART_RATE_SERVICE_UUID,
  type BleDeviceInfo,
} from "./types";
import type { RawEvent } from "../session/models";

type MeasurementListener = (event: RawEvent) => void;
type DisconnectListener = () => void;

export class HrService {
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private measurementListener: MeasurementListener | null = null;
  private disconnectListener: DisconnectListener | null = null;
  private readonly boundDisconnected = this.onDisconnected.bind(this);
  private readonly boundMeasurement = this.onMeasurement.bind(this);

  async connect(
    onMeasurement: MeasurementListener,
    onDisconnect?: DisconnectListener,
  ): Promise<BleDeviceInfo> {
    if (!navigator.bluetooth) {
      throw new Error("Web Bluetooth is not available in this browser/environment.");
    }

    this.measurementListener = onMeasurement;
    this.disconnectListener = onDisconnect ?? null;

    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [HEART_RATE_SERVICE_UUID] }],
      optionalServices: [HEART_RATE_SERVICE_UUID],
    });

    this.device.addEventListener("gattserverdisconnected", this.boundDisconnected);

    if (!this.device.gatt) {
      throw new Error("Selected device has no GATT server.");
    }

    const server = await this.device.gatt.connect();
    const service = await server.getPrimaryService(HEART_RATE_SERVICE_UUID);
    const characteristic = await service.getCharacteristic(HEART_RATE_MEASUREMENT_UUID);

    this.characteristic = characteristic;
    this.characteristic.addEventListener("characteristicvaluechanged", this.boundMeasurement);
    await this.characteristic.startNotifications();

    return {
      id: this.device.id,
      name: this.device.name ?? "unknown device",
    };
  }

  disconnect(): void {
    if (this.characteristic) {
      this.characteristic.removeEventListener(
        "characteristicvaluechanged",
        this.boundMeasurement,
      );
      void this.characteristic.stopNotifications().catch(() => undefined);
      this.characteristic = null;
    }

    if (this.device) {
      this.device.removeEventListener("gattserverdisconnected", this.boundDisconnected);
      if (this.device.gatt?.connected) {
        this.device.gatt.disconnect();
      }
      this.device = null;
    }
  }

  private onMeasurement(event: Event): void {
    const target = event.target as BluetoothRemoteGATTCharacteristic | null;
    const value = target?.value;
    if (!value || !this.measurementListener) {
      return;
    }

    try {
      const parsed = parseHrMeasurement(value);
      this.measurementListener({
        t_ms: Date.now(),
        hr: parsed.hr,
        rr_s: parsed.rr_s,
      });
    } catch (error) {
      console.error("failed to parse heart rate measurement", error);
    }
  }

  private onDisconnected(): void {
    this.characteristic?.removeEventListener(
      "characteristicvaluechanged",
      this.boundMeasurement,
    );
    this.characteristic = null;
    this.device = null;

    if (this.disconnectListener) {
      this.disconnectListener();
    }
  }
}
