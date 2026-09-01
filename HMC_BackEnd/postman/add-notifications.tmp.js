// One-shot: insert GET /profile/notifications into the Profile folder.
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'HMC-Sanaad-Full.postman_collection.json');
const collection = JSON.parse(fs.readFileSync(file, 'utf8'));

const profile = collection.item.find((i) => i.name === 'Profile');
if (!profile) throw new Error('Profile folder not found');
if (profile.item.some((r) => r.name === 'GET /profile/notifications')) {
  console.log('Already present — nothing to do.');
  process.exit(0);
}

const url = {
  raw: '{{baseUrl}}/profile/notifications?username=AIBRAHIM39&lang=en',
  host: ['{{baseUrl}}'],
  path: ['profile', 'notifications'],
  query: [
    { key: 'username', value: 'AIBRAHIM39' },
    { key: 'lang', value: 'en' },
  ],
};

const successRow = {
  NOTIFICATION_ID: 123859434,
  FROM_USER: 'SYSADMIN',
  TO_USER: '037400    - Amir Ibrahim',
  SUBJECT:
    'Return from Leave has been forwarded for approval to 037911    - Rizwan Aboobacker',
  LANGUAGE: 'US',
  BEGIN_DATE: '2026-09-01T11:06:32.000Z',
  DUE_DATE: null,
  STATUS: 'OPEN',
  RECIPIENT_ROLE: 'AIBRAHIM39',
  END_DATE: null,
  TYPE: 'HR',
  MORE_INFO_ROLE: null,
  FROM_ROLE: 'SYSADMIN',
  MESSAGE_TYPE: 'HRSSA',
  ITEM_KEY: '18876168',
  MESSAGE_NAME: 'HR_EMBD_NTFY_APPROVAL_FWD_MSG',
  MAIL_STATUS: 'MAIL',
  ORIGINAL_RECIPIENT: 'AIBRAHIM39',
};

const item = {
  name: 'GET /profile/notifications',
  event: [
    {
      listen: 'test',
      script: {
        type: 'text/javascript',
        exec: [
          'pm.test("Status is 200", function () {',
          '    pm.response.to.have.status(200);',
          '});',
          '',
          'pm.test("Response time is less than 5 seconds", function () {',
          '    pm.expect(pm.response.responseTime).to.be.below(5000);',
          '});',
          '',
          'pm.test("Response is valid JSON", function () {',
          '    pm.response.to.be.json;',
          '});',
          '',
          'pm.test("Has success envelope fields", function () {',
          '    const json = pm.response.json();',
          "    pm.expect(json).to.have.property('status', 'success');",
          "    pm.expect(json).to.have.property('result');",
          "    pm.expect(json).to.have.property('httpStatusCode');",
          '});',
          '',
          'pm.test("Rows carry the WORKLISTS_V columns", function () {',
          '    const rows = pm.response.json().result;',
          '    pm.expect(rows).to.be.an(\'array\');',
          '    if (rows.length) {',
          "        pm.expect(rows[0]).to.have.property('NOTIFICATION_ID');",
          "        pm.expect(rows[0]).to.have.property('SUBJECT');",
          "        pm.expect(rows[0]).to.have.property('STATUS');",
          "        pm.expect(rows[0]).to.have.property('ITEM_KEY');",
          '    }',
          '});',
        ],
      },
    },
  ],
  request: {
    method: 'GET',
    header: [],
    url,
    description:
      '**Purpose:** Notification list — the caller\'s workflow notifications, raw `XXHMC_SND_WORKLISTS_V` rows with ALL columns relayed as-is (`SELECT *`, getworklist documented query: `(RECIPIENT_ROLE = :u AND MORE_INFO_ROLE IS NULL) OR MORE_INFO_ROLE = :u`).\n\nSame data as op 68 `GET /approvals/worklist`, but reachable by EVERY authenticated user (the approvals route is APPROVER/SUPERVISOR-only) — notifications such as FYIs and RFMI answers go to regular employees too.\n\n**Auth: a token is now REQUIRED** — staging enforces authentication. Get one from `POST /auth/login` with `{"username":"AIBRAHIM39","imeinumber":"356789012345678","mpin":"555407"}` (AUTH_STATIC_LOGIN answers it without the database) and send `Authorization: Bearer {{token}}`. It lasts 1 h.\n\n**Query:** `username` (required — Oracle username form matched against RECIPIENT_ROLE/MORE_INFO_ROLE), `lang`.\n\n**Verified against staging — the success example is a real captured response (2026-09-01).**',
  },
  response: [
    {
      name: 'Success (200)',
      originalRequest: { method: 'GET', header: [], url },
      status: 'OK',
      code: 200,
      _postman_previewlanguage: 'json',
      header: [{ key: 'Content-Type', value: 'application/json; charset=utf-8' }],
      cookie: [],
      body: JSON.stringify(
        { result: [successRow], opstatus: 0, status: 'success', httpStatusCode: 200 },
        null,
        2,
      ),
    },
    {
      name: 'Validation Error (400) — username required',
      originalRequest: {
        method: 'GET',
        header: [],
        url: {
          raw: '{{baseUrl}}/profile/notifications?lang=en',
          host: ['{{baseUrl}}'],
          path: ['profile', 'notifications'],
          query: [{ key: 'lang', value: 'en' }],
        },
      },
      status: 'Bad Request',
      code: 400,
      _postman_previewlanguage: 'json',
      header: [{ key: 'Content-Type', value: 'application/json; charset=utf-8' }],
      cookie: [],
      body: JSON.stringify(
        {
          success: false,
          message: 'Validation failed.',
          status: 'error',
          httpStatusCode: 400,
          errors: { details: ['username should not be empty', 'username must be a string'] },
        },
        null,
        2,
      ),
    },
  ],
};

// Controller order: GET /profile, POST /profile/personal, GET /profile/notifications, lov.
const after = profile.item.findIndex((r) => r.name === 'POST /profile/personal');
profile.item.splice(after >= 0 ? after + 1 : profile.item.length, 0, item);

fs.writeFileSync(file, JSON.stringify(collection, null, 2) + '\n');
console.log('Inserted GET /profile/notifications at index', after + 1);
