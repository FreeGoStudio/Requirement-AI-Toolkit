import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { GitLab } from '../server/connectors.mjs';
import { GitRepository, git } from '../server/git.mjs';
import { Store } from '../server/store.mjs';
import { passwordHash } from '../server/auth.mjs';
import YAML from 'yaml';
const root = resolve('platform/.local'), bootstrap = JSON.parse((await readFile(join(root, 'gitlab-bootstrap.json'), 'utf8')).replace(/^\uFEFF/, ''));
const client = new GitLab('http://127.0.0.1:8929', bootstrap.token);
const docs = bootstrap.projects.find(p=>p.name.endsWith('-requirements')), prototype = bootstrap.projects.find(p=>p.name.endsWith('-prototype'));
const docsProject = await client.request(`/projects/${docs.id}`);
let prdCommit;
if (docsProject.empty_repo) {
  const result = await client.request(`/projects/${docs.id}/repository/commits`, 'POST', {
    branch:'main', commit_message:'Initialize local prototype acceptance requirements', actions:[{action:'create',file_path:'requirements/reqsms001/prd.md',content:'# 短信验证码登录（平台测试用例）\n\n- AC-001：后台启用短信登录，切换至 POS 后设置仍生效。\n- AC-002：模拟验证码 123456 登录成功；错误验证码保留页面并提示。\n\n仅验证原型平台能力，不代表真实业务需求已获批准。\n'}] });
  prdCommit = result.id;
} else prdCommit = (await client.request(`/projects/${docs.id}/repository/branches/main`)).commit.id;
const prototypeProject = await client.request(`/projects/${prototype.id}`);
const bare = join(root,'repositories','prototype-lab.git');
if (prototypeProject.empty_repo) {
  const seed = join(root,'seed'); await mkdir(seed,{recursive:true});
  await cp(resolve('platform/templates/prototype'),seed,{recursive:true,filter:path=>!/(^|[\\/])(node_modules|storybook-static|dist)([\\/]|$)/.test(path)});
  const manifestPath=join(seed,'requirements/reqsms001/manifest.yaml');
  const manifest=YAML.parse(await readFile(manifestPath,'utf8')); manifest.prd.commit=prdCommit;
  await writeFile(manifestPath,YAML.stringify(manifest));
  await git(seed,['init','-b','main']); await git(seed,['add','.']); await git(seed,['commit','-m','Initialize two-app Storybook prototype']);
  await git(seed,['remote','add','origin',prototype.url]);
  const repo=new GitRepository(seed,{token:bootstrap.token}); await repo.run(['push','-u','origin','main']);
}
await client.request(`/projects/${prototype.id}`,'PUT',{merge_method:'ff',squash_option:'never',only_allow_merge_if_pipeline_succeeds:false});
const protectedBranches=await client.request(`/projects/${prototype.id}/protected_branches`);
const protectedMain=protectedBranches.find(b=>b.name==='main');
if(!protectedMain) await client.request(`/projects/${prototype.id}/protected_branches`,'POST',{name:'main',push_access_level:0,merge_access_level:40,allow_force_push:false});
else if(!protectedMain.push_access_levels.every(level=>level.access_level===0)) throw new Error('main 已有保护规则允许推送；请核对测试仓库保护配置，不自动移除规则');
try { await readFile(join(bare,'HEAD')); } catch { await GitRepository.clone(prototype.url,bare,bootstrap.token); }
const store=new Store(join(root,'platform.sqlite'));
if(!store.get('workspaces','local-workflow-lab',false))store.insert('workspaces',{id:'local-workflow-lab',name:'本机验证'});
const prd={repository:docs.name,path:'requirements/reqsms001/prd.md',commit:prdCommit};
if(!store.get('projects','prototype-lab',false))store.insert('projects',{id:'prototype-lab',name:'零售原型',workspace_id:'local-workflow-lab',gitlab_project_id:prototype.id,requirements_gitlab_id:docs.id,repo_path:bare,default_prd:prd,gitlab_url:'http://127.0.0.1:8929'});
if(!store.list('users').length){
  const password=randomBytes(18).toString('base64url');
  store.insert('users',{id:'local-reviewer',username:'reviewer',name:'本机验收用户',kind:'human',password_hash:passwordHash(password),workspaces:{'local-workflow-lab':'admin'}});
  store.insert('users',{id:'local-agent',username:'agent',kind:'agent',password_hash:passwordHash(randomBytes(32).toString('hex')),workspaces:{'local-workflow-lab':'developer'}});
  await writeFile(join(root,'reviewer-login.json'),JSON.stringify({username:'reviewer',password},null,2));
}
const config={port:3077,artifact_port:3078,public_url:'http://127.0.0.1:3077',data_dir:root,gitlab_url:'http://127.0.0.1:8929',gitlab_token:bootstrap.token,runner_image:'prototype-platform-runner:10.6.7'};
let existingConfig={}; try { existingConfig=JSON.parse(await readFile(resolve('platform/config.local.json'),'utf8')); } catch(error) { if(error.code!=='ENOENT') throw error; }
await writeFile(resolve('platform/config.local.json'),JSON.stringify({...config,...existingConfig},null,2));
store.close(); console.log(JSON.stringify({project_id:'prototype-lab',gitlab_project_id:prototype.id,requirements_gitlab_id:docs.id,credentials_file:join(root,'reviewer-login.json')}));
