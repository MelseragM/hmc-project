import { ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { SmsConfig } from '@core/config/configuration';
import { SmsOtpDeliveryAdapter } from './sms-otp-delivery.adapter';

const CONFIG: SmsConfig = {
  baseUrl: 'https://sms.hamad.qa/api/send',
  apiKey: 'sms-key',
  senderId: 'HMC',
  timeoutMs: 25000,
  messageTemplate: 'Your Sanaad verification code is {otp}',
};

const ok = (): AxiosResponse =>
  ({ data: {}, status: 200, statusText: 'OK', headers: {}, config: {} }) as AxiosResponse;

function makeAdapter(config: Partial<SmsConfig> = {}, nodeEnv = 'production') {
  const http = { post: jest.fn() } as unknown as jest.Mocked<HttpService>;
  const configService = {
    getOrThrow: jest.fn().mockReturnValue({ ...CONFIG, ...config }),
    get: jest.fn().mockReturnValue(nodeEnv),
  } as unknown as ConfigService;
  const adapter = new SmsOtpDeliveryAdapter(http, configService);
  return { adapter, http };
}

describe('SmsOtpDeliveryAdapter', () => {
  it('posts the templated message with the bearer key', async () => {
    const { adapter, http } = makeAdapter();
    http.post.mockReturnValue(of(ok()));

    await adapter.sendOtpSms('77861234', '123456', 'ONBOARDING');

    expect(http.post).toHaveBeenCalledWith(
      'https://sms.hamad.qa/api/send',
      { to: '77861234', message: 'Your Sanaad verification code is 123456', senderId: 'HMC' },
      expect.objectContaining({
        timeout: 25000,
        headers: { Authorization: 'Bearer sms-key' },
      }),
    );
  });

  it('maps a gateway failure to ServiceUnavailableException', async () => {
    const { adapter, http } = makeAdapter();
    http.post.mockReturnValue(throwError(() => new Error('ECONNREFUSED')));

    await expect(adapter.sendOtpSms('77861234', '123456', 'ONBOARDING')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('fails hard in production when no gateway is configured', async () => {
    const { adapter, http } = makeAdapter({ baseUrl: '' }, 'production');

    await expect(adapter.sendOtpSms('77861234', '123456', 'ONBOARDING')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(http.post).not.toHaveBeenCalled();
  });

  it('is log-only in non-production when no gateway is configured', async () => {
    const { adapter, http } = makeAdapter({ baseUrl: '' }, 'development');

    await expect(adapter.sendOtpSms('77861234', '123456', 'ONBOARDING')).resolves.toBeUndefined();
    expect(http.post).not.toHaveBeenCalled();
  });
});
