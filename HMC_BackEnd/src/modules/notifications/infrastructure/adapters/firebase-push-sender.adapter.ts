import { Injectable, Logger } from '@nestjs/common';
// firebase-admin v14 is modular — the v13 `import * as admin` namespace is gone.
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import { FirebaseServiceAccount } from '@core/config/configuration';
import { PushMessage, PushResult, PushSenderPort } from '../../domain/ports/push-sender.port';

/** FCM's verdict that a token is dead — as opposed to a transient failure. */
const PERMANENT_FAILURES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/** How many tokens one FCM call accepts. */
const BATCH_LIMIT = 500;

/**
 * FCM delivery through the Firebase Admin SDK.
 *
 * The app instance is named rather than default: the SDK keeps a global
 * registry, and a bare `initializeApp()` throws on the second call — which is
 * exactly what happens when Jest re-imports the module.
 */
@Injectable()
export class FirebasePushSender implements PushSenderPort {
  private static readonly log = new Logger(FirebasePushSender.name);
  private static readonly APP_NAME = 'sanaad-push';

  readonly enabled = true;
  private readonly messaging: Messaging;

  constructor(serviceAccount: FirebaseServiceAccount) {
    const existing: App | undefined = getApps().find(
      (a) => a.name === FirebasePushSender.APP_NAME,
    );
    const app =
      existing ??
      initializeApp(
        {
          credential: cert({
            projectId: serviceAccount.project_id,
            clientEmail: serviceAccount.client_email,
            privateKey: serviceAccount.private_key,
          }),
        },
        FirebasePushSender.APP_NAME,
      );
    this.messaging = getMessaging(app);
  }

  async send(tokens: readonly string[], message: PushMessage): Promise<PushResult> {
    const result: PushResult = { sent: 0, failed: 0, invalidTokens: [] };
    if (!tokens.length) return result;

    for (let i = 0; i < tokens.length; i += BATCH_LIMIT) {
      const batch = tokens.slice(i, i + BATCH_LIMIT);
      // One failing token must not cost the others their notification, so this
      // reports per-token rather than throwing.
      const response = await this.messaging.sendEachForMulticast({
        tokens: [...batch],
        notification: { title: message.title, body: message.body },
        data: message.data,
      });

      result.sent += response.successCount;
      result.failed += response.failureCount;
      response.responses.forEach((r, index) => {
        if (r.success) return;
        const code = r.error?.code ?? '';
        if (PERMANENT_FAILURES.has(code)) result.invalidTokens.push(batch[index]);
        else FirebasePushSender.log.warn(`FCM send failed (${code}): ${r.error?.message ?? ''}`);
      });
    }
    return result;
  }
}

/**
 * Bound when no credential is configured, so that everything downstream of a
 * notification keeps working. Push is an accessory to a request — submitting a
 * leave must not depend on a Firebase key being present.
 */
@Injectable()
export class NoopPushSender implements PushSenderPort {
  private static readonly log = new Logger(NoopPushSender.name);
  readonly enabled = false;

  async send(tokens: readonly string[], message: PushMessage): Promise<PushResult> {
    NoopPushSender.log.debug(
      `Push disabled — would have sent "${message.title}" to ${tokens.length} device(s).`,
    );
    return { sent: 0, failed: 0, invalidTokens: [] };
  }
}
