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
  username?: string;
  employeeNumber?: string;
  phoneType?: string;
  phoneTypeAr?: string;
  phoneNumber?: string;
  dependentId?: string;
}

export interface EmployeeAddress {
  addressId?: string;
  username?: string;
  employeeNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  addressLine3?: string;
  addressType?: string;
  addressTypeAr?: string;
  country?: string;
  townOrCity?: string;
  region1?: string;
  region2?: string;
  region3?: string;
  postalCode?: string;
  countryMeaning?: string;
  style?: string;
}

export interface EmployeeProfile {
  personal: PersonalDetails;
  phones: EmployeePhone[];
  outsideAddresses: EmployeeAddress[];
  dependentPhones: EmployeePhone[];
  dependentAddresses: EmployeeAddress[];
}
