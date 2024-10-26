import {AccessoryDefinition, AccessoryInstance, ServiceResolver} from '../AccessoryDomain';
import {Locale} from '../util/Locale';
import {Logger} from '../PlatformDomain';
import {BatteryData} from '../DataDomain';

export class BatteryAccessory extends AccessoryDefinition {

  constructor(
    protected readonly name: string,
    protected readonly version: number,
    protected readonly locale: Locale,
    protected readonly serviceResolver: ServiceResolver,
    protected readonly log: Logger,
  ) {
    super(name, version, locale, serviceResolver, log);
  }

  update(platformAccessory: AccessoryInstance, data: BatteryData) {
    this.updateBattery(platformAccessory, data);
    super.update(platformAccessory, data);
    this.log.debug(`Accessory ${platformAccessory.context.accessoryId} updated`);
  }

  create(platformAccessory: AccessoryInstance, data: BatteryData) {
    super.create(platformAccessory, data);
    this.createBattery(platformAccessory);
    this.update(platformAccessory, data);
  }

  createBattery(platformAccessory: AccessoryInstance) {
    const service = this.getOrCreateService('Battery', platformAccessory);
    this.updateCharacteristic(service, 'Name', this.getText(this.name+'-battery'));
    this.updateCharacteristic(service, 'StatusLowBattery', 0);
  }

  updateBattery(platformAccessory: AccessoryInstance, data: BatteryData) {
    const service = this.getOrCreateService('Battery', platformAccessory);
    this.updateCharacteristic(service, 'BatteryLevel', data.chargeLevel);
    this.updateCharacteristic(service, 'ChargingState', this.isCharging(data) ? 1 : 0);
  }

  isCharging(data: BatteryData) {
    return data.status === 'CHARGE'
  }
}