import { requireThat } from './errors.mjs';

// Provider contract is intentionally a data-only proposal: no shell commands,
// filesystem access, approval credentials or permission to alter main.
export class ConflictAssistant {
  constructor(projects, provider, { attempts = 2, timeoutMs = 30000 } = {}) {
    this.projects=projects;this.provider=provider;this.attempts=Math.min(attempts,2);this.timeoutMs=Math.min(timeoutMs,60000);
  }
  async run(table, record) {
    return this.projects.queue.run(`ai:${record.id}`,()=>this.runLocked(table,record.id));
  }
  async runLocked(table, id) {
    const record=this.projects.store.get(table,id);
    if(record.status!=='awaiting_manual_resolution'||!this.provider)return record;
    const actor={id:'conflict-assistant',kind:'agent',projects:{[record.project_id]:'developer'}};
    const files=await this.projects.conflictFiles(actor,table,record.id);
    requireThat(files.length<=20 && JSON.stringify(files).length<1000000,'CONFLICT_TOO_LARGE','冲突超出自动处理范围，请人工接管');
    this.projects.store.event(record.project_id,actor.id,'conflict.original',record.id,{files,source_head_sha:record.source_head_sha,target:record.target_main_sha||record.target_commit});
    const prior=this.projects.store.list('events',record.project_id).filter(e=>e.target===record.id&&e.type==='conflict.ai_attempt_started').length;
    for(let attempt=prior+1;attempt<=this.attempts;attempt++){
      this.projects.store.event(record.project_id,actor.id,'conflict.ai_attempt_started',record.id,{attempt});
      try {
        const proposal=await this.provider({files,prd:record.prd,source_head_sha:record.source_head_sha,target_commit:record.target_main_sha||record.target_commit,
          instruction:'仅解决实现冲突，保留两侧仍有效能力；业务含义不明确时返回 manual_required。不得改变业务规则、删除测试或验收条件。'},AbortSignal.timeout(this.timeoutMs));
        if(proposal.manual_required){this.projects.store.event(record.project_id,actor.id,'conflict.manual_handoff',record.id,{reason:proposal.reason});return record;}
        return await this.projects.resolveConflicts(actor,table,record.id,{...proposal,source_head_sha:record.source_head_sha});
      }catch(error){this.projects.store.event(record.project_id,actor.id,'conflict.ai_attempt_failed',record.id,{attempt,error:error.message});}
    }
    return this.projects.store.get(table,record.id);
  }
}
export function conflictProvider(config) {
  if(!config?.url)return null;
  return async (input,signal)=>{
    const response=await fetch(config.url,{method:'POST',headers:{'Content-Type':'application/json',...(config.token?{Authorization:`Bearer ${config.token}`}:{})},body:JSON.stringify(input),signal});
    requireThat(response.ok,'AI_SERVICE_FAILED',`冲突修复服务 HTTP ${response.status}`);
    const text=await response.text();requireThat(text.length<1000000,'AI_RESPONSE_TOO_LARGE','修复提案超出限制');
    return JSON.parse(text);
  };
}
