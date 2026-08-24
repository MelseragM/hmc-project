const c = require('C:/New folder/hmc-project/HMC_BackEnd/postman/HMC-Sanaad-Full.postman_collection.json');
const targets = ['Contact', 'Dependents', 'School Fees', 'Annual Ticket', 'Approvals', 'Appointments'];
const succ = new Set();
let totalReq = 0, totalEx = 0;
for (const dir of c.item.filter((i) => targets.includes(i.name))) {
  for (const it of dir.item) {
    totalReq++;
    for (const e of it.response || []) {
      totalEx++;
      JSON.parse(e.body); // validity check
      if (e.code === 200 && e.body.includes('"successflag": "S"')) succ.add(dir.name + ' > ' + it.name);
      if (e.originalRequest.body) JSON.parse(e.originalRequest.body.raw);
    }
    if (it.request.body && it.request.body.raw) JSON.parse(it.request.body.raw);
  }
}
console.log('requests:', totalReq, '| examples:', totalEx, '| all bodies valid JSON');
console.log('\nRequests with a REAL successflag=S example:');
for (const s of succ) console.log('  [S] ' + s);
