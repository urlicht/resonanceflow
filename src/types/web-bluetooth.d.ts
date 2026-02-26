// minimal web bluetooth declarations for environments where lib.dom does not include them

declare global {
  type BluetoothServiceUUID = number | string;
  type BluetoothCharacteristicUUID = number | string;

  interface BluetoothLEScanFilter {
    services?: BluetoothServiceUUID[];
    name?: string;
    namePrefix?: string;
  }

  interface RequestDeviceOptions {
    filters?: BluetoothLEScanFilter[];
    optionalServices?: BluetoothServiceUUID[];
    acceptAllDevices?: boolean;
  }

  interface Navigator {
    bluetooth: Bluetooth;
  }

  interface Bluetooth extends EventTarget {
    requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>;
    getAvailability?(): Promise<boolean>;
  }

  interface BluetoothDevice extends EventTarget {
    id: string;
    name?: string;
    gatt?: BluetoothRemoteGATTServer;
  }

  interface BluetoothRemoteGATTServer {
    connected: boolean;
    connect(): Promise<BluetoothRemoteGATTServer>;
    disconnect(): void;
    getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
  }

  interface BluetoothRemoteGATTService {
    getCharacteristic(
      characteristic: BluetoothCharacteristicUUID,
    ): Promise<BluetoothRemoteGATTCharacteristic>;
  }

  interface BluetoothRemoteGATTCharacteristic extends EventTarget {
    value: DataView | null;
    startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  }
}

export {};
