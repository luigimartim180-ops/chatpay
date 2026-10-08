const fs = require('fs');
const c = fs.readFileSync('worker.js', 'utf8');
const compact = s => String(s).replace(/\s+/g, '');

const checks = [
  ["agency-card id", 'id="agency-card"'],
  ["loadAgencyUI()", 'loadAgencyUI()'],
  ["ME.plan!=='agency'", "ME.plan!=='agency'"],
  ["fetch agency/analytics", "fetch('/api/agency/analytics'"],
  ["fetch agency/clients", "fetch('/api/agency/clients'"],
];

for (const [name, snippet] of checks) {
  const found = compact(c).includes(compact(snippet));
  console.log(`${found ? '✅' : '❌'} ${name}: ${found}`);
}
