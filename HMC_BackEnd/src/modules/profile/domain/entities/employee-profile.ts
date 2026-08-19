/**
 * Profile domain entities (framework-free). Fields follow the conceptual ER
 * model in Docs_Ai/Database/README.md. Unknown columns map to undefined and
 * are pruned before serialization.
 */
export interface PersonalDetails {
  username?: string;
  employeeNumber?: string;
  joiningDate?: string;
  emailAddress?: string;
  fullName?: string;
  firstName?: string;
  middleNames?: string;
  lastName?: string;
  dateOfBirth?: string;
  qidNumber?: string;
  gender?: string;
  maritalStatus?: string;
  fullNameAr?: string;
  genderAr?: string;
  maritalStatusAr?: string;
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
