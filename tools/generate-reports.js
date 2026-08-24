/**
 * Generates the three project Excel reports (English):
 *   1. reports/HMC-Sanaad-DB-Team-Report.xlsx      — everything blocked on the DB team (auth excluded)
 *   2. reports/HMC-Sanaad-API-Reference-Mobile.xlsx — every API: request/response shapes + integration status
 *   3. reports/HMC-Sanaad-Backend-Tasks.xlsx        — backend action items
 * Source of truth: the verified Postman collection + live staging test results (2026-08-23).
 * Usage: node generate-reports.js
 */
const path = require('path');
const ExcelJS = require(path.join(__dirname, 'node_modules', 'exceljs'));
const fs = require('fs');

const collection = JSON.parse(fs.readFileSync('C:/New folder/hmc-project/HMC_BackEnd/postman/HMC-Sanaad-Full.postman_collection.json', 'utf8'));
const OUT = 'C:/New folder/hmc-project/reports';

// ---------------------------------------------------------------- styling
const COLORS = {
  header: 'FF1F3864', headerText: 'FFFFFFFF',
  stripe: 'FFF2F6FC',
  green: 'FFC6EFCE', greenText: 'FF006100',
  red: 'FFFFC7CE', redText: 'FF9C0006',
  orange: 'FFFFE699', orangeText: 'FF7F6000',
  gray: 'FFD9D9D9', grayText: 'FF404040',
  blue: 'FFDDEBF7', blueText: 'FF1F4E79',
};
function styleHeader(row) {
  row.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.header } };
    c.font = { bold: true, color: { argb: COLORS.headerText }, size: 11 };
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
  });
  row.height = 30;
}
function styleBody(ws, startRow) {
  for (let i = startRow; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    row.eachCell({ includeEmpty: true }, (c) => {
      c.alignment = { vertical: 'top', wrapText: true };
      c.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };
      if (i % 2 === 0 && !c.fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.stripe } };
    });
  }
}
function statusFill(cell, status) {
  const map = {
    'WORKING': [COLORS.green, COLORS.greenText],
    'BLOCKED-DB': [COLORS.red, COLORS.redText],
    'NEEDS TEST DATA': [COLORS.orange, COLORS.orangeText],
    'BLOCKED-ENV': [COLORS.gray, COLORS.grayText],
    'OPEN': [COLORS.red, COLORS.redText],
    'RESOLVED': [COLORS.green, COLORS.greenText],
    'HIGH': [COLORS.red, COLORS.redText],
    'MEDIUM': [COLORS.orange, COLORS.orangeText],
    'LOW': [COLORS.blue, COLORS.blueText],
  };
  const m = map[status];
  if (!m) return;
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: m[0] } };
  cell.font = { bold: true, color: { argb: m[1] } };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
}
function trunc(s, n = 2200) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '\n… (truncated — full example in the Postman collection)' : s;
}

// ================================================================ 1) DB TEAM REPORT
async function buildDbReport() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'HMC Sanaad Backend Team';
  wb.created = new Date();

  // ---- Summary tab
  const s = wb.addWorksheet('Summary');
  s.columns = [{ width: 28 }, { width: 110 }];
  const rows = [
    ['Report', 'HMC Sanaad B2E — Database Blockers Report (Staging)'],
    ['Date', '2026-08-23'],
    ['Environment', 'Staging — https://sndstgmobileapi.hamad.qa (gateway) → HMC_BackEnd → Oracle EBS (APPS schema)'],
    ['Scope', 'All business modules (auth journey excluded per agreement). Every endpoint was exercised live against staging; requests below use ONLY values sourced from the system\'s own LOVs / views.'],
    ['How errors were captured', 'GET /api/v1/diagnostics/oracle-logs on staging records every Oracle call with SQL, binds, duration and the full ORA error / OUT parameters.'],
    ['Re-check (2026-08-23 PM)', 'All blockers re-tested after the latest deploy: the ORA-00027 kill-session defects in LEAV_OF_ABSEN_NEW_PR and ADD_DEPENDENT_PKG were fixed at the time. The remaining items were re-verified and still failed identically.'],
    ['Re-check (2026-08-24, after your answers + our new SQL console)', 'Your answers unlocked LEAVE AMEND + CANCEL (composite "Leave Type|start|end" → both successflag S) and gave us the dependent ids — thank you. We then stood up an internal SQL console and read the procedure sources directly, which resolved three more items FROM OUR SIDE: (1) SCHOOL FEES — p_child_name must be the child-view composite "Name||Gender||DD-MON-YY" (line 197), now successflag Y; (2) DEPENDENTS DELETE — the relationship must be the CODE ("C"), which the procedure forwards as the HR contact type (line 253), now successflag Y; (3) the whole ORA-00027 family — root cause identified below (item #3) and worked around in our build. Still open for you: phone types, letters, FND_SESSIONS, payslip cursor, the ORA-06502 buffer, and the remaining test data.'],
    ['Key', 'Sheet "DB Blockers" = procedure/data defects blocking a success path. Sheet "Test Data Needed" = staging data we need seeded. Sheet "Verified OK" = procedures already returning successflag S (for contrast/scope).'],
  ];
  for (const [k, v] of rows) {
    const r = s.addRow([k, v]);
    r.getCell(1).font = { bold: true };
    r.eachCell((c) => (c.alignment = { vertical: 'top', wrapText: true }));
  }
  s.getRow(1).font = { bold: true, size: 14 };

  // ---- Blockers tab
  const b = wb.addWorksheet('DB Blockers');
  b.columns = [
    { header: '#', key: 'id', width: 5 },
    { header: 'Severity', key: 'sev', width: 10 },
    { header: 'Module / API', key: 'api', width: 30 },
    { header: 'Oracle Object', key: 'obj', width: 38 },
    { header: 'Error (exact)', key: 'err', width: 46 },
    { header: 'Request We Send (proven-correct format)', key: 'req', width: 55 },
    { header: 'DB Reply', key: 'reply', width: 45 },
    { header: 'Evidence / Repro', key: 'repro', width: 60 },
    { header: 'WHAT WE NEED FROM DB TEAM', key: 'need', width: 60 },
    { header: 'Status', key: 'status', width: 12 },
  ];
  styleHeader(b.getRow(1));
  b.autoFilter = 'A1:J1';
  b.views = [{ state: 'frozen', ySplit: 1 }];

  const blockers = [
    {
      sev: 'HIGH', api: 'Contact — POST /contact/phone (op 28: add/update phone)',
      obj: 'XXHMC_SND_PHONE_PKG.ADD_OR_UPDATE_PHONE',
      err: 'p_success_flag = N — "Phone type doesnot exist" for EVERY phone type value',
      req: 'BEGIN XXHMC_SND_PHONE_PKG.ADD_OR_UPDATE_PHONE(\n  p_user_name => \'AIBRAHIM39\',\n  p_phone_id => NULL,\n  p_object_version_number => NULL,\n  p_phone_type => \'Qatar Mobile Number\',\n  p_phone_number => \'55512345\',\n  p_success_flag => :out, p_error_msg => :out, p_error_msg_ar => :out);\nEND;',
      reply: '{"p_success_flag":"N","p_error_msg":"Phone type doesnot exist","p_error_msg_ar":"نوع الهاتف غير موجود"}',
      repro: 'Swept 14 values: every XXHMC_SND_PHONE_TYPE_V meaning AND every code AND an update of the user\'s OWN stored phone (310129) with its exact stored type. RE-TESTED 2026-08-24 with your 11-value list — \'Qatar Mobile Number\' and \'Landline\' from YOUR list are STILL rejected. The legacy spec\'s own recorded sample (op-28) shows the SAME error.',
      need: 'Your list matches what we already send, so the values are not the problem — the package\'s INTERNAL lookup is. Please run ADD_OR_UPDATE_PHONE yourselves on staging with p_phone_type=\'Qatar Mobile Number\' and trace which lookup its validation reads (it appears empty/out of sync there). Also reconcile the 3 sickness-address types in your list that the op 27 LOV does not expose.',
    },
    {
      sev: 'MEDIUM', api: 'School Fees — POST /school-fees/apply (op 39)',
      obj: 'APPS.XXHMC_SND_SCHOOL_FEE_PR',
      err: 'WAS ORA-01403 @ line 197 — SOLVED on our side 2026-08-24 (successflag Y). Only the shared kill-session defect (line 114, item #3) still hits it intermittently.',
      req: 'The ORA-01403 was OUR payload, not your data: line 197 resolves the child with\n  SELECT child_id INTO … FROM TABLE(xxhmc_snd_child_dets_view(<acd_st_dt>, <user>))\n   WHERE dob = p_child_name;\nso p_child_name must be the view\'s COMPOSITE "DOB" value (Name||Gender||DD-MON-YY),\ne.g. "Jerome Amir Sami Samir Ibrahim||Male||23-SEP-10" — not the plain name.\nWith that value the whole procedure completed: p_success_flag = Y.',
      reply: '{"p_success_flag":"Y","p_error_msg":null}',
      repro: 'Found by reading the procedure source through the new internal SQL console; verified live on 2026-08-24 (Oracle log 06:13:36Z).',
      need: 'No fix needed for line 197 — closing it. TWO smaller asks: (a) the naming is very confusing (a column called DOB holding "name||gender||dob", and a parameter called p_child_name expecting it) — please consider exposing CHILD_ID directly; (b) the submit takes >30 s, longer than our HTTP timeout, so clients get a 504 for a request that actually succeeded — can the procedure be profiled?',
      status: 'RESOLVED',
    },
    {
      sev: 'HIGH', api: 'Leave — POST /leave/apply (op 10)',
      obj: 'APPS.XXHMC_SND_LEAV_OF_ABSEN_NEW_PR',
      err: 'WAS: ORA-00027 @ line 168 — FIXED (verified 2026-08-23 PM)',
      req: 'p_user_name=AIBRAHIM39, p_absence_type=Casual Leave (op 12 LOV), p_start_date=2026-09-07, p_end_date=2026-09-07',
      reply: 'NOW returns proper business rules: N "Leave Days cannot be applied more than 1 days for HMC Law employees" (for >1 day) and N "To avail this function, please submit the Policy Awareness questionnaire."',
      repro: 'Re-verified after the fix — the procedure works; only the Policy-Awareness prerequisite blocks a successflag S for the test user (moved to Test Data Needed #7).',
      need: 'Nothing further on the procedure — RESOLVED. See Test Data Needed #7 (submit/waive the Policy Awareness questionnaire for the test user).',
      status: 'RESOLVED',
    },
    {
      sev: 'MEDIUM', api: 'Leave — POST /leave/return (op 56) — format mismatch LOV vs procedure',
      obj: 'APPS.XXHMC_SND_RET_FRM_LEAV_PR + XXHMC_SND_RFL_LEAVE_DET_LOV (op 55)',
      err: 'ORA-06502 @ line 196 when the LOV\'s LONG display string is sent; the SHORT composite works (2026-08-24)',
      req: 'CONFIRMED FROM THE SOURCE: line 60 declares `lc_segment5 VARCHAR2(60)` and line 196 does `lc_segment5 := p_leave_details;`.\nThe op 55 LOV returns a 75-character display string ("Casual Leave|Leave Start Date : 19-APR-2026 and Leave End Date : 19-APR-2026") → overflows → ORA-06502.\nThe 36-character short composite ("Casual Leave|19-APR-2026|19-APR-2026") fits and resolves correctly.',
      reply: 'Short format: {"p_success_flag":"N","p_error_msg":"To avail this function, please submit the Policy Awareness questionnaire."} — i.e. the lookup succeeded; only the questionnaire prerequisite remains.',
      repro: 'Both formats tested back-to-back on 2026-08-24; declaration + assignment read directly from ALL_SOURCE.',
      need: 'Either widen `lc_segment5` (line 60) to at least VARCHAR2(120), or change the op 55 LOV (RFL_LEAVE_DET_LOV) to return the short composite the procedure can actually hold. Right now the LOV and its consumer disagree by design.',
    },
    {
      sev: 'HIGH', api: 'Letters — POST /letters/apply (op 17)',
      obj: 'APPS.XXHMC_SND_HR_EMPLYMNT_LTR_PR',
      err: 'ORA-01403: no data found @ line 201 (Bank letter) / line 180 (Basic Salary Certificate)\n+ intermittent ORA-00001 (see item 7)',
      req: 'p_user_name=AIBRAHIM39, p_letter_language=English, p_letter_name=\'Bank letter with details with effective date\' (op 16 LOV),\np_country=Qatar / Egypt (both tried), p_no_of_copies=1, p_mobile_number=55723893 (op 16 LOV),\np_letter_delivery_loc=\'Al Wakra Hospital\' (op 16 LOV), p_purpose_comments=test',
      reply: 'ORA-01403: no data found — ORA-06512: at "APPS.XXHMC_SND_HR_EMPLYMNT_LTR_PR", line 201 (or 180)',
      repro: '3 letter-name/country combinations tried, all values from GET /letters/lov. Different letter types fail at different lines (201 vs 180) — multiple SELECT INTOs missing reference rows.',
      need: '1) Check what lines 180/201 SELECT INTO and seed the missing letter reference/config data for staging.\n2) Confirm which letter names are actually configured end-to-end.',
    },
    {
      sev: 'HIGH', api: 'Dependents — POST /dependents/update (op 24)',
      obj: 'APPS.XXHMC_SND_ADD_DEPENDENT_PKG.XXHMC_SND_UPDATE_DEPENDENT_PR',
      err: 'ORA-00027 @ package line 3506 — REGRESSED (was fixed on 2026-08-23 PM, reproduced again 2026-08-24 with YOUR real id)',
      req: 'p_user_name=AIBRAHIM39, p_dependent_id=329302 (from your provided list), p_first_name=Jerome, p_effective_date=20260824, p_file_name1=update-proof.pdf, p_attachment1=<base64>',
      reply: 'ORA-00027: cannot kill current session — ORA-06512: at "APPS.XXHMC_SND_ADD_DEPENDENT_PKG", line 3506 (intermittent: the same call earlier returned the proper ownership check for a foreign id)',
      repro: 'Thanks for the dependent ids (329302/329303/42465/1607679) — with the real id 329302 the kill-session at line 3506 fired again. The fix appears session-dependent, not permanent.',
      need: 'Make the line-3506 session-handling fix permanent/idempotent (it currently regresses intermittently — likely the same FND_SESSIONS root cause as item #7). Cosmetic: stop concatenating raw ORA text into p_error_msg ("Dependent doesnot exitsORA-01403…").',
    },
    {
      sev: 'HIGH', api: 'SYSTEMIC ROOT CAUSE — every ORA-00027 across the submit procedures',
      obj: 'XXHMC_SND_SCHOOL_FEE_PR (114) · XXHMC_SND_LEAV_OF_ABSEN_NEW_PR (168) · XXHMC_SND_ADD_DEPENDENT_PKG (3506) — same copy-pasted block',
      err: 'ORA-00027: cannot kill current session (intermittent, looked random)',
      req: 'Every one of those procedures starts with:\n  FOR r IN (SELECT s.sid, s.serial# FROM v$session s\n             WHERE client_identifier = p_user_name\n               AND action IN (\'PER/XX_HMC_SSHR_EMP_SELF_SERVICE\', \'XX_HMC_SSHR_EMP_SELF_SERVICE_Q\',\n                              \'XX_HMC_SSHR_EMP_SPECIAL\', \'XX_HMC_SSHR_EMP_SELF_SERVICE_R\'))\n  LOOP EXECUTE IMMEDIATE \'ALTER SYSTEM KILL SESSION …\'; END LOOP;',
      reply: 'PROOF (v$session on staging): our own backend connection —\nSID 4820 | CLIENT_IDENTIFIER = AIBRAHIM39 | ACTION = PER/XX_HMC_SSHR_EMP_SELF_SERVICE | PROGRAM = node@9ad3e43d28d1\nA previous procedure on that POOLED connection ran fnd_global.apps_initialize, which stamps exactly those labels on our session — so the loop matches ITSELF and Oracle refuses: ORA-00027.',
      repro: 'Explains the "random" behaviour perfectly: it depends on whether the pooled connection you land on was already used for an EBS procedure. Also explains why the same call fails then succeeds on retry.',
      need: 'WORKAROUND ALREADY SHIPPED ON OUR SIDE (build 2026-08-24+): we clear DBMS_SESSION identifier + DBMS_APPLICATION_INFO action/module before every PL/SQL call, so the loop can no longer match us. STILL PLEASE FIX PROPERLY: the loop should exclude the current session (AND s.sid <> SYS_CONTEXT(\'USERENV\',\'SID\')) — otherwise any pooled/EBS caller keeps hitting it. Also reconsider whether an integration API should be killing user sessions at all.',
    },
    {
      sev: 'MEDIUM', api: 'SYSTEMIC — several submit procedures',
      obj: 'APPLSYS.FND_SESSIONS (constraint FND_SESSIONS_U1)',
      err: 'ORA-00001: unique constraint (APPLSYS.FND_SESSIONS_U1) violated — intermittent',
      req: 'Observed on XXHMC_SND_SUPERVISOR_PR (line 95) and XXHMC_SND_HR_EMPLYMNT_LTR_PR (line 97) when calls run in quick succession over the backend\'s pooled connections.',
      reply: 'ORA-00001: unique constraint (APPLSYS.FND_SESSIONS_U1) violated — ORA-06512: at "APPS.XXHMC_SND_SUPERVISOR_PR", line 95',
      repro: 'Same request succeeds on retry — the FND session initialization inside the procedures collides when the same pooled Oracle session initializes twice.',
      need: 'Review the fnd_global / FND session initialization at the top of the XXHMC_SND_* submit procedures so it is idempotent per session (handle existing FND_SESSIONS row instead of inserting blindly). This also likely explains the ORA-00027 family (items 2, 3, 6).',
    },
    {
      sev: 'MEDIUM', api: 'Payslip — GET /payslip (op 11)',
      obj: 'APPS.XXHMC_SND_PAYSLIP_PR',
      err: 'ORA-24338: statement handle not executed (NJS-107 invalid cursor) when the person/period has no payslip',
      req: 'p_person_id=852709, p_payperiod=\'January 2026\', p_assignment_id=7179444713',
      reply: 'NJS-123/ORA-24338 — the earnings/deductions REF CURSORs are never OPENed on the no-data path.',
      repro: 'person_id 26023 + January 2026 → full real payslip returned (WORKS). person_id 852709 + same period → ORA-24338.',
      need: 'Always OPEN the OUT REF CURSORs (even for zero rows) or raise a clean business error when no payslip exists for the period.',
    },
    {
      sev: 'LOW', api: 'Dependents — POST /dependents/delete (op 31)',
      obj: 'APPS.XXHMC_SND_REMOVE_DEPENDENT_PR',
      err: 'WAS ORA-20001 "Contact Type … does not exist" — SOLVED on our side 2026-08-24 (successflag Y, dependent 1607679)',
      req: 'Source line 253 forwards our parameter straight to the HR API:\n  hr_contact_rel_api.update_contact_relationship(p_contact_type => p_relation_ship …)\nso it needs the CODE, not the meaning: p_relation_ship = \'C\' succeeds, \'Child\' raises ORA-20001, and omitting it raises ORA-01407 (CONTACT_TYPE → NULL).',
      reply: '{"p_success_flag":"Y","p_error_msg":null}',
      repro: 'Verified live 2026-08-24 after reading the source through the internal SQL console.',
      need: 'Nothing blocking — closing. Optional: the parameter is named p_contact_type in the signature but the procedure ignores it and uses p_relation_ship instead (line 253); either use it or drop it, it is misleading.',
      status: 'RESOLVED',
    },
    {
      sev: 'MEDIUM', api: 'Performance — first (cold) call timeouts',
      obj: 'XXHMC_SND_WORKLISTS_V · XXHMC_SND_LEAVE_AMEND_V · XXHMC_SND_RFMI_USER_LOV · leave defaults/request-lov views',
      err: 'ORA-03156 / gateway 504: first query on a cold cache exceeds the 25–30 s call timeout; warm calls take 1–3 s',
      req: 'e.g. SELECT * FROM XXHMC_SND_WORKLISTS_V WHERE (recipient_role = :u AND more_info_role IS NULL) OR more_info_role = :u',
      reply: 'NJS-123: call timeout of 25000 ms exceeded → HTTP 500/504 on the first call only',
      repro: 'Reproducible after every DB idle period: WORKLISTS_V 25 s → then 1.5 s; RFMI_USER_LOV 30 s → then 2.7 s.',
      need: 'Tune / add indexes for these views (they appear to full-scan WF tables on first execution), or provide materialized/pre-warmed versions. Mobile UX cannot absorb 25 s on first open.',
    },
  ];
  let i = 1;
  for (const x of blockers) {
    const st = x.status || 'OPEN';
    const r = b.addRow({ id: i++, sev: x.sev, api: x.api, obj: x.obj, err: x.err, req: x.req, reply: x.reply, repro: x.repro, need: x.need, status: st });
    statusFill(r.getCell('sev'), x.sev);
    statusFill(r.getCell('status'), st);
  }
  styleBody(b, 2);

  // ---- Test data tab
  const t = wb.addWorksheet('Test Data Needed');
  t.columns = [
    { header: '#', width: 5 },
    { header: 'Module / API', width: 34 },
    { header: 'What is missing on staging', width: 60 },
    { header: 'What we ask you to provide / seed', width: 65 },
    { header: 'Blocking which test', width: 40 },
  ];
  styleHeader(t.getRow(1));
  t.views = [{ state: 'frozen', ySplit: 1 }];
  const data = [
    ['Annual Ticket — POST /annual-ticket/apply', 'PERSON_ID format confirmed by you (thanks) and re-tested — but person_id 26023 still has NO ticket entitlement: "No ticket balance available for Mr. Amir Sami Samir Ibrahim…" (re-verified 2026-08-24).', 'Seed a ticket balance/entitlement for person_id 26023 for contractual year 01-SEP-2025 to 31-AUG-2026, OR name a staging person_id who has one.', 'Success (successflag S) for op 67'],
    ['Approvals — POST /approvals/:id/decision', 'Still no OPEN actionable approval assigned to AIBRAHIM39 (worklist re-checked 2026-08-24: 49 rows, 0 actionable — only FYI/closed items; FYIs reject APPROVE). Signature + p_result=APPROVED/REJECTED confirmed working.', 'Have a test user whose supervisor is AIBRAHIM39 (e.g. VPAVITHRAN) submit a leave/HR request and leave it pending; send us its notification_id + item_key.', 'Success for op 22 approve/reject'],
    ['Leave — ops 57/58 amend & cancel', 'DONE ✔ — your composite format (Leave Type|DD-MON-YYYY|DD-MON-YYYY) + the 5 amendable leaves unlocked BOTH: amend and cancel now return successflag S (verified 2026-08-24). Nothing further needed.', 'No action — closed with thanks.', 'CLOSED — both verified S'],
    ['Dependents — ids for update/delete', 'Ids received ✔ (329302/329303/42465/1607679). Delete is now blocked ONLY on the contact-type value (see NEW Blocker #9); update is blocked on the regressed ORA-00027 (Blocker #6).', 'Answer Blocker #9 (exact p_contact_type value) and re-fix Blocker #6 — then both ops complete.', 'Success for ops 24 & 31'],
    ['Contact — POST /contact/phone/delete', 'Phone id 310129 confirmed by you. We will not delete the user\'s only real phone; creating a disposable phone is still blocked by the phone-type defect (Blocker #1).', 'Fix Blocker #1; afterwards we create + delete a disposable phone ourselves.', 'Success for op 32'],
    ['Payslip — GET /payslip for arbitrary persons', 'Only some persons have payslips (26023 works; 852709 → ORA-24338).', 'Confirm which staging persons/periods have payslip data (or fix Blocker #8 so empty periods return cleanly).', 'Stable success for op 11'],
    ['Leave — POST /leave/apply + /leave/return', 'Both procedures now reach the same business prerequisite: "To avail this function, please submit the Policy Awareness questionnaire." (apply re-verified; return reaches it with the short composite format). Casual Leave is also limited to 1 day for HMC-Law employees.', 'Mark the Policy Awareness questionnaire as submitted for AIBRAHIM39 (or tell us which flow/user satisfies it), so ops 10 & 56 can return successflag S.', 'Success for ops 10 & 56'],
  ];
  i = 1;
  for (const row of data) t.addRow([i++, ...row]);
  styleBody(t, 2);

  // ---- Verified OK tab
  const v = wb.addWorksheet('Verified OK (context)');
  v.columns = [
    { header: 'Oracle Object', width: 48 },
    { header: 'API', width: 36 },
    { header: 'Verified result (live, 2026-08-23)', width: 70 },
  ];
  styleHeader(v.getRow(1));
  const oks = [
    ['XXHMC_SND_UPD_PERSONAL_INFO_PR', 'POST /profile/personal', 'successflag S'],
    ['XXHMC_SND_SUPERVISOR_PR', 'POST /employee/supervisor', 'successflag S — p_new_supervisor must be the PERSON_ID from XXHMC_SND_SUPERVISOR_V (employee number fails the "HMC Change Supervisor" flexfield)'],
    ['XXHMC_SND_QID_CHG_PR', 'POST /identity/qid/update', 'successflag S (yyyy-MM-dd dates accepted)'],
    ['XXHMC_SND_COID_REQ_PR', 'POST /identity/idcard/apply', 'successflag S with op 59/60/53b LOV values'],
    ['XXHMC_SND_CREATE_ADDRESS_PR', 'POST /contact/address', 'successflag S (country NAME; overlap rule enforced)'],
    ['XXHMC_SND_UPD_ADDRESS_PR', 'POST /contact/address/update', 'successflag S (own address id + matching type + country NAME; date-track blocks same-date repeats)'],
    ['XXHMC_SND_ADD_DEPENDENT_PKG.XXHMC_SND_ADD_DEPENDENT_PR', 'POST /dependents', 'successflag S once ALL flexfield-required segments are sent (attachment, passport no + expiry, country of issue, visa type, visa validity Yes/No, unique QID)'],
    ['XXHMC_SND_PASS_DTL_PR', 'POST /dependents/passport/apply', 'successflag S'],
    ['XXHMC_SND_HR_LEAV_AMEND_PR', 'POST /leave/amend', 'successflag S (2026-08-24) — composite p_leave_to_amend "Annual Leave|12-MAR-2026|12-MAR-2026" → new end 2026-03-13'],
    ['XXHMC_SND_HR_LEAV_CANCEL_PR', 'POST /leave/cancel', 'successflag S (2026-08-24) — composite p_leave_to_cancel "Annual Leave|12-MAR-2026|12-MAR-2026"'],
    ['XXHMC_SND_REASSIGN_PR', 'POST /approvals/:id/reassign', 'successflag S (DELEGATE of an own open notification)'],
    ['XXHMC_SND_HR_RFMI_PR', 'POST /approvals/:id/request-info', 'successflag S (QUESTION on an own open item)'],
    ['XXHMC_SND_TICKET_REQ_PR', 'POST /annual-ticket/apply', 'Format proven correct (PERSON_ID + SEP–AUG contractual year) — only the balance is missing (see Test Data #1)'],
    ['XXHMC_SND_PAYSLIP_PR', 'GET /payslip', 'Real payslip returned for person_id 26023 / January 2026'],
    ['XXHMC_SND_LEAVE_BALANCE_PR / CHILD_DETS_VIEW / all LOV views', 'GET endpoints', 'All read endpoints return real data (see API Reference workbook)'],
  ];
  for (const row of oks) v.addRow(row);
  styleBody(v, 2);

  await wb.xlsx.writeFile(path.join(OUT, 'HMC-Sanaad-DB-Team-Report.xlsx'));
  console.log('1/3 DB team report written');
}

// ================================================================ 2) API REFERENCE (MOBILE)
/** endpoint status map — key: "<folder>|<request name>" */
const API_META = {
  // ---- Auth
  'Auth|POST /healthcheck': { status: 'WORKING', note: 'PUBLIC. Body uses deviceimei (NOT imeinumber/username).' },
  'Auth|POST /auth/initiate': { status: 'WORKING', note: 'PUBLIC. Staging = dev bypass: identity synthesized, no real SMS; requestid returned. Real OTP/SMS arrives with the Users-DB rollout.' },
  'Auth|POST /auth/otp/validate': { status: 'WORKING', note: 'PUBLIC. Dev bypass accepts any 4-8 digit OTP; non-numeric → {"status":"error","message":"Invalid OTP"}.' },
  'Auth|POST /auth/mpin/update': { status: 'WORKING', note: 'PUBLIC. Dev bypass: not persisted on staging yet.' },
  'Auth|POST /auth/login': { status: 'WORKING', note: 'PUBLIC. Returns real JWT (token + functionaccesslist). Save token for Authorization: Bearer.' },
  'Auth|POST /auth/mpin/forgot': { status: 'WORKING', note: 'PUBLIC.' },
  'Auth|POST /auth/mpin/update/reset': { status: 'WORKING', note: 'PUBLIC.' },
  'Auth|GET /auth/me': { status: 'WORKING', note: 'Returns token claims (read envelope).' },
  // ---- Profile
  'Profile|GET /profile': { status: 'WORKING', note: 'username (Oracle username), NOT enum. Response includes phones[] (phoneId!) and outsideAddresses[] (addressId!) — mobile should read ids from here for phone/address updates.' },
  'Profile|POST /profile/personal': { status: 'WORKING', note: 'successflag S verified. Marital status value from op 63 LOV (used_value).' },
  'Profile|GET /profile/lov/marital-status': { status: 'WORKING', note: '' },
  // ---- Employee
  'Employee|GET /employee/employment': { status: 'WORKING', note: 'enum = employee number.' },
  'Employee|GET /employee/basic': { status: 'WORKING', note: 'enum = employee number.' },
  'Employee|GET /employee/performance': { status: 'WORKING', note: 'username form.' },
  'Employee|GET /employee/supervisor/views': { status: 'WORKING', note: 'Returns candidates WITH PERSON_ID — use PERSON_ID in POST /employee/supervisor.' },
  'Employee|POST /employee/supervisor': { status: 'WORKING', note: 'successflag S verified. p_new_supervisor = PERSON_ID (e.g. 112). Employee number is REJECTED by the flexfield.' },
  // ---- Identity
  'Identity|GET /identity/qid': { status: 'WORKING', note: 'username form.' },
  'Identity|POST /identity/qid/update': { status: 'WORKING', note: 'successflag S verified (yyyy-MM-dd dates + attachment).' },
  'Identity|POST /identity/idcard/apply': { status: 'WORKING', note: 'successflag S verified. All values from ops 59/60/53b LOVs.' },
  'Identity|GET /identity/lov/work-location': { status: 'WORKING', note: '' },
  'Identity|GET /identity/lov/delivery-location': { status: 'WORKING', note: '' },
  'Identity|GET /identity/lov/reason': { status: 'WORKING', note: '' },
  // ---- Contact
  'Contact|GET /contact/lov/phone-type': { status: 'WORKING', note: 'Bind used_value back on submits.' },
  'Contact|POST /contact/phone': { status: 'BLOCKED-DB', note: 'Request format final. Re-tested 2026-08-24 with the DB team\'s own 11-value list — still "Phone type doesnot exist" for every value; the procedure\'s internal lookup is broken on staging (Blocker #1). When fixed: standard S envelope.' },
  'Contact|POST /contact/phone/delete': { status: 'BLOCKED-DB', note: 'Format final (phoneId from GET /profile → phones[].phoneId). Success blocked by Blocker #1 (cannot create a disposable phone to delete). Expected success = standard S envelope.' },
  'Contact|POST /contact/address': { status: 'WORKING', note: 'successflag S verified. p_country = country NAME (Qatar). Same type+overlapping dates → N "already created…overlaps".' },
  'Contact|POST /contact/address/update': { status: 'WORKING', note: 'successflag S verified. p_address_id from GET /profile → outsideAddresses[].addressId; p_address_type must equal that address\'s own type; new p_effective_date per update (date-track).' },
  'Contact|GET /contact/lov/country': { status: 'WORKING', note: 'Use used_value (NAME, e.g. "Qatar") on submits — 2-letter code is rejected by update-address.' },
  // ---- Dependents
  'Dependents|POST /dependents': { status: 'WORKING', note: 'successflag S verified. Oracle flexfield requires MORE than the DTO minimum: >=1 attachment, passport number+expiry, country of issue, visa type (op 64 VISA group), visa validity Yes/No, UNIQUE QID, relationship from op 64 CONTACT group (Child/Spouse/… NOT "Son").' },
  'Dependents|POST /dependents/update': { status: 'BLOCKED-DB', note: 'Real ids received (329302/329303/42465/1607679). Blocked by the shared ORA-00027 kill-session defect at package line 3506 — root cause now identified (DB Blocker #3) and worked around in the backend build of 2026-08-24+ (EBS session labels cleared before every call); re-verify after that deploy. Attachment mandatory.' },
  'Dependents|POST /dependents/delete': { status: 'WORKING', note: 'successflag S verified 2026-08-24 (id 1607679). KEY: `p_relationship` must be the LOV CODE (`C`, `S`, `P`, `BROTHER`, `SISTER`) — the procedure forwards it as the HR contact type; the meaning ("Child") is rejected and omitting it raises ORA-01407. At least one attachment is mandatory.' },
  'Dependents|GET /dependents/lov': { status: 'WORKING', note: 'items carry type (group) + used_value. Optional ?data_type=CONTACT filters one group.' },
  'Dependents|GET /dependents/passport/types': { status: 'WORKING', note: '' },
  'Dependents|POST /dependents/passport/apply': { status: 'WORKING', note: 'successflag S verified. First call after DB idle can take ~20 s.' },
  'Dependents|GET /dependents/passport/issue-place': { status: 'WORKING', note: '' },
  // ---- School fees
  'School Fees|POST /school-fees/apply': { status: 'WORKING', note: 'successflag S verified 2026-08-24. KEY: `p_child_name` is NOT a name — send the composite `DOB` value from GET /school-fees/children (`Name||Gender||DD-MON-YY`) for the SAME date as `p_acd_st_dt`. CAUTION for mobile: the submit can exceed the 30 s HTTP timeout — a 504 does NOT mean failure (Oracle committed); check the worklist before retrying.' },
  'School Fees|GET /school-fees/lov/schools': { status: 'WORKING', note: 'Supports search / page / pageSize.' },
  'School Fees|GET /school-fees/lov/terms': { status: 'WORKING', note: 'Values like "Term1" (no space).' },
  'School Fees|GET /school-fees/lov/edu-stage': { status: 'WORKING', note: '' },
  'School Fees|GET /school-fees/lov/academic-year': { status: 'WORKING', note: '' },
  'School Fees|GET /school-fees/lov/request-type': { status: 'WORKING', note: 'User-scoped (e.g. only "Cash" for the test user).' },
  'School Fees|GET /school-fees/children': { status: 'WORKING', note: 'Real children rows (name/DOB/passport/QID) — use them in apply.' },
  // ---- Annual ticket
  'Annual Ticket|GET /annual-ticket/master': { status: 'WORKING', note: 'User-scoped entitlement LOV.' },
  'Annual Ticket|POST /annual-ticket/apply': { status: 'NEEDS TEST DATA', note: 'Format final: p_employee = PERSON_ID (26023), contractual year format "01-SEP-2025 to 31-AUG-2026". Current real reply: N "No ticket balance available…" (user has no entitlement — Test Data #1). When entitled: standard S envelope.' },
  // ---- Approvals
  'Approvals|GET /approvals': { status: 'WORKING', note: 'enum = USERNAME form (AIBRAHIM39). Empty arrays for users with no data.' },
  'Approvals|GET /approvals/my-requests': { status: 'WORKING', note: 'Same key rule.' },
  'Approvals|GET /approvals/worklist': { status: 'WORKING', note: 'enum = USERNAME. Real rows verified (44). First call after DB idle can hit the 25 s timeout — retry once.' },
  'Approvals|GET /approvals/worklist/summary': { status: 'WORKING', note: 'Optional notificationId scopes to one row.' },
  'Approvals|GET /approvals/worklist/:id/history': { status: 'WORKING', note: ':id = ITEM_KEY from worklist rows. Real history verified (Submit → Pending / Approve).' },
  'Approvals|GET /approvals/:id/details': { status: 'WORKING', note: ':id = NOTIFICATION_ID. View holds only OPEN actionable approvals — returns [] otherwise.' },
  'Approvals|POST /approvals/:id/decision': { status: 'NEEDS TEST DATA', note: 'Format final (decision/itemKey/itemType). Needs an OPEN approval assigned to the caller (Test Data #2). Closed/FYI/unknown → N. When valid: standard S envelope.' },
  'Approvals|POST /approvals/:id/request-info': { status: 'WORKING', note: 'successflag S verified (QUESTION on own open item; toUsername from op 26 LOV).' },
  'Approvals|POST /approvals/:id/reassign': { status: 'WORKING', note: 'successflag S verified (DELEGATE). assignTo = USERNAME.' },
  // ---- Appointments
  'Appointments|GET /appointments/upcoming': { status: 'BLOCKED-ENV', note: 'CERNER_BASE_URL not configured on staging → always 503. Expected success shape included in Postman ("Expected" example). No mobile-side change needed — retest after env fix.' },
  'Appointments|GET /appointments/masters': { status: 'BLOCKED-ENV', note: 'Same as above.' },
  'Appointments|GET /appointments/booking-init': { status: 'BLOCKED-ENV', note: 'Same as above.' },
  'Appointments|POST /appointments/book': { status: 'BLOCKED-ENV', note: 'Body final (clinicId/locationId/serviceId/slot). Same env blocker.' },
  // ---- Leave
  'Leave|GET /leave/balance': { status: 'WORKING', note: 'person_id = Oracle PERSON_ID. Empty accrual list for test persons.' },
  'Leave|GET /leaves': { status: 'WORKING', note: 'user_name + optional leave_type filter.' },
  'Leave|POST /leave/apply': { status: 'NEEDS TEST DATA', note: 'ORA-00027 FIXED (2026-08-23 PM) — real business rules now apply: max 1 day Casual Leave for HMC-Law employees, and the caller must have submitted the Policy Awareness questionnaire (test user has not → N). When satisfied: standard S envelope.' },
  'Leave|POST /leave/calculate': { status: 'WORKING', note: 'Read-only: returns {days, successFlag}.' },
  'Leave|POST /leave/amend': { status: 'WORKING', note: 'successflag S verified (2026-08-24). p_leave_to_amend = COMPOSITE "Leave Type|DD-MON-YYYY|DD-MON-YYYY" (from op 62 LOV rows; pass person_id). Business rules still apply (Casual Leave max 1 day for HMC-Law).' },
  'Leave|POST /leave/cancel': { status: 'WORKING', note: 'successflag S verified (2026-08-24). p_leave_to_cancel = COMPOSITE "Leave Type|DD-MON-YYYY|DD-MON-YYYY".' },
  'Leave|POST /leave/return': { status: 'NEEDS TEST DATA', note: 'Format SOLVED (2026-08-24): p_leave_details = SHORT composite "Leave Type|DD-MON-YYYY|DD-MON-YYYY" (NOT the op 55 LOV long display string — that overflows ORA-06502). Now blocked only on the Policy Awareness questionnaire (same as op 10).' },
  'Leave|GET /leave/lov/types': { status: 'WORKING', note: '' },
  'Leave|GET /leave/lov/reasons': { status: 'WORKING', note: 'Optional ?leave_type= filter.' },
  'Leave|GET /leave/lov/classes': { status: 'WORKING', note: '' },
  'Leave|GET /leave/lov/defaults': { status: 'WORKING', note: 'First call after DB idle ~20 s; warm fast.' },
  'Leave|GET /leave/lov/request-lov': { status: 'WORKING', note: 'Same cold-cache note.' },
  'Leave|GET /leave/lov/return': { status: 'WORKING', note: 'used_value = what op 56 expects in p_leave_details.' },
  'Leave|GET /leave/lov/cancel': { status: 'WORKING', note: 'Empty for test user (no cancelable leaves).' },
  'Leave|GET /leave/lov/amend': { status: 'WORKING', note: 'View is PERSON-scoped (DB team: WHERE person_id = 26023). Pass person_id (backend build 2026-08-24+ adds the param; username/enum accepted but match nothing on this view). Rows feed the composite p_leave_to_amend of op 57.' },
  // ---- Payslip
  'Payslip|GET /payslip/periods': { status: 'WORKING', note: 'Real periods returned.' },
  'Payslip|GET /payslip/count': { status: 'WORKING', note: 'payslipperiod = "Month YYYY".' },
  'Payslip|GET /payslip': { status: 'WORKING', note: 'Real payslip verified (person_id 26023). Persons without a payslip in the period currently error (DB Blockers #8) — handle 500 until fixed.' },
  // ---- Letters
  'Letters|GET /letters/lov': { status: 'WORKING', note: 'All submit values come from here (name/language/copies/country/deliveryLoc/mobile).' },
  'Letters|POST /letters/apply': { status: 'BLOCKED-DB', note: 'Format final (LOV-sourced values). ORA-01403 inside procedure (DB Blockers #5). When fixed: standard S envelope.' },
  // ---- Lookups
  'Lookups|GET /lookups/yes-no': { status: 'WORKING', note: '' },
  'Lookups|GET /lookups/rfmi-user': { status: 'WORKING', note: 'Used for approvals request-info (toUsername). First cold call may 504 — retry.' },
  'Lookups|GET /lookups/lov': { status: 'WORKING', note: 'Generic LOV by lovname; unknown name → 400.' },
  'Lookups|GET /lookups/master': { status: 'WORKING', note: 'Generic master lookup by lookupname.' },
  // ---- Health
  'Health|GET /health': { status: 'WORKING', note: 'PUBLIC liveness.' },
  'Health|GET /health/db': { status: 'WORKING', note: 'Full Oracle diagnostics (always HTTP 200 — check status/connected).' },
  'Health|GET /health/users-db': { status: 'WORKING', note: 'NEW endpoint. Users DB (SQL Server, auth cycle) diagnostics. Staging: Users DB not configured yet (enabled:false) — real OTP/MPIN cycle activates once USERS_DB_* env vars are set.' },
};

function pickExample(responses, kind) {
  if (!responses || !responses.length) return null;
  if (kind === 'success') {
    return (
      responses.find((e) => e.code === 200 && /successflag": "S/.test(e.body) && !/NOT a captured/.test(e.name)) ||
      responses.find((e) => e.code === 200 && e.name.startsWith('Success') && !/NOT a captured/.test(e.name)) ||
      responses.find((e) => /Expected Success/.test(e.name)) ||
      responses.find((e) => e.code === 200)
    );
  }
  return (
    responses.find((e) => e.code === 400) ||
    responses.find((e) => e.code !== 200) ||
    responses.find((e) => e.code === 200 && /successflag": "N/.test(e.body))
  );
}

async function buildApiReference() {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();

  // ---- Read Me tab
  const rm = wb.addWorksheet('READ ME (conventions)');
  rm.columns = [{ width: 34 }, { width: 120 }];
  const conv = [
    ['Workbook', 'HMC Sanaad B2E — API Reference for Mobile Integration (verified live on staging 2026-08-23)'],
    ['Base URL (staging)', 'https://sndstgmobileapi.hamad.qa/api/v1'],
    ['Authentication', 'Authorization: Bearer <token> from POST /auth/login. NOTE: staging currently runs AUTH_DISABLED=true (backend injects dev user AIBRAHIM39/037400), so 401/403 cannot be reproduced there yet — still ALWAYS send the token; production will enforce it.'],
    ['Read envelope (GET/read)', '{ "result": <payload>, "opstatus": 0, "status": "success", "httpStatusCode": 200 }'],
    ['Action envelope (submits)', '{ "status": "success"|"error", "successflag": "S"|"N", "message": "...", "httpStatusCode": 200 }  — IMPORTANT: business failures come back as HTTP 200 with successflag "N"; check successflag, not only the HTTP code.'],
    ['Error envelope (HTTP 4xx/5xx)', '{ "success": false, "message": "...", "status": "error", "httpStatusCode": <code>, "errors": { "details": [ ... ] }? }'],
    ['Language', 'Every endpoint takes ?lang=en|ar (default en). LOV items carry meaning (localized) + used_value (ALWAYS the English label) — bind used_value back on submits.'],
    ['Identifier cheat-sheet', 'enum = employee number (e.g. 053613) for employee reads · username = Oracle username (AIBRAHIM39) for profile/identity/letters/approvals · person_id = Oracle PERSON_ID (26023) for leave balance, payslip, annual-ticket p_employee, supervisor p_new_supervisor.'],
    ['Attachments', 'p_file_name1..10 + p_attachment1..10 (base64 string). Dependents add/update REQUIRE at least one attachment.'],
    ['Dates', 'Submit dates are strings; most procedures accept yyyymmdd or yyyy-MM-dd; leave endpoints accept dd-Mon-yyyy or yyyy-MM-dd (see each body example).'],
    ['Cold-cache latency', 'First call after DB idle can take 15-30 s on: approvals/worklist, lookups/rfmi-user, leave defaults/request-lov, passport apply. Retry once / show a spinner; warm calls are 0.2-3 s.'],
    ['Status column meaning', 'WORKING = live-verified now · BLOCKED-DB = correct request, Oracle procedure defect (see DB report; response WILL be the standard S envelope once fixed) · NEEDS TEST DATA = works, needs staging data to show success · BLOCKED-ENV = CERNER_BASE_URL not configured (appointments).'],
    ['"Expected" examples', 'Examples labeled "Expected Success … (NOT a captured response)" show the exact final success shape (built from the backend response pipeline) for endpoints currently blocked — integrate against them safely.'],
    ['Full examples', 'The Postman collection (HMC_BackEnd/postman/HMC-Sanaad-Full.postman_collection.json) carries EVERY real captured response (172 examples) — this sheet shows the essentials.'],
  ];
  for (const [k, v] of conv) {
    const r = rm.addRow([k, v]);
    r.getCell(1).font = { bold: true };
    r.eachCell((c) => (c.alignment = { vertical: 'top', wrapText: true }));
  }
  rm.getRow(1).font = { bold: true, size: 14 };

  // ---- APIs tab
  const ws = wb.addWorksheet('APIs');
  ws.columns = [
    { header: '#', width: 5 },
    { header: 'Module', width: 14 },
    { header: 'Method', width: 9 },
    { header: 'Endpoint (path + query)', width: 52 },
    { header: 'Status', width: 17 },
    { header: 'Request Body (exact, tested)', width: 55 },
    { header: 'Success Response', width: 60 },
    { header: 'Success Source', width: 16 },
    { header: 'Sample Error Response (validation/business)', width: 55 },
    { header: 'Integration Notes for Mobile', width: 62 },
  ];
  styleHeader(ws.getRow(1));
  ws.autoFilter = 'A1:J1';
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  let n = 1;
  for (const dir of collection.item) {
    if (dir.name.startsWith('Internal')) continue;
    for (const it of dir.item) {
      const key = `${dir.name}|${it.name}`;
      const meta = API_META[key] || { status: '', note: '' };
      const url = it.request.url.raw.replace('{{baseUrl}}', '');
      const body = it.request.body && it.request.body.raw ? it.request.body.raw : '';
      const succ = pickExample(it.response, 'success');
      const err = pickExample(it.response, 'error');
      const succSource = succ ? (/NOT a captured/.test(succ.name) ? 'EXPECTED (pending fix)' : 'REAL (captured)') : '';
      const r = ws.addRow([
        n++, dir.name, it.request.method, url, meta.status,
        trunc(body, 1800), succ ? trunc(succ.body) : '', succSource,
        err ? trunc(err.body, 1200) : '', meta.note,
      ]);
      statusFill(r.getCell(5), meta.status);
      if (succSource.startsWith('EXPECTED')) {
        r.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.orange } };
        r.getCell(8).font = { bold: true, color: { argb: COLORS.orangeText } };
      }
    }
  }
  styleBody(ws, 2);

  await wb.xlsx.writeFile(path.join(OUT, 'HMC-Sanaad-API-Reference-Mobile.xlsx'));
  console.log('2/3 API reference written');
}

// ================================================================ 3) BACKEND TASKS
async function buildBackendTasks() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Backend Tasks');
  ws.columns = [
    { header: '#', width: 5 },
    { header: 'Priority', width: 10 },
    { header: 'Area', width: 20 },
    { header: 'Task', width: 60 },
    { header: 'Why / Evidence', width: 70 },
    { header: 'Depends on', width: 24 },
  ];
  styleHeader(ws.getRow(1));
  ws.autoFilter = 'A1:F1';
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  const tasks = [
    ['HIGH', 'Deploy', 'Redeploy staging with latest main (contains the ORA-00027 workaround)', 'The backend now clears DBMS_SESSION identifier + DBMS_APPLICATION_INFO action/module before every PL/SQL call, which neutralises the EBS "kill the user\'s SSHR sessions" loop that was killing our own pooled session (ORA-00027 on school-fees/leave-apply/dependents-update). Also carries person_id support on GET /leave/lov/amend, the composite leave formats, the school-fees composite child name and the dependents-delete code rule. Re-verify those three endpoints right after the deploy.', '—'],
    ['HIGH', 'Verify', 'After the deploy: re-run dependents/update, leave/apply and school-fees several times', 'They shared the ORA-00027 defect; with the session-label fix they should stop failing intermittently. Use tools/resilient-runner.js with the phase cases, then regenerate the collection + reports.', 'Deploy'],
    ['MEDIUM', 'Timeout', 'School-fees submit exceeds the 30 s HTTP timeout while succeeding in Oracle', 'Verified: the client received 504 but the procedure committed with p_success_flag=Y. Either raise REQUEST_TIMEOUT_MS for submit routes, or return 202 + a way to confirm; mobile must not treat 504 as failure (duplicate submissions).', '—'],
    ['HIGH', 'Environment', 'Set CERNER_BASE_URL (+ CERNER_TIMEOUT_MS) on staging', 'All 4 appointments endpoints return 503; code path is ready (expected shapes documented). Coordinate with DevOps.', 'DevOps'],
    ['HIGH', 'Feature gap', 'Expose an endpoint listing the caller\'s dependents (dependent_id + names)', 'Mobile cannot call dependents/update or /delete without ids; profile only surfaces dependents that own phones/addresses (empty for test user). Needs DB team to confirm the right view.', 'DB team'],
    ['HIGH', 'Follow-up', 'Chase the DB-team blockers report (9 items) and retest after each fix', 'Blockers file: reports/HMC-Sanaad-DB-Team-Report.xlsx. Re-run the Postman collection / tools scripts to refresh captured examples after fixes.', 'DB team'],
    ['MEDIUM', 'Feature gap', 'Return objectVersionNumber with profile phones[]', 'Phone UPDATE path binds p_object_version_number, but GET /profile does not expose it — mobile cannot do optimistic-locking updates once the phone-type defect is fixed.', 'DB Blocker #1'],
    ['MEDIUM', 'Performance', 'Warm-up / cache strategy for slow first-call views', 'WORKLISTS_V, RFMI_USER_LOV, LEAVE_AMEND_V, leave defaults/request-lov take 15-30 s on cold cache (real 504 captured). Options: startup warm-up queries, longer LOV cache TTL, or DB-side tuning (also raised with DB team).', 'DB team (partly)'],
    ['MEDIUM', 'API design', 'GET /leave/lov/request-lov requires enum but never uses it', 'Controller validates ProfileQueryDto (enum required) yet service.requestLov(q.lang) ignores it — either scope the read by user or drop the required param.', '—'],
    ['MEDIUM', 'Docs/product', 'Decide op 66 (annual-ticket master) contract', 'Spec maps op 66 to TICKET_MASTER keyed by person_id (rich contract-year + contacts rows); backend intentionally serves user-scoped ANNUAL_TICKT_LOV (TICKET_MASTER unfiltered timed out). Confirm with product/mobile which shape the app needs.', 'Product'],
    ['MEDIUM', 'Auth', 'Configure USERS_DB_* on staging + verify the real auth cycle (SMS OTP, MPIN persistence)', 'PR #8 merged and DEPLOYED — GET /health/users-db (new) reports "Users DB host/database/user missing — pool not initialized". Once configured, capture real 401/403 + OTP examples and update the collection (auth folder currently reflects dev bypass).', 'Env config'],
    ['MEDIUM', 'Deploy', 'Payslip count new response shape not live yet', 'Commit 0616ca8 changes GET /payslip/count to { count, rows[{PERIOD_NAME, PERIOD_NAME_AR, ASSIGNMENT_ACTION_ID}] } (feeds op 11), but staging still returns { count } — include in next deploy and re-capture the Postman example.', 'Deploy'],
    ['LOW', 'Infra', 'Investigate intermittent F5/WAF "Request Rejected" HTML on some POSTs', 'Captured twice (support IDs 15468526370044169128 / 15468526370046194779 / 15468526370053122202). The WAF returns 200 with an HTML body — mobile JSON parsers will choke; ask infra which rule triggers.', 'Infra/WAF'],
    ['LOW', 'Gateway', 'Gateway /docs only documents the auth journey', 'Proxied business routes are invisible in the public swagger; consider serving the backend swagger (or a filtered copy) through the gateway for partners.', '—'],
    ['LOW', 'Tooling', 'Keep tools/ scripts as the regeneration source', 'update-collection.js + update-collection-2.js + results-phase*.json rebuild the entire verified Postman collection on top of any baseline; verify-collection.js + compare-swagger-postman*.js guard drift.', '—'],
  ];
  let i = 1;
  for (const t of tasks) {
    const r = ws.addRow([i++, ...t]);
    statusFill(r.getCell(2), t[0]);
  }
  styleBody(ws, 2);

  await wb.xlsx.writeFile(path.join(OUT, 'HMC-Sanaad-Backend-Tasks.xlsx'));
  console.log('3/3 Backend tasks written');
}

(async () => {
  await buildDbReport();
  await buildApiReference();
  await buildBackendTasks();
  console.log('All reports generated in', OUT);
})();
