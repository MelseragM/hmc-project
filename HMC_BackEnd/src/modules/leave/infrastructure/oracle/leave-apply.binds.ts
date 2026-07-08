import * as oracledb from 'oracledb';
import { toOracleLanguage } from '@shared/domain/lang';
import { LeaveApplyCommand } from '../../domain/leave.repository';

/**
 * Single source of truth for the LEAV_OF_ABSEN_NEW_PR bind list (~50 params).
 * Only the documented core params are bound today; the attachment slots
 * (p_file_name1..10 / p_attachment1..10) and other params are added here as the
 * full signature is captured. See Docs_Ai/Repository Pattern/README.md Pattern C.
 *
 * TODO(bind): complete the remaining ~40 params.
 */
export class LeaveApplyBinds {
  /** Named-argument list used inside the anonymous PL/SQL block. */
  static readonly signature = [
    'p_user_name => :p_user_name',
    'p_absence_type => :p_absence_type',
    'p_absence_reason => :p_absence_reason',
    'p_start_date => :p_start_date',
    'p_end_date => :p_end_date',
    'p_language => :p_language',
    'p_status => :p_status',
    'p_message => :p_message',
  ].join(',\n          ');

  static from(cmd: LeaveApplyCommand): oracledb.BindParameters {
    return {
      p_user_name: cmd.username,
      p_absence_type: cmd.absenceType,
      p_absence_reason: cmd.absenceReason ?? null,
      p_start_date: cmd.startDate,
      p_end_date: cmd.endDate,
      p_language: toOracleLanguage(cmd.lang),
      p_status: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 10 },
      p_message: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 },
    };
  }
}
