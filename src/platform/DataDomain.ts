export interface DataFetcher {
  on<T>(eventName: 'battery' | 'error', listener: (data: T) => void): this;
  start(): void
  stop(): void
}

export interface Site {
  id: string;
  name: string;
}

export interface Device {
  serialNumber: string;
  manufacturer: string;
  model: string;
}

export interface BatteryData {
  site: Site;
  device: Device
  status: string
  chargeLevel: number
}