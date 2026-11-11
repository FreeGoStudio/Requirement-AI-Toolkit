import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { api, artifactUrl } from './api.js';
import './style.css';

const words = { pending:'待处理', delivered:'已交付', awaiting_manual_resolution:'待人工处理冲突', awaiting_verification:'待验证',
  awaiting_acceptance:'待确认', approved:'已确认', rejected:'已驳回', stale:'基线已变化', failed:'失败', published:'已发布', active:'开发中',
  integrating:'集成中', completed:'已完成', already_included:'已包含' };
const short = value => value?.slice(0, 8) || '—';
function Status({ value, fallback = '未完成' }) { return <span className={`status ${value || ''}`}>{words[value] || fallback}</span>; }
function Login({ onLogin }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  return <main className="login"><h1>原型工作台</h1><p>登录后查看需求分支、集成候选与发布记录。</p><form onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError(''); const values = Object.fromEntries(new FormData(event.currentTarget));
    try { onLogin((await api('/login', values)).user); } catch(error) { setError(error.message); } finally { setBusy(false); }
  }}><label>账号<input name="username" required autoComplete="username" /></label><label>密码<input name="password" type="password" required autoComplete="current-password" /></label><button className="primary" disabled={busy}>{busy?'登录中…':'登录'}</button><p role="alert" className="error">{error}</p></form></main>;
}
function NewRequirement({ project, close, run }) {
  return <div className="modal-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="new-title" className="modal"><h2 id="new-title">新建需求</h2><p>从项目最新 main 创建同名源码分支，创建时不构建或发布。</p><form onSubmit={event => {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
    run(() => api(`/projects/${project.id}/requirements`, { ...values, prd: project.default_prd }), close);
  }}><label>需求编号<input name="requirement_id" placeholder="例如 reqsms002；留空自动生成" /></label><label>需求名称<input name="title" required /></label><label>Plane 工作项 ID<input name="plane_id" placeholder="已关联的工作项 UUID" /></label><div className="actions"><button type="button" onClick={close}>取消</button><button className="primary">创建需求分支</button></div></form></section></div>;
}
function Acceptance({ attempt, build, close, run }) {
  const [criteria, setCriteria] = useState([]), [error, setError] = useState('');
  useEffect(() => { api(`/integrations/${attempt.id}/criteria`).then(data => setCriteria(data.criteria)).catch(error => setError(error.message)); }, [attempt.id]);
  return <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true"><h2>确认固定候选</h2><p>提交 {short(attempt.candidate_commit)} · 构建 {build?.id}</p><a href={artifactUrl(attempt.build_id)} target="_blank" rel="noreferrer">打开待验收原型 ↗</a><form onSubmit={event => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    run(() => api(`/integrations/${attempt.id}/acceptance`, { build_id: attempt.build_id, candidate_commit: attempt.candidate_commit,
      results: criteria.map(id => ({ id, passed: form.has(id) })) }), close);
  }}>{criteria.map(id => <label className="check" key={id}><input type="checkbox" required name={id} />{id} 已查看并确认通过</label>)}<p className="error">{error}</p><p>确认身份来自当前登录用户。自动验证通过不代替此人工确认。</p><div className="actions"><button type="button" onClick={close}>取消</button><button className="primary" disabled={!criteria.length}>确认验收</button></div></form></section></div>;
}
function Detail({ req, data, run }) {
  const [target, setTarget] = useState('main');
  if (!req) return <aside className="detail"><h2>选择一个需求</h2><p>查看源码、固定候选及交付依据。</p></aside>;
  const attempts = data.attempts.filter(a => a.requirement_key === req.id), attempt = attempts.at(-1);
  const snapshot = data.snapshots.filter(s => s.requirement_key === req.id).at(-1);
  const merge = snapshot && data.merges.find(m => m.snapshot_id === snapshot.id);
  const release = snapshot && data.releases.find(r => r.snapshot_id === snapshot.id && r.status === 'published');
  const preview = data.previews.find(p => p.id === req.preview_id);
  const base = `/projects/${data.project.id}/requirements/${req.requirement_id}`;
  return <aside className="detail"><h2>{req.title}</h2><p>需求分支：<code>{req.branch}</code></p><p>开发基准：{short(req.working_base_commit)}</p><div className="actions">
    <button className="primary" onClick={() => run(async () => { const build = await api(`${base}/builds`, {}); await api(`${base}/preview-publications`, { build_id: build.id }); })}>构建开发预览</button>
    <button onClick={() => run(() => api(`${base}/integrations`, {}))}>＋ 创建候选</button></div>
    <section><h3>同步开发基准</h3><label>主线版本或精确提交<input aria-label="同步目标版本" value={target} onChange={e => setTarget(e.target.value)} /></label><button onClick={() => run(() => api(`${base}/base-syncs`, { target }))}>准备同步</button><p className="muted">同步保留本需求修改；冲突在独立工作区处理。</p></section>
    <section><h3>验收与集成依据</h3><ol className="evidence"><li><div><strong>人工验收</strong><p>{snapshot ? `确认者 ${snapshot.reviewer}` : '需求功能的人工验收结果'}</p></div><Status value={snapshot?'approved':null} fallback="待确认" /></li><li><div><strong>合入 main</strong><p>{merge ? `MR !${merge.mr_iid} · ${short(merge.merged_commit)}` : '合入已确认的集成候选'}</p></div><Status value={merge?'completed':null} fallback="未合并" /></li><li><div><strong>持续原型</strong><p>使用已确认的完整原型包</p></div><Status value={release?'published':null} fallback="未发布" /></li></ol></section>
    <section><h3>相关链接</h3><div className="link-row">当前需求预览 {preview ? <a href={artifactUrl(preview.build_id)} target="_blank" rel="noreferrer">查看预览 ↗</a> : <span>待构建</span>}</div><div className="link-row">固定验收版本 {snapshot ? <a href={artifactUrl(snapshot.build_id)} target="_blank" rel="noreferrer">查看版本 ↗</a> : <span>尚未确认</span>}</div></section>
    {attempt?.status === 'awaiting_manual_resolution' && <section><h3>待处理冲突</h3>{attempt.conflicts.map(file => <p key={file}><code>{file}</code></p>)}<p>处理并提交后，在候选列表重新验证。</p></section>}
  </aside>;
}
function Workspace({ user, logout }) {
  const [workspaces,setWorkspaces]=useState([]),[workspace,setWorkspace]=useState(''),[projects,setProjects]=useState([]),[projectId,setProject]=useState('');
  const [data,setData]=useState(null),[selected,setSelected]=useState(''),[tab,setTab]=useState('需求'),[search,setSearch]=useState('');
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[modal,setModal]=useState(null),[filter,setFilter]=useState('all');
  useEffect(()=>{api('/workspaces').then(items=>{setWorkspaces(items);setWorkspace(items[0]?.id||'');}).catch(e=>setError(e.message));},[]);
  useEffect(()=>{if(workspace) api(`/workspaces/${workspace}/projects`).then(items=>{setProjects(items);setProject(items[0]?.id||'');}).catch(e=>setError(e.message));},[workspace]);
  const refresh=async()=>{if(projectId){const value=await api(`/projects/${projectId}`);setData(value);setSelected(old=>value.requirements.some(r=>r.id===old)?old:value.requirements[0]?.id||'');}};
  useEffect(()=>{refresh().catch(e=>setError(e.message));},[projectId]);
  async function run(fn,after){setBusy(true);setError('');try{await fn();await refresh();after?.();}catch(e){setError(e.message);}finally{setBusy(false);}}
  const req=data?.requirements.find(r=>r.id===selected);
  const filtered=data?.requirements.filter(r=>(r.title+r.requirement_id).toLowerCase().includes(search.toLowerCase())&&(filter==='all'||data.attempts.some(a=>a.requirement_key===r.id&&a.status===filter)))||[];
  return <div className="app"><aside className="sidebar"><h1>原型工作台</h1><label>工作空间<select value={workspace} onChange={e=>setWorkspace(e.target.value)}>{workspaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label><h3>项目</h3>{projects.map(p=><button key={p.id} className={p.id===projectId?'selected':''} onClick={()=>setProject(p.id)}>▱　{p.name}</button>)}<footer><span>{user.name || user.username}</span><button onClick={logout}>退出登录</button></footer></aside><main className="workspace"><header><div><h1>{data?.project.name||'项目'}</h1><p>需求分支、集成验收与发布</p></div><button className="primary" disabled={!data||busy} onClick={()=>setModal('new')}>＋ 新建需求</button></header>
    <div className="connections"><strong>项目连接</strong><span>GitLab · {data?.project.gitlab_project_id?'已配置':'未配置'}</span><span>Plane · {data?.project.plane_project_id?'已关联':'未关联'}</span><span>当前产品 · {data?.project.current_release_id?'已发布':'尚未发布'}</span></div>
    <nav className="tabs">{['需求','集成候选','发布历史','项目设置'].map(label=><button key={label} className={tab===label?'active':''} onClick={()=>setTab(label)}>{label}</button>)}</nav>
    {error&&<p role="alert" className="alert">{error}<button onClick={()=>setError('')}>关闭</button></p>}{busy&&<p role="status" className="busy">正在执行，构建可能需要一段时间…</p>}
    {data&&tab==='需求'&&<div className="content"><section className="list"><div className="filters"><input aria-label="搜索需求" placeholder="搜索需求编号或名称" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="验收状态" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">验收：全部</option><option value="awaiting_acceptance">待确认</option><option value="approved">已确认</option><option value="awaiting_manual_resolution">待处理冲突</option></select><button onClick={()=>{setSearch('');setFilter('all');}}>重置</button></div><div className="table-wrap"><table><thead><tr><th>需求</th><th>开发分支</th><th>验收</th><th>合并</th><th>发布</th><th>操作</th></tr></thead><tbody>{filtered.map(r=>{const snapshot=data.snapshots.filter(s=>s.requirement_key===r.id).at(-1),merge=snapshot&&data.merges.find(m=>m.snapshot_id===snapshot.id),release=snapshot&&data.releases.find(p=>p.snapshot_id===snapshot.id&&p.status==='published');return <tr key={r.id} className={r.id===selected?'chosen':''}><td><button className="text-link" onClick={()=>setSelected(r.id)}>{r.requirement_id}</button><div>{r.title}</div></td><td>{r.branch}</td><td><Status value={snapshot?'approved':null} fallback="待确认"/></td><td><Status value={merge?'completed':null} fallback="未合并"/></td><td><Status value={release?'published':null} fallback="未发布"/></td><td><button className="text-link" onClick={()=>setSelected(r.id)}>查看</button></td></tr>;})}</tbody></table>{!filtered.length&&<div className="empty">{data.requirements.length?'没有匹配的需求':'尚无需求，点击“新建需求”创建第一个源码分支。'}</div>}</div></section><Detail req={req} data={data} run={run}/></div>}
    {data&&tab==='集成候选'&&<section className="records"><h2>固定集成候选</h2>{!data.attempts.length&&<p className="empty">从需求详情创建候选后，在此处理冲突、验证和验收。</p>}{data.attempts.map(a=><article key={a.id}><div><h3>{a.requirement_key}</h3><p>{short(a.source_head_sha)} → main {short(a.target_main_sha)}</p><Status value={a.status}/></div><div className="actions">{['awaiting_verification','awaiting_manual_resolution'].includes(a.status)&&<button disabled={busy} onClick={()=>run(()=>api(`/projects/${projectId}/requirements/${a.requirement_key.split('/')[1]}/builds`,{attempt_id:a.id}))}>构建并验证</button>}{a.build_id&&<a href={artifactUrl(a.build_id)} target="_blank" rel="noreferrer">打开候选 ↗</a>}{a.status==='awaiting_acceptance'&&<button onClick={()=>setModal(a)}>人工验收</button>}{a.status==='approved'&&<button onClick={()=>run(()=>api(`/integrations/${a.id}/merge`,{}))}>合入 main</button>}{a.snapshot_id&&data.merges.some(m=>m.snapshot_id===a.snapshot_id)&&<button className="primary" onClick={()=>run(()=>api(`/snapshots/${a.snapshot_id}/releases`,{}))}>发布确认版本</button>}</div></article>)}<h2>基准同步</h2>{data.syncs.map(s=><article key={s.id}><div>{s.requirement_key}<p>{short(s.source_head_sha)} → {short(s.target_commit)}</p><Status value={s.status}/></div><button disabled={busy||!['awaiting_verification','awaiting_manual_resolution'].includes(s.status)} onClick={()=>run(()=>api(`/base-syncs/${s.id}/verify`,{}))}>验证同步结果</button></article>)}</section>}
    {data&&tab==='发布历史'&&<section className="records"><h2>需求预览与持续原型</h2>{[...data.previews.map(p=>({...p,kind:'需求预览'})),...data.releases.map(p=>({...p,kind:'持续原型'}))].sort((a,b)=>b.created_at.localeCompare(a.created_at)).map(p=><article key={p.id}><div><h3>{p.kind} · {p.requirement_key||p.snapshot_id}</h3><p>{new Date(p.created_at).toLocaleString()}</p><Status value={p.status}/></div><a href={artifactUrl(p.build_id)} target="_blank" rel="noreferrer">查看固定版本 ↗</a></article>)}<h2>验收快照</h2>{data.snapshots.map(s=><article key={s.id}><div>{s.requirement_key}<p>确认者 {s.reviewer} · {short(s.candidate_commit)}</p></div><button onClick={()=>run(()=>api(`/snapshots/${s.id}/restore`,{}))}>校验并恢复</button></article>)}</section>}
    {data&&tab==='项目设置'&&<section className="records settings"><h2>项目与来源</h2><dl><dt>项目 ID</dt><dd>{data.project.id}</dd><dt>工作空间</dt><dd>{data.project.workspace_id}</dd><dt>原型仓库</dt><dd>{data.project.gitlab_project_id}</dd><dt>需求资料仓库</dt><dd>{data.project.requirements_gitlab_id}</dd><dt>Plane 项目</dt><dd>{data.project.plane_project_id||'未关联'}</dd></dl><p>服务连接和授权在受控配置中管理。页面不显示令牌或密码。</p><button onClick={()=>run(()=>api(`/projects/${projectId}/requirements/sync`,{}))}>从 Plane 同步需求</button></section>}
  </main>{modal==='new'&&<NewRequirement project={data.project} close={()=>setModal(null)} run={run}/>} {modal&&modal!=='new'&&<Acceptance attempt={modal} build={data.builds.find(b=>b.id===modal.build_id)} close={()=>setModal(null)} run={run}/>}</div>;
}
function App(){const[user,setUser]=useState(null),[loading,setLoading]=useState(true);useEffect(()=>{api('/me').then(r=>setUser(r.user)).catch(()=>{}).finally(()=>setLoading(false));},[]);if(loading)return <p className="empty">正在读取会话…</p>;return user?<Workspace user={user} logout={async()=>{await api('/logout',{});setUser(null);}}/>:<Login onLogin={setUser}/>;}
createRoot(document.getElementById('root')).render(<App/>);
