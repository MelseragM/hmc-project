import { ConfigService } from '@nestjs/config';
import { OracleService } from '@core/database/oracle.service';
import { OracleSchemaService } from '@core/database/oracle-schema.service';
import { LovOracleRepository } from './lov.oracle.repository';

const object = 'XXHMC_SND_SCHOOL_NAME_LOV';

describe('LovOracleRepository', () => {
  function make() {
    const query = jest.fn().mockResolvedValue([{ NAME: 'Doha School', USER_NAME: 'V-TEST' }]);
    const ora = { query } as unknown as OracleService;
    const hasColumn = jest.fn().mockImplementation((_object: string, column: string) =>
      Promise.resolve(['USER_NAME', 'NAME'].includes(column.toUpperCase())),
    );
    const schema = { hasColumn } as unknown as OracleSchemaService;
    const config = {
      get: jest.fn().mockReturnValue(300000),
    } as unknown as ConfigService;
    return { repository: new LovOracleRepository(ora, schema, config), query };
  }

  it('applies the user filter, search, and bounded Oracle pagination', async () => {
    const { repository, query } = make();
    const items = await repository.readLov(object, 'en', 'V-TEST', {
      search: 'doha',
      offset: 100,
      limit: 100,
    });
    expect(items).toEqual([expect.objectContaining({ meaning: 'Doha School' })]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        'WHERE user_name = :u AND UPPER(NAME) LIKE :search ORDER BY 1 OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY',
      ),
      { u: 'V-TEST', search: '%DOHA%', offset: 100, limit: 100 },
    );
  });

  it('coalesces and caches identical LOV requests', async () => {
    const { repository, query } = make();
    await Promise.all([
      repository.readLov(object, 'en', 'V-TEST'),
      repository.readLov(object, 'en', 'V-TEST'),
    ]);
    await repository.readLov(object, 'en', 'V-TEST');
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('filters the multi-type LOV by its grouping column when dataType is passed (DEP_LOOKUP_LOV)', async () => {
    const query = jest.fn().mockResolvedValue([{ CODE: 'C', DATA: 'Child', D_DATA_TYPE: 'CONTACT' }]);
    const ora = { query } as unknown as OracleService;
    const hasColumn = jest
      .fn()
      .mockImplementation((_o: string, c: string) => Promise.resolve(c.toUpperCase() === 'D_DATA_TYPE'));
    const schema = { hasColumn } as unknown as OracleSchemaService;
    const config = { get: jest.fn().mockReturnValue(300000) } as unknown as ConfigService;
    const repository = new LovOracleRepository(ora, schema, config);

    const items = await repository.readLov('XXHMC_SND_DEP_LOOKUP_LOV', 'en', undefined, {
      dataType: 'contact',
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE UPPER(D_DATA_TYPE) = :dataType'),
      { dataType: 'CONTACT' },
    );
    expect(items).toEqual([expect.objectContaining({ code: 'C', meaning: 'Child', type: 'CONTACT' })]);
  });

  it('falls back to the employee-number column when the view has no user column (LEAVE_AMEND_V)', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const ora = { query } as unknown as OracleService;
    const hasColumn = jest
      .fn()
      .mockImplementation((_o: string, c: string) => Promise.resolve(c.toUpperCase() === 'EMPLOYEE_NUMBER'));
    const schema = { hasColumn } as unknown as OracleSchemaService;
    const config = { get: jest.fn().mockReturnValue(300000) } as unknown as ConfigService;
    const repository = new LovOracleRepository(ora, schema, config);

    await repository.readLov('XXHMC_SND_LEAVE_AMEND_V', 'en', '053613');

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE employee_number = :u'),
      { u: '053613' },
    );
  });
});
