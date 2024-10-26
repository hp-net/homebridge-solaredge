import axios, {AxiosError} from 'axios';
import {EventEmitter} from 'events';
import * as dataDomain from '../DataDomain';
import {BatteryData, DataFetcher} from '../DataDomain';
import {Logger} from '../PlatformDomain';
import * as api from './SolarEdgeApiModel';
import {Site} from './SolarEdgeApiModel';
import {Cache} from '../util/Cache';

interface Options {
    apiKey: string;
    interval: number;
    language: string;
    showApiResponse: boolean;
}

const consts = {
  baseUrl: 'https://monitoringapi.solaredge.com',
  timeout: 45000,
  userAgent: 'homebridge-solaredge',
};

export class SolarEdgeApiFetcher extends EventEmitter implements DataFetcher {
  private options: Options;
  private log: Logger;
  private interval: NodeJS.Timeout | null | undefined;
  private active: boolean | undefined;
  private sites: api.Site[] | null | undefined;
  private cache: Cache = new Cache();

  constructor(options: Options, log: Logger) {
    super();

    this.options = options;
    this.log = log;

    axios.defaults.baseURL = consts.baseUrl;
    axios.defaults.headers.common['user-agent'] = consts.userAgent;
    axios.defaults.timeout = consts.timeout;
  }

  start(): void {
    if (this.interval != null) {
      return;
    }

    this.active = false;

    const exec = (): void => {
      if (this.active) {
        return;
      }
      this.active = true;
      this.fetch().then(() => {
        this.active = false;
      });
    };
    this.interval = setInterval(exec, <number>this.options.interval * 1000);

    exec();
  }

  stop(): void {
    if (this.interval == null) {
      return;
    }
    clearInterval(this.interval);
    this.interval = null;
  }

  private async fetch(): Promise<void> {
    this.log.debug('Fetch data.');
    try {
      if (this.sites == null) {
        this.sites = await this.fetchSites();
      }

      for (const site of this.sites) {
        try {
          const powerFlow = await this.fetchPowerFlow(site);
          const inventory = await this.fetchInventory(site);

          const battery = this.mapBattery(site, powerFlow, inventory.batteries);
          if (battery) {
            this.log.debug(`Prepared battery data:\n${JSON.stringify(battery)}`);
            this._onBatteryData(battery);
          }
        } catch (error) {
          this._onError(error);
        }
      }

      this.log.debug('All data fetched.');
    } catch (error) {
      this._onError(error);
    }
  }

  private async fetchSites(): Promise<api.Site[]> {
    this.log.debug('Fetch sites');
    const response = await this.cache.get<api.SiteResponse>(
      '/sites/list',
      30,
      'MINUTES',
      async () => {
        return await this.getFromSolarEdge<api.SiteResponse>('/sites/list');
      },
    );

    this.log.debug(`${response.sites?.site?.length} sites fetched`);

    return response.sites?.site;
  }

  private async fetchInventory(site: Site): Promise<api.Inventory> {
    this.log.debug('Fetch inventory');
    const response = await this.cache.get<api.InventoryResponse>(
        `/site/${site.id}/inventory`,
        30,
        'MINUTES',
        async () => {
          return await this.getFromSolarEdge<api.InventoryResponse>(`/site/${site.id}/inventory`);
        },
    );

    this.log.debug(`Inventory fetched`);

    return response.Inventory;
  }

  private async fetchPowerFlow(site: api.Site): Promise<api.PowerFlow> {
    this.log.debug('Fetch power flow');
    const response = await this.getFromSolarEdge<api.PowerFlowResponse>(
      `/site/${site.id}/currentPowerFlow`,
    );
    this.log.debug(`Power flow fetched`);
    return response.siteCurrentPowerFlow;
  }

  private mapBattery(site: api.Site, powerFlow: api.PowerFlow, batteries: api.Battery[]): BatteryData | null {
    if (!batteries.length) {
      return null;
    }

    return {
      site: {
        id: site.id,
        name: site.name,
      },
      chargeLevel: powerFlow.STORAGE?.chargeLevel,
      status: powerFlow.STORAGE?.status,
      critical: powerFlow.STORAGE?.critical,
      device: {
        model: batteries[0].model,
        manufacturer: batteries[0].manufacturer,
        serialNumber: batteries[0].SN
      },
    };
  }

  private async getFromSolarEdge<T>(url: string, params: object = {}): Promise<T> {
    this.log.debug(`GET ${url}, params: ${JSON.stringify(params)}`);
    try {
      const { data } = await axios.get<T>(url, {
      params: {
        ...params,
        'api_key': this.options.apiKey
      }
    });

      if(this.options.showApiResponse) {
        this.log.info('SolarEdge data from '+url+': ' +JSON.stringify(data));
      }

      return data;
    } catch (error) {
      throw this.checkError(url, error);
    }
  }

  private checkError(url: string, error: unknown): unknown {
    this.log.error(`error from ${url}`);
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response != null) {
        if (axiosError.response.data != null) {
          const responseText = JSON.stringify(axiosError.response.data, null, ' ');
          const errorMessage = `${axiosError.response.statusText}: ${responseText}`;
          return new Error(errorMessage);
        } else {
          return new Error(axiosError.response.statusText);
        }
      }
    }
    return error;
  }

  private _onBatteryData(data: dataDomain.BatteryData): void {
    this.emit('battery', data);
  }

  private _onError(error: unknown): void {
    this.emit('error', error);
  }

}