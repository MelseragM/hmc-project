import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt, timingSafeEqual } from 'node:crypto';
import { MssqlService } from '@core/database/mssql.service';
import { OtpConfig } from '@core/config/configuration';
import {
  OtpPort,
  SendOtpCommand,
  SendOtpResult,
  VerifyOtpCommand,
} from '../../domain/ports/otp.port';
import { OTP_DELIVERY_PORT, OtpDeliveryPort } from '../../domain/ports/otp-delivery.port';

/** Latest OTP row for a user+device (legacy OTPValidate/OTPResend projection). */
interface OtpRow {
  SeqNo: number;
  DiffInSeconds: number;
  OTPValue: string | number;
}

/**
 * OTP storage backed by the legacy `HMC_RHAP_OTP_tbl` (LoginID +
 * DeviceIMEINumber, newest row wins) with SMS delivery via OtpDeliveryPort.
 * Queries follow the client's service mapping (TOP 1 + DATEDIFF from
 * OTPSentDateTime); the OTP value is stored as-is for legacy compatibility —
 * per the confirmed decision — but is never logged (MssqlService redacts it).
 *
 * Policy comes from OtpConfig: TTL, resend window, and max verify attempts
 * (attempts are tracked in-memory per SeqNo — the legacy table has no attempt
 * column). A verified OTP is marked consumed in-memory so it cannot be
 * replayed within its TTL.
 */
@Injectable()
export class MssqlOtpRepository implements OtpPort {
  private readonly logger = new Logger(MssqlOtpRepository.name);
  private readonly cfg: OtpConfig;
  /** Failed verify attempts per SeqNo (legacy table has no attempts column). */
  private readonly attempts = new Map<string, number>();
  /** SeqNos already verified successfully — single-use within the TTL. */
  private readonly consumed = new Set<string>();

  constructor(
    private readonly db: MssqlService,
    @Inject(OTP_DELIVERY_PORT) private readonly delivery: OtpDeliveryPort,
    config: ConfigService,
  ) {
    this.cfg = config.getOrThrow<OtpConfig>('otp');
  }

  async send(cmd: SendOtpCommand): Promise<SendOtpResult> {
    const latest = await this.latestRow(cmd.username, cmd.imei);
    if (latest && latest.DiffInSeconds < this.cfg.resendWindowSeconds) {
      throw new HttpException(
        'An OTP was sent recently. Please wait before requesting another.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (!cmd.phoneNumber) {
      throw new HttpException(
        'No registered phone number found for this user.',
        HttpStatus.CONFLICT,
      );
    }

    const otp = this.generateOtp();
    const inserted = await this.db.execute<{ SeqNo: number }>(
      `INSERT INTO HMC_RHAP_OTP_tbl (LoginID, DeviceIMEINumber, OTPValue, OTPSentDateTime)
       OUTPUT INSERTED.SeqNo AS SeqNo
       VALUES (@username, @imei, @otp, GETDATE())`,
      { username: cmd.username, imei: cmd.imei, otp },
    );
    const seqNo = inserted.rows[0]?.SeqNo ?? (await this.latestRow(cmd.username, cmd.imei))?.SeqNo;
    if (seqNo === undefined) {
      throw new HttpException(
        'Could not create the OTP request.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Raw OTP goes only to the delivery port — never logged, never returned.
    await this.delivery.sendOtpSms(cmd.phoneNumber, otp, cmd.purpose);
    return { requestId: String(seqNo) };
  }

  async verify(cmd: VerifyOtpCommand): Promise<boolean> {
    const row = await this.latestRow(cmd.username, cmd.imei);
    if (!row) return false;
    const requestId = String(row.SeqNo);
    // The verification must target the OTP the client was actually issued.
    if (cmd.requestId !== requestId) return false;
    if (this.consumed.has(requestId)) return false;
    if (row.DiffInSeconds > this.cfg.ttlSeconds) return false;

    const failed = this.attempts.get(requestId) ?? 0;
    if (failed >= this.cfg.maxAttempts) {
      this.logger.warn(`OTP request ${requestId} locked after ${failed} failed attempts.`);
      return false;
    }

    if (!MssqlOtpRepository.safeEquals(String(row.OTPValue).trim(), cmd.otp.trim())) {
      this.attempts.set(requestId, failed + 1);
      return false;
    }

    this.attempts.delete(requestId);
    this.consumed.add(requestId);
    return true;
  }

  /** Legacy OTPValidate projection: newest row for this user+device. */
  private async latestRow(username: string, imei: string): Promise<OtpRow | undefined> {
    const rows = await this.db.query<OtpRow>(
      `SELECT TOP 1 SeqNo,
              DATEDIFF(SECOND, OTPSentDateTime, GETDATE()) AS DiffInSeconds,
              OTPValue
         FROM HMC_RHAP_OTP_tbl WITH (NOLOCK)
        WHERE LoginID = @username AND DeviceIMEINumber = @imei
        ORDER BY SeqNo DESC`,
      { username, imei },
    );
    return rows[0];
  }

  /** Numeric OTP of OTP_LENGTH digits (leading zeros preserved). */
  private generateOtp(): string {
    const max = 10 ** this.cfg.length;
    return String(randomInt(0, max)).padStart(this.cfg.length, '0');
  }

  private static safeEquals(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
  }
}
