import assert from 'node:assert/strict';
import { worker } from './test/harness.js';

const request = new Request('https://harness.local/', { method: 'GET' });

const emptyConfig = await worker.fetch(request, {}, {});
assert.equal(emptyConfig.status, 500);
assert.deepEqual(await emptyConfig.json(), {
  error: 'config_incompleta',
  faltando: ['REDIS_URL', 'REDIS_TOKEN', 'RESEND_KEY', 'TARGET_EMAIL', 'MIDAS_SECRET', 'JWT_SECRET']
});

const noSigningSecrets = await worker.fetch(request, {
  REDIS_URL: 'https://redis.invalid',
  REDIS_TOKEN: 'test-redis-token',
  RESEND_KEY: 'test-resend-key',
  TARGET_EMAIL: 'test@example.com'
}, {});
assert.equal(noSigningSecrets.status, 500);
assert.deepEqual(await noSigningSecrets.json(), {
  error: 'config_incompleta',
  faltando: ['MIDAS_SECRET', 'JWT_SECRET']
});

console.log('fail-fast config and signing-secret checks: PASS');
