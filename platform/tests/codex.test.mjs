import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { codexArguments, codexProvider } from '../server/codex-provider.mjs';

test('Codex 使用结构化只读提案，无原型仓库写权限且不继承用户插件',()=>{
  const args=codexArguments('job-folder');
  assert.equal(args[args.indexOf('--sandbox')+1],'read-only');
  assert.ok(args.includes('--output-schema'));assert.ok(args.includes('--ignore-user-config'));
  assert.ok(args.includes('shell_tool'));assert.ok(args.includes('plugins'));assert.ok(args.includes('apps'));
  assert.ok(!args.some(value=>value.includes('dangerously')||value.includes('api-key')));
});
test('未配置 API key 时不启动 Codex，不用当前 ChatGPT 身份冒充 API 测试',async t=>{
  const root=await mkdtemp(join(tmpdir(),'codex-provider-test-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const provider=codexProvider({provider:'codex',api_key_file:join(root,'not-configured')},root);
  await assert.rejects(provider({files:[]},AbortSignal.timeout(100)),{code:'CODEX_API_KEY_REQUIRED'});
});
