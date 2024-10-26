import {Site, Device} from './DataDomain';
import {Logger} from './PlatformDomain';
import {Locale} from './util/Locale';

export interface AccessoryInstance {
  context: AccessoryContext
  getService(type: any): ServiceInstance | undefined;
  addService(type: any): ServiceInstance;
  removeService(service: ServiceInstance): void
}

export interface ServiceInstance {
  updateCharacteristic(type: any, value: any): void;
  addOptionalCharacteristic(type: any);
  getCharacteristic(type: any): CharacteristicInstance;
}

export interface CharacteristicInstance {
  setProps(props: any): CharacteristicInstance;
  value: any;
  onSet(handler: (value) => void): CharacteristicInstance;
}

export interface ServiceResolver {
  resolveService(type: ServiceType);
  resolveCharacteristic(type: CharacteristicType);
}

export type ServiceType =
  'AccessoryInformation' |
  'Battery'

export type CharacteristicType =
  'Manufacturer' |
  'Model' |
  'SerialNumber' |
  'Name' |
  'StatusLowBattery' |
  'BatteryLevel' |
  'ChargingState'

export interface AccessoryContext {
  accessoryId: string
  lastUpdate: number //epoch
  version: number
  siteId: string
  serialNumber: string
  data: string[]
}

export abstract class AccessoryDefinition {
  protected constructor(
    protected readonly name: string,
    protected readonly version: number,
    protected readonly locale: Locale,
    protected readonly serviceResolver: ServiceResolver,
    protected readonly log: Logger,
  ) {}

  public buildIdentifier(device: Device): string {
    return `${device?.serialNumber || 'undefined'}::${this.name}`;
  }

  public buildName(data) {
    return `${this.name}::${Date.now()}`;
  }

  public isCurrentVersion(platformAccessory: AccessoryInstance): boolean {
    return platformAccessory.context.version >= this.version;
  }

  public update(platformAccessory: AccessoryInstance, data): void {
    platformAccessory.context.lastUpdate = Date.now();
  }

  public create(platformAccessory: AccessoryInstance, data: {site: Site, device: Device}): void {
    platformAccessory.context.accessoryId = this.buildIdentifier(data.device);
    platformAccessory.context.version = this.version;
    platformAccessory.context.siteId = data.site.id;
    platformAccessory.context.serialNumber = data.device.serialNumber;

    const accessoryInformationService = this.getOrCreateService('AccessoryInformation', platformAccessory);
    accessoryInformationService.updateCharacteristic(this.serviceResolver.resolveCharacteristic('Manufacturer'), data.device.manufacturer);
    accessoryInformationService.updateCharacteristic(this.serviceResolver.resolveCharacteristic('Model'), data.device.model);
    accessoryInformationService.updateCharacteristic(this.serviceResolver.resolveCharacteristic('SerialNumber'), data.device.serialNumber);

    this.update(platformAccessory, data);
  }

  protected getOrCreateService(type: ServiceType, platformAccessory: AccessoryInstance) {
    const resolvedType = this.serviceResolver.resolveService(type);
    return platformAccessory.getService(resolvedType) || platformAccessory.addService(resolvedType);
  }

  protected removeService(type: ServiceType, platformAccessory: AccessoryInstance) {
    const resolvedType = this.serviceResolver.resolveService(type);
    const service = platformAccessory.getService(resolvedType);
    if (service) {
      platformAccessory.removeService(service);
    }
  }

  protected updateCharacteristic(service: ServiceInstance, name: CharacteristicType, value, props: object | undefined = undefined) {
    const characteristic = this.serviceResolver.resolveCharacteristic(name);
    service.updateCharacteristic(characteristic, value);
    if (props) {
      service.getCharacteristic(characteristic).setProps(props);
    }
  }

  protected getText(key: string): string {
    return this.locale.text(key, '') || '';
  }

  protected putData(platformAccessory: AccessoryInstance, key: string, data: any): void {
    if (!platformAccessory.context.data) {
      platformAccessory.context.data = [];
    }
    platformAccessory.context.data[key] = data;
  }

  protected getData(platformAccessory: AccessoryInstance, key: string): any | undefined {
    if (!platformAccessory.context.data) {
      return undefined;
    }
    return platformAccessory.context.data[key];
  }
}