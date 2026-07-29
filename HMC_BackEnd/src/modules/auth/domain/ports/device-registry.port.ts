export interface DeviceBindingCommand {
  username: string;
  imei: string;
  platform?: string;
}

/**
 * Device-binding trust registry (audit Level 3). Records user↔device trust used
 * for device-mismatch detection and MPIN-reset-on-new-device flows. Store pending.
 */
export interface DeviceRegistryPort {
  bind(cmd: DeviceBindingCommand): Promise<void>;
  isBound(username: string, imei: string): Promise<boolean>;
}

export const DEVICE_REGISTRY_PORT = Symbol('DEVICE_REGISTRY_PORT');
