import { NotificationsService } from './notifications.service';
import { DeviceTokenStorePort } from '../domain/ports/device-token-store.port';
import { PushResult, PushSenderPort } from '../domain/ports/push-sender.port';

const MESSAGE = { title: 'Leave approved', body: 'Your request was approved.' };

/**
 * A notification is a side effect of a business action that has ALREADY
 * succeeded. Losing one is a nuisance; failing the request that caused it
 * would be a fault — so nothing in here is allowed to throw at the caller.
 */
describe('NotificationsService', () => {
  function make(
    devices: { token: string }[] = [{ token: 'tok-phone' }],
    result: PushResult = { sent: 1, failed: 0, invalidTokens: [] },
  ) {
    const store = {
      save: jest.fn().mockResolvedValue(undefined),
      findByUsername: jest.fn().mockResolvedValue(devices),
      remove: jest.fn().mockResolvedValue(undefined),
      removeTokens: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<DeviceTokenStorePort>;
    const send = jest.fn().mockResolvedValue(result);
    const sender = { send, enabled: true } as unknown as PushSenderPort;
    return { service: new NotificationsService(store, sender), store, send };
  }

  it('sends to every device the user registered', async () => {
    const { service, send } = make([{ token: 'tok-phone' }, { token: 'tok-tablet' }]);

    await service.notifyUser('AIBRAHIM39', MESSAGE);

    expect(send).toHaveBeenCalledWith(['tok-phone', 'tok-tablet'], MESSAGE);
  });

  it('does not call the transport when the user has no device', async () => {
    const { service, send } = make([]);

    await service.notifyUser('AIBRAHIM39', MESSAGE);

    expect(send).not.toHaveBeenCalled();
  });

  it('prunes tokens FCM says are permanently dead', async () => {
    const { service, store } = make([{ token: 'live' }, { token: 'dead' }], {
      sent: 1,
      failed: 1,
      invalidTokens: ['dead'],
    });

    await service.notifyUser('AIBRAHIM39', MESSAGE);

    expect(store.removeTokens).toHaveBeenCalledWith(['dead']);
  });

  it('keeps a token whose send merely failed — a transient error is not a dead device', async () => {
    const { service, store } = make([{ token: 'live' }], {
      sent: 0,
      failed: 1,
      invalidTokens: [],
    });

    await service.notifyUser('AIBRAHIM39', MESSAGE);

    expect(store.removeTokens).not.toHaveBeenCalled();
  });

  it('swallows a transport failure rather than failing the caller', async () => {
    const { service, send } = make();
    send.mockRejectedValue(new Error('FCM unreachable'));

    await expect(service.notifyUser('AIBRAHIM39', MESSAGE)).resolves.toBeUndefined();
  });

  it('swallows a store failure too', async () => {
    const { service, store } = make();
    (store.findByUsername as jest.Mock).mockRejectedValue(new Error('db down'));

    await expect(service.notifyUser('AIBRAHIM39', MESSAGE)).resolves.toBeUndefined();
  });

  it('registers a device against the caller', async () => {
    const { service, store } = make();

    await service.register({ username: 'AIBRAHIM39', imei: 'imei-1', token: 'tok' });

    expect(store.save).toHaveBeenCalledWith({
      username: 'AIBRAHIM39',
      imei: 'imei-1',
      token: 'tok',
    });
  });

  it('unregisters one device, not the user', async () => {
    const { service, store } = make();

    await service.unregister('AIBRAHIM39', 'imei-1');

    expect(store.remove).toHaveBeenCalledWith('AIBRAHIM39', 'imei-1');
  });
});
