import { attachmentProperties, ATTACHMENT_EXAMPLE } from '@shared/swagger/request-body.util';

/**
 * Real successful `result` payloads captured from api_test.json, used as Swagger
 * examples. These are the inner `result` values; the ResponseInterceptor wraps
 * them in the Sanaad success envelope.
 */

/** op 2 — GET /profile?enum=&lang= */
export const PROFILE_GET_EXAMPLE = {
  personal: {
    employeeNumber: '037400',
    fullName: 'Mr. Amir Sami Samir Ibrahim',
    fullNameAr: 'امير سامي سمير ابراهيم',
    qidNumber: '28481809470',
    maritalStatus: 'Married',
  },
  phones: [
    { phoneId: '1574794', phoneType: 'Qatar Mobile Number', phoneNumber: '34445566' },
    { phoneId: '310129', phoneType: 'Qatar Mobile Number', phoneNumber: '55723893' },
  ],
  outsideAddresses: [
    { addressId: '1720601', addressType: 'Primary Home Country Address', country: 'QA' },
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
    example: {
      p_effective_date: '01-Jan-2026',
      p_first_name: 'Amir',
      p_middle_name: 'Sami Samir',
      p_last_name: 'Ibrahim',
      p_marital_status: 'Married',
      p_name_in_arabic: 'امير سامي سمير ابراهيم',
      p_title: 'Mr.',
      p_place_of_issue: 'Doha',
      p_country_of_issue: 'QA',
      p_visa_type: 'Work',
      ...ATTACHMENT_EXAMPLE,
    },
  },
};

/** op 48 — POST /profile/personal response (action envelope). */
export const PROFILE_UPDATE_PERSONAL_EXAMPLE = {
  status: 'success',
  successflag: 'S',
  message: 'Success',
  errormessage: 'Success',
  httpStatusCode: 200,
};
