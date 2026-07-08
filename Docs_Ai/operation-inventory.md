# Sanaad B2E — Master Operation Inventory

> Extracted from `Docs Project/sanaad-api-service-mapping.html` (Service Configuration Document **v1.9**). This is the single source of truth backing every document under `Docs Project/`. Base gateway (UAT): `https://apigwuat.api.hamad.qa/sanaad`.

## Notes on numbering
- **71 documented operations.** The source skips **op-4**, uses trailing dots on 50–53, and has **two entries numbered "53"** (`GET_SCH_FEE_REQUEST_TYPE` and `GET_HMC_ID_WORK_LOC`).
- **op-51 `GET_SCH_FEE_CHILD_LIST` is explicitly marked _Not in Scope_.**
- `Method` column: values shown as `GET*`/`POST*` are **inferred** where the source lacked an explicit badge, using the rule: Oracle `_PR`/`_PKG` procedures and `apply/update/delete/submit` paths = **POST**; views/`_V`/`_LOV`/`lovlookup`/`masterlookup` reads = **GET**.
- URLs still contain HTML entities (`&amp;`, `&lt;`) exactly as authored; decode when implementing.

## Proposed Module Assignment (14 modules)

| Module | Operations (op #) |
|---|---|
| `auth` | 1 |
| `profile` | 2, 48, 63 |
| `employee` | 3, 7, 8, 35, 36 |
| `payslip` | 5, 6, 11 |
| `leave` | 9, 10, 12, 13, 14, 45, 46, 47, 55, 56, 57, 58, 61, 62 |
| `letters` | 16, 17 |
| `identity` | 18, 19, 53b, 54, 59, 60 |
| `contact` | 25, 27, 28, 29, 30, 32 |
| `dependents` | 24, 31, 33, 34, 49, 64, 65 |
| `school-fees` | 37, 38, 39, 40, 50, 51*, 52, 53 |
| `appointments` | 41, 42, 43, 44 |
| `annual-ticket` | 66, 67 |
| `approvals` | 20, 21, 22, 23, 68, 69, 70, 71 |
| `lookups` (shared) | 15, 26 |

`*` op-51 out of scope.

## Full Operation Table

| # | Operation | Module | Method | Endpoint (path) | Oracle View/SP |
|---|---|---|---|---|---|
| 1 | Login | auth | — | (external — "Another document provided") | — |
| 2 | Personal Detail | profile | GET | `/employee/profile?enum=<emp>&lang=en` (legacy `/empprsnlinfo`) | XXHMC_SND_PERSONAL_DETAILS_V, XXHMC_SND_EMP_PHONE_V, XXHMC_SND_EMP_OUT_ADDRESS_V, XXHMC_SND_COUNTRY_LOV, XXHMC_SND_TEMP_ADD_TYPE_V, XXHMC_SND_DEP_PHONE_V, XXHMC_SND_PND_DEPENDENT_ADDR_V |
| 3 | Employee Details | employee | GET | `/employee/service?enum=<emp>&lang=en` | XXHMC_SND_EMPLOYMENT_DETAILS_V, XXHMC_SND_GET_PAYSLIP_PERIODS |
| 5 | GET_PAYSLIP_PERIOD | payslip | GET | `/employee/payslipperiod?enum=<empusername>&lang=en` | XXHMC_SND_GET_PAYSLIP_PERIODS |
| 6 | CHECK_PAYSLIP_COUNT | payslip | GET | `/employee/payslipperiodcount?enum=<personid>&lang=en&payslipperiod=August 2024` | XXHMC_SND_CHK_PAYROLL_CNT |
| 7 | GETPERFORMANCE | employee | GET | `/employee/performance?enum=<emp>&lang=en` | XXHMC_SND_PERFORMANCE_V |
| 8 | GET_BASIC_EMP | employee | GET | `/employee/basicinfo?enum=<empnum>&lang=en` | XXHMC_SND_EMPLOYMENT_DETAILS_V |
| 9 | Leave balance | leave | GET | `/employee/leave/info?enum=<empusername>&lang=en&accurlpln=<value>&effectivedate=19000101` | XXHMC_SND_LEAVE_BAL_PLAN_LOV, XXHMC_SND_LEAVE_BALANCE_PR |
| 10 | Leave Submission | leave | POST | `/employee/leave/apply` | XXHMC_SND_LEAV_OF_ABSEN_NEW_PR |
| 11 | Generate Payslip | payslip | GET | `/employee/payslip?enum=8888&lang=en&payperiod=January 2024&assignmentid=...` | XXHMC_SND_PAYSLIP_PR |
| 12 | GetLeaveType | leave | GET | `/data/masterlookup?lookupname=GetLeaveType` | XXHMC_SND_ABSENCE_TYPE_V |
| 13 | GetLeaveReasonType | leave | GET | `/data/masterlookup?lookupname=...` | XXHMC_SND_ABSENCE_REASON_V |
| 14 | GetLeaveclassType | leave | GET | `/data/masterlookup?lookupname=...` | XXHMC_SND_LEAV_CLASS_V |
| 15 | GetYesno | lookups | GET | `/data/masterlookup?lookupname=...` | XXHMC_SND_YES_NO_LOV |
| 16 | LetterReqLOV | letters | GET | `/employee/phone?...` + 6× `/data/lovlookup?lovname=...` | XXHMC_SND_LETTER_MOBILE_NO_LOV, XXHMC_SND_EMP_LTR_DEFAULT_COPY, XXHMC_SND_LETTER_COUNTRY_LOV, XXHMC_SND_LETTER_NAME_LOV, XXHMC_SND_LETTER_LANGUAGE_LOV, XXHMC_SND_EXIT_COPIES_LOV, XXHMC_SND_DELIVERY_LOC_V |
| 17 | LetterReqSubmit | letters | POST* | `/employee/letter/apply` (inferred) | XXHMC_SND_HR_EMPLYMNT_LTR_PR |
| 18 | GET_QID_DET | identity | GET* | `/employee/qid?...` (inferred) | XXHMC_SND_QID_DET_V |
| 19 | QID_UPD_PR | identity | POST* | `/employee/qid/update` (inferred) | XXHMC_SND_QID_CHG_PR |
| 20 | MYAPPROVALS | approvals | GET* | `/supervisor/approvals?...` (inferred) | XXHMC_SND_APPROVE_SUMRY_V, XXHMC_SND_PNDNG_QID_V |
| 21 | MyApprovatDetsView | approvals | GET* | (inferred) | XXHMC_SND_NOTYFY_APPR_V, XXHMC_SND_PNDNG_QID_V |
| 22 | ApproveReject | approvals | POST* | `/supervisor/approve` (inferred) | XXHMC_SND_APPROVE_REJECT_PR |
| 23 | MYREQUESTS | approvals | GET* | `/supervisor/requests?enum=<empnum>&lang=en` | XXHMC_SND_MY_REQEST_SUMMARY_V, XXHMC_SND_PNDNG_QID_V |
| 24 | UPDATE_DEPENDENT_PR | dependents | POST* | `/employee/dependent/update` (inferred) | XXHMC_SND_ADD_DEPENDENT_PKG, XXHMC_SND_UPDATE_DEPENDENT_PR |
| 25 | UPDATE_ADDRESS_SUBMIT | contact | POST* | `/employee/address/update` (inferred) | XXHMC_SND_UPD_ADDRESS_PR |
| 26 | RFMI_USER_LOV | lookups | GET* | `/data/lovlookup?lovname=RFMI_USER_LOV` (inferred) | XXHMC_SND_RFMI_USER_LOV |
| 27 | PhoneTypeLOV | contact | GET | `/data/lovlookup?Lovname=PHONE_TYPE_LOV&lang=en` | XXHMC_SND_PHONE_TYPE_V |
| 28 | UPDATE_PHONE_NUMBER | contact | POST | `/employee/phone/update` | XXHMC_SND_PHONE_PKG |
| 29 | CREATE_ADDRESS_SUBMIT | contact | POST* | `/employee/address/create` (inferred) | XXHMC_SND_CREATE_ADDRESS_PR |
| 30 | UpdateAddress_OutsideCountry_LOV | contact | GET | `/data/lovlookup?Lovname=COUNTRY_LOV&lang=en` | XXHMC_SND_COUNTRY_LOV |
| 31 | DELETE_DEPENDENT_PR | dependents | POST | `/employee/dependent/delete` | XXHMC_SND_REMOVE_DEPENDENT_PR |
| 32 | DELETE_PHONE_DETAILS_SUBMIT_PR | contact | POST* | `/employee/phone/delete` (inferred) | XXHMC_SND_DEL_PHONE_NUMBER_PR |
| 33 | GET_PP_TYPE | dependents | GET | `/employee/passport/type?lang=en` | XXHMC_SND_PASSPORT_TYPE |
| 34 | PASSPORT_DET_REQ_PR | dependents | POST* | `/employee/passport/apply` (inferred) | XXHMC_SND_PASS_DTL_PR |
| 35 | GET_SUPERVISOR_VIEW | employee | GET | `/supervisor/views?enum=<emp>&lang=en` | XXHMC_SND_SUPERVISOR_VIEW |
| 36 | SUPERVISOR_PR | employee | POST* | `/supervisor/update` (inferred) | XXHMC_SND_SUPERVISOR_PR |
| 37 | GET_SCH_FEE_SCHOOL_NAME | school-fees | GET | `/data/lovlookup?Lovname=SCHOOL_NAME_LOV&username=<u>&lang=en` | XXHMC_SND_SCHOOL_NAME_LOV |
| 38 | GET_SCH_FEE_SCHOOL_TERM | school-fees | GET | `/data/lovlookup?Lovname=SCHOOL_TERM_LOV&lang=en` | XXHMC_SND_SCHOOL_TERM_LOV |
| 39 | SCHOOL_FEE_REQ_PR | school-fees | POST* | `/employee/schoolfee/apply` (inferred) | XXHMC_SND_SCHOOL_FEE_PR |
| 40 | GET_SCH_FEE_EDU_STAGE | school-fees | GET | `/data/lovlookup?Lovname=EDU_STAGE_LOV&lang=en` | XXHMC_SND_EDU_STAGE_LOV |
| 41 | Get Upcoming Staff Clinic Appointments | appointments | GET | `/employee/appointments?enum=test&lang=en` | — (Cerner integration) |
| 42 | Get Staff Clinic Master Details | appointments | GET | `/data/masterlookup?lookupname=CernerLocation&lang=en` (+ CernerClinics, CernerMedicalServices) | — (Cerner integration) |
| 43 | Booking Screen Init | appointments | GET* | (aggregate of 41/42) | — |
| 44 | Book Appointment (Validate + Create) | appointments | POST* | `/employee/appointments/book` (inferred) | — (Cerner integration) |
| 45 | GetLeaveDefault_LOV | leave | GET* | (inferred) | XXHMC_SND_EMPLOYMENT_DETAILS_V, XXHMC_SND_ANNUAL_TICKT_LOV, XXHMC_SND_LIBR_DFALT_LOV, XXHMC_SND_ALSR_DFALT_LOV, XXHMC_SND_CONTRACT_YEAR_V |
| 46 | GetLeaveRequestLOV | leave | GET | `/data/lovlookup?Lovname=NUM_OF_CHILD_LOV&lang=en` (+ several) | XXHMC_SND_EMPLOYMENT_DETAILS_V, XXHMC_SND_NUM_OF_CHILD_V, XXHMC_SND_LEAV_CLASS_V, XXHMC_SND_EXAM_CENTRE_V, XXHMC_SND_BEREAV_RELAT_V, XXHMC_SND_CONTRACT_YEAR_V, XXHMC_SND_ABSENCE_TYPE_V, XXHMC_SND_ABSENCE_REASON_V, XXHMC_SND_LEAVE_TYPE_V |
| 47 | LEAVE_CALCULATION | leave | POST* | `/employee/leave/calculate` (inferred) | XXHMC_SND_CALC_LEAV_DUR_PR |
| 48 | PersonalDetsUpdate | profile | POST* | `/employee/profile/update` (inferred) | XXHMC_SND_UPD_PERSONAL_INFO_PR |
| 49 | GetPassportIssuePlace | dependents | GET | `/data/lovlookup?Lovname=DEP_PLACE_LOV&lang=en` | XXHMC_SND_DEP_PLACE_LOV |
| 50 | GET_SCH_FEE_ACADEMIC_YEAR | school-fees | GET | `/data/lovlookup?Lovname=ACAD_YR_STRT_END_LOV&lang=en` | XXHMC_SND_ACAD_YR_STRT_END_LOV |
| 51 | GET_SCH_FEE_CHILD_LIST _(Not in Scope)_ | school-fees | — | — | XXHMC_SND_CHILD_DETL |
| 52 | GET_SCH_FEE_CHILD_DTLS | school-fees | GET | `/employee/school/children?enum=test&acadyrstrtdt=20200202&lang=en` | XXHMC_SND_CHILD_DETS_VIEW |
| 53 | GET_SCH_FEE_REQUEST_TYPE | school-fees | GET | `/data/lovlookup?Lovname=REQUEST_TYPE_LOV&username=test&lang=en` | XXHMC_SND_REQUEST_TYPE_LOV |
| 53b | GET_HMC_ID_WORK_LOC | identity | GET | `/data/lovlookup?Lovname=SIT_WORK_LOC_LOV&lang=en` | XXHMC_SND_SIT_WORK_LOC_V |
| 54 | RequestCompanyID | identity | POST | `/employee/idcard/apply` | XXHMC_SND_COID_REQ_PR |
| 55 | ReturnFromLeaveLOV | leave | GET | `/data/lovlookup?Lovname=RFL_REL_LEAVE1_LOV&username=<u>&lang=en` | XXHMC_SND_RFL_REL_LEAVE2_V, XXHMC_SND_RFL_REL_LEAVE1_V, XXHMC_SND_RFL_LEAVE_DET_V |
| 56 | ReturnFromLeaveSubmit | leave | POST* | `/employee/leave/return` (inferred) | XXHMC_SND_RET_FRM_LEAV_PR |
| 57 | LEAVEAMEND | leave | POST* | `/employee/leave/amend` (inferred) | XXHMC_SND_HR_LEAV_AMEND_PR, XXHMC_SND_RET_FRM_LEAV_PR |
| 58 | LEAVECANCEL | leave | POST* | `/employee/leave/cancel` (inferred) | XXHMC_SND_HR_LEAV_CANCEL_PR, XXHMC_SND_RET_FRM_LEAV_PR |
| 59 | IDdeliverylocation | identity | GET | `/data/lovlookup?Lovname=SIT_DELEV_LOC_LOV` | XXHMC_SND_SIT_DELEV_LOC_V |
| 60 | IDReason | identity | GET | `/data/lovlookup?Lovname=SIT_REASON_LOV` | XXHMC_SND_SIT_REASON_V |
| 61 | LeaveCancelLOV | leave | GET* | `/data/lovlookup?...` | XXHMC_SND_LEAVE_CANCEL_V |
| 62 | LeaveAmendLOV | leave | GET | `/data/lovlookup?Lovname=LEAVE_TO_AMEND_LOV&username=<u>&lang=en` | XXHMC_SND_LEAVE_AMEND_V |
| 63 | MaritalStatusLOV | profile | GET | `/data/lovlookup?Lovname=EMP_MARITAL_LOV` | XXHMC_SND_EMP_MARITAL_LOV |
| 64 | DependentLOV | dependents | GET | `/data/lovlookup?Lovname=DEP_LOOKUP_LOV` | XXHMC_SND_DEP_LOOKUP_LOV |
| 65 | ADD_DEPENDENT_PR | dependents | POST* | `/employee/dependent/add` (inferred) | XXHMC_SND_ADD_DEPENDENT_PKG, XXHMC_SND_ADD_DEPENDENT_PR, XXHMC_SND_CREATE_ADDRESS_PR |
| 66 | AnnualticketmasterLOV | annual-ticket | GET* | `/data/lovlookup?...` | XXHMC_SND_TICKET_MASTER |
| 67 | Submit_Annual_Ticket | annual-ticket | POST* | `/employee/ticket/apply` (inferred) | XXHMC_SND_TICKET_REQ_PR |
| 68 | WorklistMain | approvals | GET* | `/supervisor/worklist?...` (inferred) | XXHMC_SND_WORKLISTS_V |
| 69 | Worklistsummary | approvals | GET* | (inferred) | XXHMC_SND_WORKLISTS_V |
| 70 | Worklistactionhistory | approvals | GET* | (inferred) | XXHMC_SND_ACTION_HISTORY_V |
| 71 | Reassignapproval | approvals | POST* | `/supervisor/reassign` (inferred) | XXHMC_SND_REASSIGN_PR |

## Endpoint path families
- `/empprsnlinfo` — legacy personal info (superseded by `/employee/profile`).
- `/employee/{profile,service,basicinfo,performance}` — employee reads.
- `/employee/payslip{,period,periodcount}` — payroll.
- `/employee/leave/{info,apply}` — leave.
- `/employee/{phone,phone/update}`, `/employee/dependent/delete`, `/employee/passport/type`, `/employee/idcard/apply`, `/employee/appointments`, `/employee/school/children` — self-service actions/reads.
- `/supervisor/{views,requests}` — manager/approver.
- `/data/lovlookup?Lovname=...` — generic list-of-values.
- `/data/masterlookup?lookupname=...` — master lookups incl. Cerner (`CernerClinics`, `CernerLocation`, `CernerMedicalServices`) and `GetLeaveType`.

## Cross-cutting observations
- **Auth (op 1)** payload is out-of-band ("Another document provided") → design a bearer/JWT guard placeholder; flag as needing the auth spec.
- **i18n**: `lang=en|ar` on most reads; Arabic values are URL-encoded in samples (`*ar` fields).
- **Envelope**: responses share `{ status, opstatus/successflag, errormessage, httpStatusCode, result|request }`.
- **Oracle-backed**: 87 `XXHMC_SND_*` objects (`_V` views, `_PR` procedures, `_PKG` packages, `_LOV`/lookups). Business logic lives in Oracle → NestJS repositories are thin.
