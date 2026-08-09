import { OracleSchemaService } from './oracle-schema.service';
import { OracleMetadataService } from './oracle-metadata.service';

/**
 * User-scoped LOV reads (leave/lov/amend, letters/lov, ...) call hasColumn to
 * find the key column. Routing that through the full describe() fired the
 * expensive ALL_ARGUMENTS query and held three pool connections per check,
 * which timed the requests out. These cases pin the split: column checks read
 * only columns, signature reads only arguments — describe() is never used here.
 */
describe('OracleSchemaService', () => {
  const object = 'XXHMC_SND_LEAVE_AMEND_V';

  function make(overrides: Partial<jest.Mocked<OracleMetadataService>> = {}) {
    const describe = jest.fn();
    const describeColumns = jest.fn().mockResolvedValue([
      { name: 'USER_NAME', dataType: 'VARCHAR2', nullable: false, position: 1 },
    ]);
    const describeArguments = jest.fn().mockResolvedValue([
      { packageName: null, objectName: 'XXHMC_SND_GET_PAYSLIP_PERIODS', name: 'P_USER_NAME', position: 1, dataType: 'VARCHAR2', direction: 'IN', defaulted: false },
      { packageName: null, objectName: 'XXHMC_SND_GET_PAYSLIP_PERIODS', name: 'P_GET_PERIODS', position: 2, dataType: 'REF CURSOR', direction: 'OUT', defaulted: false },
    ]);
    const metadata = { describe, describeColumns, describeArguments, ...overrides } as unknown as OracleMetadataService;
    return { service: new OracleSchemaService(metadata), describe, describeColumns, describeArguments };
  }

  it('resolves a key column from the column-only read, never the full describe', async () => {
    const { service, describe, describeColumns } = make();
    await expect(service.resolveKeyColumn(object, ['user_name', 'username'])).resolves.toBe('user_name');
    expect(describeColumns).toHaveBeenCalledWith(object);
    expect(describe).not.toHaveBeenCalled();
  });

  it('answers hasColumn from the column-only read', async () => {
    const { service, describe, describeColumns } = make();
    await expect(service.hasColumn(object, 'USER_NAME')).resolves.toBe(true);
    await expect(service.hasColumn(object, 'EMPLOYEE_NUMBER')).resolves.toBe(false);
    expect(describeColumns).toHaveBeenCalledTimes(1); // cached after the first read
    expect(describe).not.toHaveBeenCalled();
  });

  it('reads a procedure signature from the argument-only read, never the full describe', async () => {
    const { service, describe, describeArguments } = make();
    const params = await service.resolveParams('XXHMC_SND_GET_PAYSLIP_PERIODS');
    expect(params?.map((p) => p.name)).toEqual(['p_user_name', 'p_get_periods']);
    expect(describeArguments).toHaveBeenCalledWith('XXHMC_SND_GET_PAYSLIP_PERIODS');
    expect(describe).not.toHaveBeenCalled();
  });
});
