import { Lang } from '@shared/domain/lang';
import { str, strAr, pruneUndefined } from '@shared/utils/mapper.util';
import {
  EmployeeAddress,
  EmployeePhone,
  EmployeeProfile,
  PersonalDetails,
} from '../../domain/entities/employee-profile';

export interface ProfileRowSet {
  personalRows: Record<string, any>[];
  phoneRows: Record<string, any>[];
  addressRows: Record<string, any>[];
  dependentPhoneRows: Record<string, any>[];
  dependentAddressRows: Record<string, any>[];
}

/** Oracle row → profile domain (Anticorruption Layer; decodes Arabic). */
export class ProfileMapper {
  static toPersonal(row: Record<string, any> | undefined, _lang: Lang): PersonalDetails {
    if (!row) return {};
    return pruneUndefined<PersonalDetails>({
      employeeNumber: str(row, 'employee_number') ?? str(row, 'employeenumber'),
      username: str(row, 'username'),
      fullName: str(row, 'full_name') ?? str(row, 'fullname'),
      fullNameAr: strAr(row, 'full_name_ar') ?? strAr(row, 'fullnamear'),
      qidNumber: str(row, 'qid_number') ?? str(row, 'qidnumber'),
      maritalStatus: str(row, 'marital_status') ?? str(row, 'maritalstatus'),
    });
  }

  static toPhone(row: Record<string, any>): EmployeePhone {
    return pruneUndefined<EmployeePhone>({
      phoneId: str(row, 'phone_id') ?? str(row, 'phoneid'),
      phoneType: str(row, 'phone_type') ?? str(row, 'phonetype'),
      phoneNumber: str(row, 'phone_number') ?? str(row, 'phonenumber'),
    });
  }

  static toAddress(row: Record<string, any>): EmployeeAddress {
    return pruneUndefined<EmployeeAddress>({
      addressId: str(row, 'address_id') ?? str(row, 'addressid'),
      addressType: str(row, 'address_type') ?? str(row, 'addresstype'),
      country: str(row, 'country'),
    });
  }

  static toProfile(rows: ProfileRowSet, lang: Lang): EmployeeProfile {
    return {
      personal: this.toPersonal(rows.personalRows[0], lang),
      phones: rows.phoneRows.map((r) => this.toPhone(r)),
      outsideAddresses: rows.addressRows.map((r) => this.toAddress(r)),
      dependentPhones: rows.dependentPhoneRows.map((r) => this.toPhone(r)),
      dependentAddresses: rows.dependentAddressRows.map((r) => this.toAddress(r)),
    };
  }
}
