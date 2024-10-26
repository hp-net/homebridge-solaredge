import {API} from 'homebridge';

import {SolarEdgePlatform, PLATFORM_NAME} from './platform/SolarEdgePlatform';

/**
 * This method registers the platform with Homebridge
 */
export default (api: API) => {
  api.registerPlatform(PLATFORM_NAME, SolarEdgePlatform);
};