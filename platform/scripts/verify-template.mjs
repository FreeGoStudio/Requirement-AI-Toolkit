import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DockerRunner } from '../server/runner.mjs';
import { Store } from '../server/store.mjs';
import { Artifacts } from '../server/artifacts.mjs';
import { verifyBrowser } from '../server/browser-verifier.mjs';
const config=JSON.parse(await readFile(process.env.PLATFORM_CONFIG || 'platform/config.local.json','utf8'));
const store=new Store(':memory:'),root=resolve('platform/.local/template-validation');
const project={id:'prototype-lab',workspace_id:'local-workflow-lab'};
try {
  const result=await new DockerRunner({image:config.runner_image,outputRoot:resolve(root,'output')}).build(resolve('platform/templates/prototype'),project);
  const artifact=await new Artifacts(store,resolve(root,'artifacts')).collect(project,result.output,result.config,'reqsms001',{
    source_commit:'unpublished-working-tree-template',toolchain:result.result});
  const evidence=await verifyBrowser(artifact,{executablePath:config.browser_executable});
  await mkdir(root,{recursive:true});await writeFile(resolve(root,'verification.json'),JSON.stringify(evidence,null,2));
  console.log(JSON.stringify({passed:evidence.passed,checks:evidence.checks.length,toolchain:result.result,evidence:resolve(root,'verification.json')}));
} finally {store.close();}
