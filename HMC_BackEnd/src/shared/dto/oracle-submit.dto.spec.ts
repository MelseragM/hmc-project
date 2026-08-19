import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateAddressRequestDto,
  UpdateAddressRequestDto,
} from '../../modules/contact/interface/dto/contact.dto';
import {
  PassportApplyRequestDto,
  UpdateDependentRequestDto,
} from '../../modules/dependents/interface/dto/dependents.dto';
import { SchoolFeeApplyRequestDto } from '../../modules/school-fees/interface/dto/school-fees.dto';
import { ApplyLeaveRequestDto } from '../../modules/leave/interface/dto/leave.dto';

const validateDto = (type: new () => object, value: object) =>
  validate(plainToInstance(type, value), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

describe('Oracle submit DTOs', () => {
  it('rejects an empty create-address payload', async () => {
    const errors = await validateDto(CreateAddressRequestDto, {});
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining([
        'p_effective_date',
        'p_primary_flag',
        'p_country',
        'p_address_type',
        'p_address_line1',
      ]),
    );
  });

  it('accepts the documented update-address keys and rejects unknown keys', async () => {
    const valid = await validateDto(UpdateAddressRequestDto, {
      p_address_id: '312605',
      p_effective_date: '20240911',
      p_region1: 'Doha',
    });
    expect(valid).toHaveLength(0);

    const invalid = await validateDto(UpdateAddressRequestDto, {
      p_address_id: '312605',
      p_effective_date: '20240911',
      wrong_name: 'value',
    });
    expect(invalid.some((error) => error.property === 'wrong_name')).toBe(true);
  });

  it('accepts canonical and legacy dependent spelling aliases', async () => {
    const errors = await validateDto(UpdateDependentRequestDto, {
      p_dependent_id: '5001',
      p_gender: 'Male',
      p_gendar: 'Male',
      p_date_of_issue_qid: '20260101',
      p_date_of_issuue_qid: '20260101',
    });
    expect(errors).toHaveLength(0);
  });

  it('requires the passport business fields', async () => {
    const errors = await validateDto(PassportApplyRequestDto, {
      p_passport_number: 'A498989',
    });
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining([
        'p_date_of_issue',
        'p_date_of_expiry',
        'p_type_of_passport',
        'p_place_of_issue',
        'p_country_of_issue',
      ]),
    );
  });

  it('accepts all ten leave-apply attachment slots and rejects unknown keys', async () => {
    const attachments: Record<string, string> = {};
    for (let i = 1; i <= 10; i++) {
      attachments[`p_file_name${i}`] = `report${i}.pdf`;
      attachments[`p_attachment${i}`] = 'JVBERi0xLjQKJ...==';
    }
    const valid = await validateDto(ApplyLeaveRequestDto, {
      absenceType: 'Sick Leave',
      startDate: '12-Jun-2025',
      endDate: '14-Jun-2025',
      ...attachments,
    });
    expect(valid).toHaveLength(0);

    const invalid = await validateDto(ApplyLeaveRequestDto, {
      absenceType: 'Sick Leave',
      startDate: '12-Jun-2025',
      endDate: '14-Jun-2025',
      p_attachment11: 'JVBERi0xLjQKJ...==',
    });
    expect(invalid.some((error) => error.property === 'p_attachment11')).toBe(true);
  });

  it('requires school-fee identifiers and amount', async () => {
    const errors = await validateDto(SchoolFeeApplyRequestDto, {});
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining([
        'p_academic_year',
        'p_child_name',
        'p_school_name',
        'p_request_type',
        'p_amount',
      ]),
    );
  });
});
