/** Compares Swagger requestBody examples vs Postman default bodies for the 6 target modules. */
const swagger = require('C:/New folder/hmc-project/tools/local-swagger.json');
const c = require('C:/New folder/hmc-project/HMC_BackEnd/postman/HMC-Sanaad-Full.postman_collection.json');

const MAP = [
  ['Contact', 'POST /contact/phone', '/api/v1/contact/phone'],
  ['Contact', 'POST /contact/phone/delete', '/api/v1/contact/phone/delete'],
  ['Contact', 'POST /contact/address', '/api/v1/contact/address'],
  ['Contact', 'POST /contact/address/update', '/api/v1/contact/address/update'],
  ['Dependents', 'POST /dependents', '/api/v1/dependents'],
  ['Dependents', 'POST /dependents/update', '/api/v1/dependents/update'],
  ['Dependents', 'POST /dependents/delete', '/api/v1/dependents/delete'],
  ['Dependents', 'POST /dependents/passport/apply', '/api/v1/dependents/passport/apply'],
  ['School Fees', 'POST /school-fees/apply', '/api/v1/school-fees/apply'],
  ['Annual Ticket', 'POST /annual-ticket/apply', '/api/v1/annual-ticket/apply'],
  ['Approvals', 'POST /approvals/:id/decision', '/api/v1/approvals/{id}/decision'],
  ['Approvals', 'POST /approvals/:id/request-info', '/api/v1/approvals/{id}/request-info'],
  ['Approvals', 'POST /approvals/:id/reassign', '/api/v1/approvals/{id}/reassign'],
  ['Appointments', 'POST /appointments/book', '/api/v1/appointments/book'],
];

/** Swagger example: prefer schema.example object; else build from properties' example values. */
function swaggerExample(swPath) {
  const op = swagger.paths[swPath] && swagger.paths[swPath].post;
  if (!op || !op.requestBody) return null;
  const content = op.requestBody.content['application/json'];
  let schema = content.schema;
  if (schema.$ref) schema = swagger.components.schemas[schema.$ref.split('/').pop()];
  if (schema.example) return schema.example;
  const out = {};
  for (const [k, p] of Object.entries(schema.properties || {})) {
    if (p.example !== undefined) out[k] = p.example;
  }
  return out;
}

let mismatches = 0;
for (const [folderName, reqName, swPath] of MAP) {
  const item = c.item.find((i) => i.name === folderName).item.find((i) => i.name === reqName);
  const pmBody = JSON.parse(item.request.body.raw);
  const swEx = swaggerExample(swPath);
  if (!swEx) { console.log(`!! ${reqName}: no swagger example`); mismatches++; continue; }

  const diffs = [];
  for (const [k, v] of Object.entries(pmBody)) {
    if (k === 'phones') {
      // phone array: compare item fields against PhoneItemDto examples
      const sw = (swEx.phones && swEx.phones[0]) || {};
      for (const [pk, pv] of Object.entries(v[0])) {
        if (JSON.stringify(sw[pk]) !== JSON.stringify(pv)) diffs.push(`phones[0].${pk}: pm=${JSON.stringify(pv)} sw=${JSON.stringify(sw[pk])}`);
      }
      continue;
    }
    if (JSON.stringify(swEx[k]) !== JSON.stringify(v)) diffs.push(`${k}: pm=${JSON.stringify(v)} sw=${JSON.stringify(swEx[k])}`);
  }
  if (diffs.length) { mismatches++; console.log(`✗ ${reqName}`); for (const d of diffs) console.log('    ' + d); }
  else console.log(`✓ ${reqName} — Swagger example matches Postman body`);
}
console.log(mismatches ? `\n${mismatches} endpoint(s) need alignment` : '\nALL ALIGNED');
