import * as oracledb from 'oracledb';
import { LeaveApplyCommand } from '../../domain/leave.repository';

/**
 * Single source of truth for the LEAV_OF_ABSEN_NEW_PR bind list. The full input
 * parameter set is taken from the API spec (Sanaad_API_REVISED — "Leave
 * Submission" request body): binding only a subset produced
 * `PLS-00306: wrong number or types of arguments`.
 *
 * Core fields come from the typed command; the remaining documented params
 * (medical/bereavement/exam details + attachment slots) are passed through
 * `cmd.extra` by their documented `p_*` key. The p_status/p_message/
 * p_success_flag OUT binds follow the repo's SubmitResult convention (see
 * BaseOracleRepository) — `p_success_flag` was added after the procedure's OUT
 * contract grew a third param and omitting it raised `PLS-00306`.
 * See Docs_Ai/Repository Pattern/README.md Pattern C.
 */
export class LeaveApplyBinds {
  /** Ordered IN parameter names exactly as documented in the spec body. */
  static readonly params: readonly string[] = [
    'p_user_name',
    'p_absence_type',
    'p_absence_reason',
    'p_start_date',
    'p_end_date',
    'p_adv_leave_salary',
    'p_leave_inc_bonus',
    'p_annual_tkt',
    'p_contractual_year',
    'p_remarks',
    'p_relationship_bereaved',
    'p_bereavement_date',
    'p_leave_classification',
    'p_exam_date',
    'p_examination_centre',
    'p_marriage_date',
    'p_delivery_date',
    'p_number_of_children',
    'p_doctor_comments',
    'p_med_commt_decision',
    'p_hc_number',
    'p_order_id',
    'p_order_date',
    'p_encounter_id',
    'p_visit_date',
    'p_discharge_date',
    'p_medical_service',
    'p_facility',
    'p_special_instructions',
    'p_work_related_injury',
    'p_unfit_number_of_days',
    'p_practitioner_name',
    'p_practitionr_corp_number',
    'p_electronicaly_signed_on',
    'p_deliver_date',
    'p_primary_diagnosis',
    ...LeaveApplyBinds.attachmentParams(),
  ];

  /** Named-argument list used inside the anonymous PL/SQL block. */
  static readonly signature = [
    ...LeaveApplyBinds.params.map((p) => `${p} => :${p}`),
    'p_status => :p_status',
    'p_message => :p_message',
    'p_success_flag => :p_success_flag',
  ].join(',\n          ');

  static from(cmd: LeaveApplyCommand): oracledb.BindParameters {
    const core: Record<string, unknown> = {
      p_user_name: cmd.username,
      p_absence_type: cmd.absenceType,
      p_absence_reason: cmd.absenceReason ?? null,
      p_start_date: cmd.startDate,
      p_end_date: cmd.endDate,
    };
    const extra = cmd.extra ?? {};
    const binds: oracledb.BindParameters = {
      p_status: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 10 },
      p_message: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 },
      p_success_flag: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 10 },
    };
    for (const name of LeaveApplyBinds.params) {
      const value = name in core ? core[name] : extra[name];
      (binds as Record<string, unknown>)[name] = value ?? null;
    }
    return binds;
  }

  /** p_file_name1..10 / p_attachment1..10 (20 attachment slots). */
  private static attachmentParams(): string[] {
    const slots: string[] = [];
    for (let i = 1; i <= 10; i++) {
      slots.push(`p_file_name${i}`, `p_attachment${i}`);
    }
    return slots;
  }
}
