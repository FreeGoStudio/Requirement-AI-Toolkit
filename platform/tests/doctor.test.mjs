import test from 'node:test';
import assert from 'node:assert/strict';
import { probe } from '../scripts/doctor.mjs';
test('连通不冒充权限通过，服务错误保留失败', async () => {
  const unauthorized = await probe('http://localhost', async () => ({ status: 401 }));
  assert.equal(unauthorized.reachable, true);
  assert.equal(unauthorized.authenticated, false);
  assert.equal((await probe('http://localhost', async () => ({ status: 503, ok: false }))).endpoint_ok, false);
  assert.equal((await probe('http://localhost', async () => { throw new Error('secret'); })).error, 'Error');
});
