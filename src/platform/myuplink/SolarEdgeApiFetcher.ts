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
          const devices = await this.fetchDevices(site);

          const battery = this.mapBattery(site, powerFlow, devices);
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
    const response = await this.cache.get<api.Site[]>(
      '/sites/list',
      30,
      'MINUTES',
      async () => {
        return await this.getFromSolarEdge<api.Site[]>('/v2/sites');
      },
    );

    this.log.debug(`${response.length} sites fetched`);

    return response.systems;
  }

  private async fetchDevices(site: Site): Promise<api.Device[]> {
    this.log.debug('Fetch sites');
    const response = await this.cache.get<api.Device[]>(
        `/v2/sites/${site.siteId}/devices`,
        30,
        'MINUTES',
        async () => {
          return await this.getFromSolarEdge<api.Device[]>(`/v2/sites/${site.siteId}/devices`);
        },
    );

    this.log.debug(`${response.length} devices fetched`);

    return response.systems;
  }

  private async fetchPowerFlow(site: api.Site): Promise<api.PowerFlow> {
    this.log.debug('Fetch power flow');
    const response = await this.getFromSolarEdge<api.PowerFlow>(
      `/v2/sites/${site.siteId}/power-flow`,
    );
    this.log.debug(`Power flow fetched`);
    return response;
  }

  private mapBattery(site: api.Site, powerFlow: api.PowerFlow, devices: api.Device[]): BatteryData | null {
    const batteries = devices.filter(d => d.active && d.type === 'BATTERY')
    if (!batteries.length) {
      return null;
    }

    return {
      site: {
        id: site.siteId,
        name: site.name,
      },
      chargeLevel: powerFlow.storage?.chargeLevel,
      status: powerFlow.storage?.status,
      device: batteries[0],
    };
  }

  private async getFromSolarEdge<T>(url: string, params: object = {}): Promise<T> {
    this.log.debug(`GET ${url}, params: ${JSON.stringify(params)}`);
    try {
      const { data } = await axios.get<T>(url, {
        headers: {
          'X-API-Key': this.options.apiKey,
        },
        params,
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