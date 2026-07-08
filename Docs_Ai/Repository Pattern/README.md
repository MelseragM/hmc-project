# Repository Pattern — Thin Oracle Adapters

> Target design for wrapping the 87 `XXHMC_SND_*` Oracle objects behind domain repository **ports**, with `node-oracledb` adapters. Ports live in `domain/`, implementations in `infrastructure/oracle/`, bound by DI token. No code exists yet; this is the blueprint + concrete patterns backed by real bind shapes from the mapping.

## Principles
- **Port in domain, adapter in infrastructure.** Services depend on the interface (DIP).
- **Thin adapters.** No business logic — bind params, execute view/SP, map rows. Logic stays in Oracle.
- **Two access shapes:** (a) **View/LOV read** → parameterized `SELECT`; (b) **Procedure/Package call** → anonymous `BEGIN … END;` block with named binds and OUT/ref-cursor.
- **Mappers** convert Oracle rows/out-params ↔ domain objects; they own **Arabic URL-decoding** and Oracle field renaming (Anticorruption Layer).
- **Never leak** `oracledb` types above infrastructure.

## Core: `OracleService` (single pool)

```ts
@Injectable()
export class OracleService implements OnModuleDestroy {
  private pool!: oracledb.Pool;
  constructor(private readonly cfg: ConfigService) {}
  async onModuleInit() {
    this.pool = await oracledb.createPool({
      user: this.cfg.get('ORACLE_USER'),
      password: this.cfg.get('ORACLE_PASSWORD'),
      connectString: this.cfg.get('ORACLE_DSN'),
      poolMin: this.cfg.get('ORACLE_POOL_MIN', 2),
      poolMax: this.cfg.get('ORACLE_POOL_MAX', 10),
    });
  }
  async query<T = any>(sql: string, binds: oracledb.BindParameters = {}): Promise<T[]> {
    const c = await this.pool.getConnection();
    try {
      const r = await c.execute<T>(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return r.rows ?? [];
    } finally { await c.close(); }
  }
  async call<T = any>(plsql: string, binds: oracledb.BindParameters): Promise<T> {
    const c = await this.pool.getConnection();
    try {
      const r = await c.execute(plsql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return r.outBinds as T;
    } finally { await c.close(); }
  }
  onModuleDestroy() { return this.pool?.close(0); }
}
```

## Pattern A — View / LOV read (e.g., PhoneTypeLOV op 27 → `XXHMC_SND_PHONE_TYPE_V`)

```ts
// domain/repositories/lov.repository.ts (PORT)
export interface LovRepository { readLov(object: string, lang: Lang, username?: string): Promise<LovItem[]>; }
export const LOV_REPOSITORY = Symbol('LOV_REPOSITORY');

// infrastructure/oracle/lov.oracle.repository.ts (ADAPTER)
@Injectable()
export class LovOracleRepository implements LovRepository {
  constructor(private readonly ora: OracleService) {}
  async readLov(object: string, lang: Lang, username?: string) {
    const rows = await this.ora.query(
      `SELECT code, meaning, meaning_ar FROM ${object} WHERE (:u IS NULL OR username = :u)`,
      { u: username ?? null },
    );
    return rows.map((r) => LovMapper.toItem(r, lang)); // decodes Arabic
  }
}
```
> `object` is resolved from the central `LOV_OBJECT` registry (`shared/constants/oracle-objects.ts`) — never inline table names (OCP + injection-safe allow-list).

## Pattern B — Package/Procedure call (e.g., UPDATE_PHONE_NUMBER op 28 → `XXHMC_SND_PHONE_PKG.ADD_OR_UPDATE_PHONE`)

Real mapping: body `{ P_USER_NAME, P_PHONE (JSON array string), P_LANGUAGE }`; Oracle parses the JSON; returns `successflag`.

```ts
// domain/repositories/phone.repository.ts (PORT)
export interface PhoneRepository { upsert(cmd: UpsertPhoneCommand): Promise<SubmitResult>; }
export const PHONE_REPOSITORY = Symbol('PHONE_REPOSITORY');

// infrastructure/oracle/phone.oracle.repository.ts (ADAPTER)
@Injectable()
export class PhoneOracleRepository implements PhoneRepository {
  constructor(private readonly ora: OracleService) {}
  async upsert(cmd: UpsertPhoneCommand): Promise<SubmitResult> {
    const out = await this.ora.call<{ status: oracledb.OutBind; msg: oracledb.OutBind }>(
      `BEGIN XXHMC_SND_PHONE_PKG.ADD_OR_UPDATE_PHONE(
          p_user_name => :p_user_name,
          p_phone     => :p_phone,      -- JSON array string
          p_language  => :p_language,
          p_status    => :status,
          p_message   => :msg); END;`,
      {
        p_user_name: cmd.username,
        p_phone: JSON.stringify(cmd.phones), // [{P_PHONE_ID,P_OBJECT_VERSION_NUMBER,P_PHONE_TYPE,P_PHONE_NUMBER}]
        p_language: cmd.lang,
        status: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 10 },
        msg: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 },
      },
    );
    return PhoneMapper.toResult(out); // -> { successflag, status, errormessage, errormessageAr }
  }
}
```

## Pattern C — Large multi-param submit (Leave apply op 10 → `XXHMC_SND_LEAV_OF_ABSEN_NEW_PR`)
The real procedure takes ~50 binds (`p_user_name, p_absence_type, p_absence_reason, p_start_date, p_end_date, … p_file_name1..10, p_attachment1..10, p_language`). Build a typed `ApplyLeaveCommand` and bind explicitly; **do not** spread untyped objects into binds.

```ts
const binds = LeaveApplyBinds.from(cmd); // maps DTO -> named binds (+ OUT status/successflag)
await this.ora.call(`BEGIN XXHMC_SND_LEAV_OF_ABSEN_NEW_PR( ${LeaveApplyBinds.signature} ); END;`, binds);
```
Keep the bind list in one dedicated class (`LeaveApplyBinds`) so the 50-param signature has a single source of truth and is unit-tested.

## Module wiring (DI binding)

```ts
@Module({
  controllers: [ContactController],
  providers: [
    PhoneService,
    { provide: PHONE_REPOSITORY, useClass: PhoneOracleRepository },
    { provide: LOV_REPOSITORY, useClass: LovOracleRepository },
  ],
})
export class ContactModule {}
```

## Repository port inventory (per module)

| Module | Port(s) | Oracle objects wrapped |
|---|---|---|
| profile | `ProfileRepository` | `PERSONAL_DETAILS_V`, `EMP_PHONE_V`, `EMP_OUT_ADDRESS_V`, `TEMP_ADD_TYPE_V`, `DEP_PHONE_V`, `PND_DEPENDENT_ADDR_V`, `UPD_PERSONAL_INFO_PR`, `EMP_MARITAL_LOV` |
| employee | `EmploymentRepository`, `SupervisorRepository` | `EMPLOYMENT_DETAILS_V`, `GET_PAYSLIP_PERIODS`, `PERFORMANCE_V`, `SUPERVISOR_VIEW`, `SUPERVISOR_PR` |
| payslip | `PayslipRepository` | `GET_PAYSLIP_PERIODS`, `CHK_PAYROLL_CNT`, `PAYSLIP_PR` |
| leave | `LeaveBalanceRepository`, `LeaveApplyRepository`, `LeaveAmendRepository`, `LeaveCancelRepository`, `LeaveReturnRepository`, `LeaveCalcRepository`, `LeaveLovRepository` | `LEAVE_BAL_PLAN_LOV`, `LEAVE_BALANCE_PR`, `LEAV_OF_ABSEN_NEW_PR`, `HR_LEAV_AMEND_PR`, `HR_LEAV_CANCEL_PR`, `RET_FRM_LEAV_PR`, `CALC_LEAV_DUR_PR`, `ABSENCE_TYPE_V`, `ABSENCE_REASON_V`, `LEAV_CLASS_V`, `LEAVE_TYPE_V`, `RFL_*`, `LEAVE_AMEND_V`, `LEAVE_CANCEL_V`, `EXAM_CENTRE_V`, `BEREAV_RELAT_V`, `NUM_OF_CHILD_V`, `CONTRACT_YEAR_V`, `ANNUAL_TICKT_LOV`, `LIBR_DFALT_LOV`, `ALSR_DFALT_LOV` |
| letters | `LetterRepository` | `LETTER_*_LOV`, `LETTER_MOBILE_NO_LOV`, `EMP_LTR_DEFAULT_COPY`, `DELIVERY_LOC_V`, `HR_EMPLYMNT_LTR_PR` |
| identity | `QidRepository`, `IdCardRepository` | `QID_DET_V`, `QID_CHG_PR`, `COID_REQ_PR`, `SIT_WORK_LOC_V`, `SIT_DELEV_LOC_V`, `SIT_REASON_V` |
| contact | `PhoneRepository`, `AddressRepository` | `PHONE_PKG`, `DEL_PHONE_NUMBER_PR`, `PHONE_TYPE_V`, `CREATE_ADDRESS_PR`, `UPD_ADDRESS_PR`, `COUNTRY_LOV` |
| dependents | `DependentRepository`, `PassportRepository` | `ADD_DEPENDENT_PKG`, `ADD_DEPENDENT_PR`, `UPDATE_DEPENDENT_PR`, `REMOVE_DEPENDENT_PR`, `CREATE_ADDRESS_PR`, `PASSPORT_TYPE`, `PASS_DTL_PR`, `DEP_PLACE_LOV`, `DEP_LOOKUP_LOV` |
| school-fees | `SchoolFeeRepository` | `SCHOOL_FEE_PR`, `SCHOOL_NAME_LOV`, `SCHOOL_TERM_LOV`, `EDU_STAGE_LOV`, `ACAD_YR_STRT_END_LOV`, `REQUEST_TYPE_LOV`, `CHILD_DETS_VIEW` |
| appointments | `AppointmentsRepository` + `CernerClient` | (Cerner) `masterlookup=Cerner*` |
| annual-ticket | `TicketRepository` | `TICKET_MASTER`, `TICKET_REQ_PR` |
| approvals | `ApprovalsRepository`, `WorklistRepository` | `APPROVE_SUMRY_V`, `NOTYFY_APPR_V`, `APPROVE_REJECT_PR`, `MY_REQEST_SUMMARY_V`, `PNDNG_QID_V`, `WORKLISTS_V`, `ACTION_HISTORY_V`, `REASSIGN_PR` |
| lookups | `LovRepository` (+ master) | generic registry over all `_LOV`/`_V` incl. `YES_NO_LOV`, `RFMI_USER_LOV` |

## Query patterns & safety
- **Allow-list object names** via `LOV_OBJECT`/`ORACLE_OBJECT` constants; never interpolate user input into SQL identifiers.
- **Bind everything**; use named binds mirroring the `p_*` keys in the mapping.
- **Ref-cursors**: bind `oracledb.CURSOR` OUT, `getRows()`, then close.
- **Empty vs error**: `ORA-01403 no data found` → return `[]`/`null` (per legacy), not an exception.
- **JSON-in-string params** (e.g., `P_PHONE`, dependent arrays): serialize with `JSON.stringify`; document that Oracle parses them.

## Testing
- Unit-test **mappers** (row/out-bind ↔ domain, incl. Arabic decode) and **bind builders** (esp. `LeaveApplyBinds`).
- Provide **fake repositories** (implement the port) for service tests (LSP).
- Integration-test adapters against an Oracle test schema or a containerized stub.

## Recommendations
- Generate a `BaseOracleRepository` with `query`/`call`/`callCursor` helpers to remove duplication.
- Centralize OUT-bind conventions (`p_status`, `p_message`) so `SubmitResult` mapping is uniform across all `_PR` calls.

## Cross-references
`Docs Project/Layers/README.md`, `Docs Project/Database/README.md`, `Docs Project/Services/README.md`, `Docs Project/Domains/README.md`.
