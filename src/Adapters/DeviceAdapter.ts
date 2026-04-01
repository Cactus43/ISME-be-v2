import { MobileDevice } from '../Data/Models/MobileDevice';
import type { MobileDeviceAttributes } from '../Data/Models/MobileDevice';
import type { IDeviceAdapter } from '../Data/Interfaces/IAdapter';


// ─── DeviceAdapter ─────────────────────────────────────────────────────────

export class DeviceAdapter implements IDeviceAdapter {

  async Upsert(data: Partial<MobileDeviceAttributes>): Promise<MobileDeviceAttributes> {
    const [device] = await MobileDevice.upsert(data as MobileDeviceAttributes);
    return device.get({ plain: true });
  }
}
