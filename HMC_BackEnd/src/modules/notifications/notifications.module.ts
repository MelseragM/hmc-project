import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FirebaseConfig } from '@core/config/configuration';
import { NotificationsService } from './application/notifications.service';
import { DEVICE_TOKEN_STORE_PORT } from './domain/ports/device-token-store.port';
import { PUSH_SENDER_PORT, PushSenderPort } from './domain/ports/push-sender.port';
import { MssqlDeviceTokenRepository } from './infrastructure/adapters/mssql-device-token.repository';
import {
  FirebasePushSender,
  NoopPushSender,
} from './infrastructure/adapters/firebase-push-sender.adapter';
import { NotificationsController } from './interface/notifications.controller';

/**
 * Push notifications (FCM).
 *
 * The transport is chosen at boot from configuration: a credential binds the
 * Firebase sender, no credential binds the no-op. Deliberately not a hard
 * failure — an environment without a Firebase key should run the rest of the
 * API normally, and the notifications routes still accept registrations so the
 * tokens are there when the key arrives.
 *
 * Exported so any module can notify a user without depending on FCM, a token
 * table, or how many devices a person has.
 */
@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    MssqlDeviceTokenRepository,
    { provide: DEVICE_TOKEN_STORE_PORT, useExisting: MssqlDeviceTokenRepository },
    {
      provide: PUSH_SENDER_PORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): PushSenderPort => {
        const firebase = config.getOrThrow<FirebaseConfig>('firebase');
        if (!firebase.serviceAccount) {
          new Logger('NotificationsModule').warn(
            'FIREBASE_SERVICE_ACCOUNT is not set — push notifications are disabled. ' +
              'Registrations are still stored.',
          );
          return new NoopPushSender();
        }
        new Logger('NotificationsModule').log(
          `Push notifications enabled (Firebase project ${firebase.projectId}).`,
        );
        return new FirebasePushSender(firebase.serviceAccount);
      },
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
