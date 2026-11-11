import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../server/store.mjs';
import { reconcilePlane } from '../server/plane-sync.mjs';

test('Plane 重复同步不重复建分支，状态变化不写回业务 Done',async()=>{
  const store=new Store(':memory:');let calls=0,state='started';
  const project={id:'p',workspace_id:'lab',plane_project_id:'plane1'};store.insert('projects',project);
  const services={store,projects:{authorize:()=>project,createRequirement:async(actor,p,input)=>{calls++;return store.insert('requirements',{id:`p/${input.requirement_id}`,project_id:p,...input});}},
    plane:{workItems:async()=>[{id:'issue1',sequence_id:7,name:'new name',state,updated_at:state}]}};
  await reconcilePlane(services,{},'p');await reconcilePlane(services,{},'p');assert.equal(calls,1);
  state='backlog';await reconcilePlane(services,{},'p');assert.equal(store.get('requirements','p/req7').plane_state,'backlog');
  assert.equal(store.list('builds').length,0);store.close();
});
