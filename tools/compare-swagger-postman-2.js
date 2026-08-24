/** Part 2: compares Swagger requestBody examples vs Postman bodies for the remaining modules. */
const swagger = require('C:/New folder/hmc-project/tools/local-swagger.json');
const c = require('C:/New folder/hmc-project/HMC_BackEnd/postman/HMC-Sanaad-Full.postman_collection.json');

const MAP = [
  ['Auth', 'POST /healthcheck', '/api/v1/healthcheck'],
  ['Profile', 'POST /profile/personal', '/api/v1/profile/personal'],
  ['Employee', 'POST /employee/supervisor', '/api/v1/employee/supervisor'],
  ['Identity', 'POST /identity/qid/update', '/api/v1/identity/qid/update'],
  ['Identity', 'POST /identity/idcard/apply', '/api/v1/identity/idcard/apply'],
  ['Letters', 'POST /letters/apply', '/api/v1/letters/apply'],
  ['Leave', 'POST /leave/apply', '/api/v1/leave/apply'],
  ['Leave', 'POST /leave/calculate', '/api/v1/leave/calculate'],
  ['Leave', 'POST /leave/amend', '/api/v1/leave/amend'],
  ['Leave', 'POST /leave/cancel', '/api/v1/leave/cancel'],
  ['Leave', 'POST /leave/return', '/api/v1/leave/return'],
];

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
    if (JSON.stringify(swEx[k]) !== JSON.stringify(v)) diffs.push(`${k}: pm=${JSON.stringify(v)} sw=${JSON.stringify(swEx[k])}`);
  }
  if (diffs.length) { mismatches++; console.log(`X ${reqName}`); for (const d of diffs) console.log('    ' + d); }
  else console.log(`OK ${reqName} — Swagger example matches Postman body`);
}
console.log(mismatches ? `\n${mismatches} endpoint(s) need alignment` : '\nALL ALIGNED');
