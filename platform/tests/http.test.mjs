import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../server/store.mjs';
import { Auth, passwordHash } from '../server/auth.mjs';
import { ProjectService } from '../server/projects.mjs';
import { createApp, createArtifactApp } from '../server/main.mjs';

test('管理接口与所有静态资源均校验项目身份，跨源不能签发确认',async t=>{
  const store=new Store(':memory:');
  store.insert('workspaces',{id:'lab'});
  store.insert('projects',{id:'a',workspace_id:'lab'});store.insert('projects',{id:'b',workspace_id:'lab'});
  store.insert('users',{id:'u',username:'tester',kind:'human',password_hash:passwordHash('test-pass'),projects:{a:'reviewer'}});
  store.insert('builds',{id:'build-b',project_id:'b'});
  const auth=new Auth(store),projects=new ProjectService(store,()=>{},'unused');
  const app=createApp({store,auth,projects,config:{public_url:'http://workbench.test'}});
  const server=app.listen(0,'127.0.0.1'),assetServer=createArtifactApp({store,auth,projects,artifacts:{}}).listen(0,'127.0.0.1');
  await Promise.all([new Promise(r=>server.once('listening',r)),new Promise(r=>assetServer.once('listening',r))]);
  t.after(async()=>{await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>assetServer.close(r))]);store.close();});
  const base=`http://127.0.0.1:${server.address().port}`,assets=`http://127.0.0.1:${assetServer.address().port}`;
  assert.equal((await fetch(base+'/api/projects/a')).status,401);
  const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'tester',password:'test-pass'})});
  const session=await login.json(),cookie=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(base+'/api/projects/a',{headers:{cookie}})).status,200);
  assert.equal((await fetch(base+'/api/projects/b',{headers:{cookie}})).status,403);
  assert.equal((await fetch(assets+'/artifacts/build-b/apps/admin/assets/script.js',{headers:{cookie}})).status,403);
  assert.equal((await fetch(assets+'/artifacts/build-b/apps/admin/index.json')).status,401);
  const forged=await fetch(base+'/api/integrations/any/acceptance',{method:'POST',headers:{cookie,origin:'http://prototype.test','X-CSRF-Token':session.csrf,'Idempotency-Key':'x','Content-Type':'application/json'},body:'{}'});
  assert.equal(forged.status,403);assert.equal((await forged.json()).error,'CSRF');
});
