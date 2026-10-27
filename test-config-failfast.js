import assert from 'node:assert/strict';
import { worker } from './test/harness.js';

const request = new Request('https://harness.local/', { method: 'GET' });
const response = await worker.fetch(request, {}, {});
assert.equal(response.status, 500);
assert.deepEqual(await response.json(), {
  error: 'config_incompleta',
  faltando: ['REDIS_URL', 'REDIS_TOKEN', 'RESEND_KEY', 'TARGET_EMAIL']
});
console.log('fail-fast config vazio: PASS');
