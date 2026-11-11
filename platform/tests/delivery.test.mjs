import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store, SerialQueue } from '../server/store.mjs';
import { Artifacts, digest, inventory } from '../server/artifacts.mjs';
import { DeliveryService } from '../server/delivery.mjs';
import { ProjectService } from '../server/projects.mjs';
import { Auth, passwordHash } from '../server/auth.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(),'prototype-delivery-')), store = new Store(':memory:');
  store.insert('projects',{id:'retail',workspace_id:'lab'});
  store.insert('requirements',{id:'retail/req1',project_id:'retail',requirement_id:'req1',change_id:'change1'});
  store.insert('changes',{id:'change1',project_id:'retail',status:'pending'});
  const archive=join(root,'archives','build1'); await mkdir(join(archive,'requirements'),{recursive:true});
  await writeFile(join(archive,'index.html'),'<h1>fixed prototype</h1>');
  await writeFile(join(archive,'requirements','req1.json'),JSON.stringify({manifest:{acceptance_criteria:['AC-1','AC-2'],prd:{commit:'prdsha',path:'req1.md'}}}));
  store.insert('builds',{id:'build1',project_id:'retail',requirement_id:'req1',archive,artifact_sha256:digest(await inventory(archive)),candidate_commit:'candidate',source_commit:'source',attempt_id:'attempt1'});
  store.insert('attempts',{id:'attempt1',project_id:'retail',requirement_key:'retail/req1',change_id:'change1',status:'awaiting_acceptance',
    build_id:'build1',candidate_commit:'candidate',target_main_sha:'base',source_head_sha:'source',branch:'integration/req1/attempt1',verification:{browser_passed:true}});
  let main='base';
  const repo={fetch:async()=>{},sha:async ref=>ref==='main'?main:'candidate',publishCandidate:async()=>{}};
  const projects=new ProjectService(store,()=>repo,root),artifacts=new Artifacts(store,root);
  const gitlab={commitAcceptance:async(p,r)=>({commit:'docscommit',path:`${r.id}.json`}),mergeCandidate:async()=>{main='candidate';return {merged_commit:'candidate',mr_iid:1};}};
  const service=new DeliveryService(projects,artifacts,null,gitlab);
  const human={id:'test-human-fixture',kind:'human',projects:{retail:'admin'}};
  t.after(async()=>{store.close();await rm(root,{recursive:true,force:true});});
  return {store,artifacts,service,human,archive,setMain:value=>{main=value;},gitlab};
}
const acceptance={build_id:'build1',candidate_commit:'candidate',results:[{id:'AC-1',passed:true},{id:'AC-2',passed:true}]};
test('验收绑定产物、条件和真实会话角色，Agent 不能签发',async t=>{
  const f=await fixture(t);
  await assert.rejects(f.service.accept({...f.human,kind:'agent'},'attempt1',acceptance),{code:'HUMAN_REQUIRED'});
  await assert.rejects(f.service.accept(f.human,'attempt1',{...acceptance,candidate_commit:'other'}),{code:'STALE_ACCEPTANCE'});
  await assert.rejects(f.service.accept(f.human,'attempt1',{...acceptance,results:[acceptance.results[0]]}),{code:'INCOMPLETE_ACCEPTANCE'});
  f.gitlab.commitAcceptance=async()=>{throw new Error('docs unavailable');};
  await assert.rejects(f.service.accept(f.human,'attempt1',acceptance),/docs unavailable/);
  assert.equal(f.store.list('snapshots').length,0);
  assert.equal(f.store.get('attempts','attempt1').status,'awaiting_acceptance');
});
test('确认、合并、同包发布三项完成才交付，历史快照不可覆盖',async t=>{
  const f=await fixture(t),snapshot=await f.service.accept(f.human,'attempt1',acceptance);
  assert.equal(f.store.get('changes','change1').status,'pending');
  await assert.rejects(f.service.release(f.human,snapshot.id,'release1'),{code:'MERGE_REQUIRED'});
  const merge=await f.service.merge(f.human,'attempt1');
  assert.equal(merge.merged_commit,'candidate');
  assert.equal(f.store.get('changes','change1').status,'pending');
  f.setMain('later-main'); // post-merge publication must not apply the pre-merge base rule
  const published=await f.service.release(f.human,snapshot.id,'release1');
  assert.equal(published.build_id,'build1');
  assert.equal(f.store.get('changes','change1').status,'delivered');
  assert.equal((await f.service.release(f.human,snapshot.id,'release1')).id,published.id);
  assert.equal(f.store.list('deliveries').length,1);
  assert.throws(()=>f.store.update('snapshots',snapshot.id,{candidate_commit:'new'}),{code:'IMMUTABLE'});
});
test('过期候选拒绝合并，保留原验收',async t=>{
  const f=await fixture(t),snapshot=await f.service.accept(f.human,'attempt1',acceptance);
  f.setMain('advanced');
  await assert.rejects(f.service.merge(f.human,'attempt1'),{code:'STALE_CANDIDATE'});
  assert.equal(f.store.get('attempts','attempt1').status,'stale');
  assert.equal(f.store.get('snapshots',snapshot.id).candidate_commit,'candidate');
  assert.equal(f.store.list('merges').length,0);
});
test('归档可恢复，损坏在线副本隔离修复，损坏原始包拒绝替换',async t=>{
  const f=await fixture(t),cache=await f.artifacts.restore('build1');
  await writeFile(join(cache,'index.html'),'corrupted cache');
  await f.artifacts.restore('build1');
  assert.equal(await readFile(join(cache,'index.html'),'utf8'),'<h1>fixed prototype</h1>');
  await writeFile(join(f.archive,'index.html'),'corrupted archive');
  await assert.rejects(f.artifacts.restore('build1'),{code:'CORRUPT_ARCHIVE'});
});
test('发布失败不切换当前版本，重试不要求再次合并',async t=>{
  const f=await fixture(t),snapshot=await f.service.accept(f.human,'attempt1',acceptance);
  await f.service.merge(f.human,'attempt1');
  const restore=f.artifacts.restore.bind(f.artifacts); f.artifacts.restore=async()=>{throw new Error('disk unavailable');};
  await assert.rejects(f.service.release(f.human,snapshot.id,'release1'),/disk unavailable/);
  assert.equal(f.store.get('projects','retail').current_release_id,undefined);
  assert.equal(f.store.get('changes','change1').status,'pending');
  f.artifacts.restore=restore;
  assert.equal((await f.service.release(f.human,snapshot.id,'release1')).status,'published');
});
test('登录身份来自受控用户记录，会话过期不可用',()=>{
  const store=new Store(':memory:');
  store.insert('users',{id:'user1',username:'tester',kind:'human',password_hash:passwordHash('test-password'),projects:{retail:'reviewer'}});
  const auth=new Auth(store);
  assert.throws(()=>auth.login('tester','wrong'),{code:'BAD_LOGIN'});
  const login=auth.login('tester','test-password');
  assert.equal(login.user.password_hash,undefined);
  const request={headers:{cookie:`prototype_session=${login.token}`}};
  const session=auth.session(request);assert.equal(session.user.id,'user1');
  store.update('sessions',session.id,{expires_at:0});assert.equal(auth.session(request),null);store.close();
});
