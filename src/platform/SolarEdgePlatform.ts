import {
  API,
  APIEvent,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig
} from 'homebridge';
import {SolarEdgeApiFetcher} from './myuplink/SolarEdgeApiFetcher';
import * as dataDomain from './DataDomain';
import {BatteryData, DataFetcher} from './DataDomain';
import {Locale} from './util/Locale';
import {
  AccessoryContext,
  AccessoryDefinition,
  AccessoryInstance,
  ServiceResolver,
  ServiceType,
} from './AccessoryDomain';
import {BatteryAccessory} from './nibeaccessory/BatteryAccessory';

export const PLATFORM_NAME = 'SolarEdge';
export const PLUGIN_NAME = 'homebridge-solaredge';

/**
 * SolarEdgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class SolarEdgePlatform implements DynamicPlatformPlugin {

  private readonly dataFetcher: DataFetcher;
  private readonly accessories: AccessoryInstance[] = [];
  private readonly accessoryDefinitions: AccessoryDefinition[];
  private readonly locale: Locale;
  private readonly serviceResolver: ServiceResolver;

  constructor(private readonly log: Logger, private readonly config: PlatformConfig, private readonly api: API) {
    this.locale = new Locale(config.language, log);

    this.serviceResolver = {
      resolveCharacteristic(type: any) {
        return api.hap.Characteristic[type];
      },
      resolveService(type: ServiceType) {
        return api.hap.Service[type];
      },
    } as ServiceResolver;

    this.dataFetcher = new SolarEdgeApiFetcher({
      apiKey: config.apiKey,
      interval: 60 * 15,
      language: config.language,
      showApiResponse: config.showApiResponse || false,
    }, log);

    this.accessoryDefinitions = [
      new BatteryAccessory('battery', 2, this.locale, this.serviceResolver, this.log),
    ];

    this.log.debug('Finished initializing platform');

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
      log.debug('Executed didFinishLaunching callback');
      this.dataFetcher.start();
      this.dataFetcher
        .on<dataDomain.BatteryData>('battery', (data) => {
          this.handleData(data);
        }).on('error', (data) => {
          this.log.error('Error:', data);
        });
    });

    this.api.on(APIEvent.SHUTDOWN, () => {
      this.dataFetcher.stop();
    });
  }

  public handleData(data: BatteryData): void {
    const touchedAccessoriesIds = Array<string>();

    this.accessoryDefinitions.forEach(accessoryDefinition => {
      const accessoryId = accessoryDefinition.buildIdentifier(data.device);
      const platformAccessory = this.accessories.find(a => a.context.accessoryId === accessoryId);
      if (platformAccessory) {
        this.updateAccessory(accessoryDefinition, platformAccessory, data);
      } else {
        this.createAccessory(accessoryId, accessoryDefinition, data);
      }
      touchedAccessoriesIds.push(accessoryId);
    });

    // this.removeNotExistingAccessories(data.system.systemId, data.device.id, touchedAccessoriesIds);
  }

  private createAccessory(accessoryId: string, accessoryDefinition: AccessoryDefinition, data) {
    this.log.info('Adding new accessory: [%s]', accessoryId);
    const platformAccessory = new this.api.platformAccessory<AccessoryContext>(
      accessoryDefinition.buildName(data),
      this.api.hap.uuid.generate(PLUGIN_NAME + '-' + accessoryId),
    ) as AccessoryInstance;
    accessoryDefinition.create(platformAccessory, data);
    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [platformAccessory as PlatformAccessory<AccessoryContext>]);
    this.accessories.push(platformAccessory);
  }

  private updateAccessory(accessoryDefinition: AccessoryDefinition, platformAccessory: AccessoryInstance, data) {
    if (!accessoryDefinition.isCurrentVersion(platformAccessory)) {
      this.log.info('Old version of accessory, recreating: [%s]',
        platformAccessory.context.accessoryId);
      accessoryDefinition.create(platformAccessory, data);
    }

    this.log.debug('Updating accessory: [%s]', platformAccessory.context.accessoryId);
    accessoryDefinition.update(platformAccessory, data);
  }

  private removeNotExistingAccessories(siteId: string, serialNumber: string, existingAccessoriesIds: string[]) {
    this.accessories
      .filter(accessory => accessory.context.siteId === siteId)
      .filter(accessory => accessory.context.serialNumber === serialNumber)
      .filter(accessory => !existingAccessoriesIds.includes(accessory.context.accessoryId))
      .forEach(accessory => this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory as PlatformAccessory<AccessoryContext>]));
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory<AccessoryContext>) {
    this.log.info( `Loading accessory from cache: [${accessory.displayName}], UUID: [${accessory.UUID}]`);
    this.accessories.push(accessory as AccessoryInstance);
  }
}
