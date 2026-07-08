/**
 * Profile domain entities (framework-free). Fields follow the conceptual ER
 * model in Docs_Ai/Database/README.md. Unknown columns map to undefined and
 * are pruned before serialization.
 */
export interface PersonalDetails {
  employeeNumber?: string;
  username?: string;
  fullName?: string;
  fullNameAr?: string;
  qidNumber?: string;
  maritalStatus?: string;
  [extra: string]: unknown;
}

export interface EmployeePhone {
  phoneId?: string;
  phoneType?: string;
  phoneNumber?: string;
}

export interface EmployeeAddress {
  addressId?: string;
  addressType?: string;
  country?: string;
}

export interface EmployeeProfile {
  personal: PersonalDetails;
  phones: EmployeePhone[];
  outsideAddresses: EmployeeAddress[];
  dependentPhones: EmployeePhone[];
  dependentAddresses: EmployeeAddress[];
}
