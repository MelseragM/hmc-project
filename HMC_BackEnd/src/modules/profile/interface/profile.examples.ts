import { attachmentProperties, ATTACHMENT_EXAMPLE } from '@shared/swagger/request-body.util';

/**
 * Real successful `result` payloads captured from api_test.json, used as Swagger
 * examples. These are the inner `result` values; the ResponseInterceptor wraps
 * them in the Sanaad success envelope.
 */

/** op 2 — GET /profile?enum=&lang= */
export const PROFILE_GET_EXAMPLE = {
  personal: {
    username: 'V-NFERNANDO',
    employeeNumber: '053613',
    joiningDate: '18-Jun-2019',
    emailAddress: 'username@null.qa',
    fullName: 'Mr. Mohammad Danish Imam',
    firstName: 'Mohammad Danish',
    lastName: 'Imam',
    dateOfBirth: '28-Feb-1981',
    qidNumber: '28135659441',
    gender: 'Male',
    maritalStatus: 'Married',
  },
  phones: [
    {
      phoneId: '787415',
      username: 'V-NFERNANDO',
      employeeNumber: '053613',
      phoneType: 'Home',
      phoneNumber: '34098571',
      dependentId: '852709',
    },
  ],
  outsideAddresses: [
    {
      addressId: '1720616',
      username: 'V-NFERNANDO',
      employeeNumber: '053613',
      addressLine1: 'S/o- Mohammad Khalid Imam',
      addressLine2: 'Mohalla-Irki, Near-Urdu Primary School',
      addressLine3: 'Eidgah Masjid Road',
      addressType: 'Primary Home Country Address',
      country: 'IN',
      townOrCity: 'jehanabaa',
      region1: 'Bihar',
      postalCode: '804408',
      style: 'GENERIC',
    },
  ],
  dependentPhones: [],
  dependentAddresses: [],
};

/** op 63 — GET /profile/lov/marital-status?lang= */
export const PROFILE_MARITAL_LOV_EXAMPLE = {
  items: [
    { code: 'Widower/Widow', meaning: 'Widower/Widow' },
    { code: 'Divorced', meaning: 'Divorced' },
    { code: 'Married', meaning: 'Married' },
    { code: 'Single', meaning: 'Single' },
  ],
};

/**
 * op 48 — POST /profile/personal request body (UPD_PERSONAL_INFO_PR).
 * Field names are the procedure's `p_*` bind names (the backend also accepts the
 * bare `first_name` form). `p_user_name` is taken from the JWT and must NOT be
 * sent. `p_marital_status` uses a code from GET /profile/lov/marital-status.
 * Attachment slots `p_file_name1..10` / `p_attachment1..10` are optional.
 */
export const PROFILE_UPDATE_PERSONAL_BODY = {
  description: 'Personal-details update payload (UPD_PERSONAL_INFO_PR `p_*` binds).',
  schema: {
    type: 'object',
    required: ['p_effective_date', 'p_first_name', 'p_last_name', 'p_marital_status'],
    properties: {
      p_effective_date: { type: 'string', example: '01-Jan-2026', description: 'Effective date (DD-Mon-YYYY).' },
      p_first_name: { type: 'string', example: 'Amir' },
      p_middle_name: { type: 'string', example: 'Sami Samir' },
      p_last_name: { type: 'string', example: 'Ibrahim' },
      p_marital_status: { type: 'string', example: 'Married', description: 'Code from the marital-status LOV.' },
      p_name_in_arabic: { type: 'string', example: 'امير سامي سمير ابراهيم' },
      p_title: { type: 'string', example: 'Mr.' },
      p_relationship: { type: 'string', example: '' },
      p_place_of_issue: { type: 'string', example: 'Doha' },
      p_country_of_issue: { type: 'string', example: 'QA' },
      p_visa_type: { type: 'string', example: 'Work' },
      p_visa_number: { type: 'string', example: '' },
      p_visa_validity: { type: 'string', example: '' },
      p_type_of_sponsership: { type: 'string', example: '' },
      ...attachmentProperties(),
    },
    // Pinned to the payload verified live on staging 2026-08-23 (successflag S).
    example: {
      p_effective_date: '01-Jan-2026',
      p_first_name: 'Amir',
      p_middle_name: 'Sami Samir',
      p_last_name: 'Ibrahim',
      p_marital_status: 'Married',
      p_file_name1: 'marriage-cert.pdf',
      p_attachment1: 'dGVzdCBhdHRhY2htZW50',
    },
  },
};

/** op 48 — POST /profile/personal response (action envelope). */
export const PROFILE_UPDATE_PERSONAL_EXAMPLE = {
  status: 'success',
  successflag: 'S',
  message: 'Success',
  httpStatusCode: 200,
};
