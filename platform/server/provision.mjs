import { mkdir, cp, readFile, writeFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import YAML from 'yaml';
import { GitRepository, git } from './git.mjs';
import { requireThat } from './errors.mjs';

export async function provisionProject({ store, projects, gitlab, config, dataRoot, template }, actor, input, key) {
  requireThat(actor.workspaces?.[input.workspace_id] === 'admin', 'FORBIDDEN', '需要工作空间管理员权限', 403);
  store.get('workspaces', input.workspace_id);
  requireThat(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.id) && input.name?.trim(), 'INVALID_PROJECT', '项目编号或名称无效');
  return projects.queue.run(`provision:${input.id}`, async () => {
    let project = store.get('projects',input.id,false);
    requireThat(!project || project.provision_key === key, 'DUPLICATE_PROJECT', '项目编号已存在');
    if (project?.status === 'ready') return { id: project.id, status: project.status };
    project ||= store.insert('projects',{id:input.id,name:input.name,workspace_id:input.workspace_id,status:'provisioning',provision_key:key,
      plane_project_id:input.plane_project_id,plane_workspace_slug:input.plane_workspace_slug});
    const create = async (suffix,readme) => gitlab.request('/projects','POST',{name:`${input.id}-${suffix}`,path:`${input.id}-${suffix}`,
      ...(config.gitlab_namespace_id ? {namespace_id:config.gitlab_namespace_id} : {}),visibility:'private',default_branch:'main',initialize_with_readme:readme,
      merge_method:'ff',squash_option:'never'});
    if (!project.requirements_gitlab_id) {
      const repository = await create('requirements',true);
      project = store.update('projects',project.id,{requirements_gitlab_id:repository.id,requirements_url:repository.web_url});
    }
    if (!project.gitlab_project_id) {
      const repository = await create('prototype',false);
      project = store.update('projects',project.id,{gitlab_project_id:repository.id,repository_url:repository.http_url_to_repo,gitlab_web_url:repository.web_url});
    }
    const remote = await gitlab.request(`/projects/${project.gitlab_project_id}`);
    if (remote.empty_repo) {
      const seed=join(dataRoot,'seeds',project.id); await mkdir(seed,{recursive:true});
      await cp(template,seed,{recursive:true,filter:path=>!/(^|[\\/])(node_modules|storybook-static|dist|requirements)([\\/]|$)/.test(path)});
      const path=join(seed,'prototype.yaml'),prototype=YAML.parse(await readFile(path,'utf8'));
      prototype.project_id=project.id;prototype.workspace_id=project.workspace_id;
      await writeFile(path,YAML.stringify(prototype));
      await mkdir(join(seed,'requirements'),{recursive:true}); await writeFile(join(seed,'requirements','.gitkeep'),'');
      await git(seed,['init','-b','main']); await git(seed,['add','.']);
      const repo=new GitRepository(seed,{token:config.gitlab_token});
      if (await repo.run(['status','--porcelain'])) await repo.run(['commit','-m','Initialize multi-app Storybook project']);
      await repo.run(['push',project.repository_url,'HEAD:refs/heads/main']);
    }
    const rules=await gitlab.request(`/projects/${project.gitlab_project_id}/protected_branches`);
    if (!rules.some(rule=>rule.name==='main')) await gitlab.request(`/projects/${project.gitlab_project_id}/protected_branches`,'POST',{name:'main',push_access_level:0,merge_access_level:40});
    // GitLab can apply a default main rule during the first push. Tighten it
    // atomically without temporarily removing protection.
    else {
      const main=rules.find(rule=>rule.name==='main');
      if(main.push_access_levels.some(level=>level.access_level!==0)) await gitlab.request(`/projects/${project.gitlab_project_id}/protected_branches/main`,'PATCH',{
        allowed_to_push:[...main.push_access_levels.map(level=>({id:level.id,_destroy:true})),{access_level:0}]
      });
    }
    await gitlab.validateProject(project.gitlab_project_id);
    const bare=resolve(dataRoot,'repositories',`${project.id}.git`);
    try { await access(join(bare,'HEAD')); } catch { await GitRepository.clone(project.repository_url,bare,config.gitlab_token); }
    store.update('projects',project.id,{repo_path:bare,status:'ready'});
    store.event(project.id,actor.id,'project.provisioned',project.id);
    return {id:project.id,status:'ready'};
  });
}
