import {connect} from '../../../packages/prototype-sdk/index.js';
import '../../../packages/prototype-sdk/style.css';
import './todo.css';
export default {id:'todo-application',title:'TodoList/待办',parameters:{layout:'fullscreen'}};
function renderStory(initialRoute){
 const root=document.createElement('div');
 connect('todo',root,(view,{state,route,patch,navigate})=>{
  const tasks=state.tasks||[];
  if(view.dataset.view!==route){
   view.dataset.view=route;
   view.innerHTML='<main><nav><button data-nav="/tasks">待办列表</button><button data-nav="/summary">统计</button><button data-settings>设置</button></nav><section></section></main>';
   for(const b of view.querySelectorAll('[data-nav]'))b.onclick=()=>navigate('todo',b.dataset.nav);
   view.querySelector('[data-settings]').onclick=()=>navigate('settings','/settings');
   const section=view.querySelector('section');
   if(route==='/summary')section.innerHTML='<h1>待办统计</h1><output aria-label="统计"></output>';
   else if(route==='/outside')section.innerHTML='<h1>范围外页面</h1><p>用于技术验收越界提示。</p>';
   else section.innerHTML='<h1>今日待办</h1><p>在一个固定版本中验证完整流程。</p><form><label>新待办<input aria-label="新待办" data-prototype-id="todo.input" maxlength="160"></label><button type="submit">添加待办</button><p role="alert"></p></form><label>筛选<select aria-label="筛选"><option value="all">全部</option><option value="active">待完成</option><option value="done">已完成</option></select></label><ul aria-label="待办列表"></ul><p data-empty>暂无待办</p><a href="/outside" data-route="/outside">范围外页面</a> <a href="/tasks" data-route="/tasks" target="_blank">独立新窗口</a>';
  }
  if(route==='/summary'){view.querySelector('output').textContent=`总计 ${tasks.length} · 已完成 ${tasks.filter(t=>t.done).length}`;return;}
  if(route==='/outside')return;
  const input=view.querySelector('input');if(input.value!==(state.draft||''))input.value=state.draft||'';
  input.oninput=()=>patch({draft:input.value});
  const form=view.querySelector('form');form.onsubmit=e=>{e.preventDefault();const title=input.value.trim();if(!title){form.querySelector('[role="alert"]').textContent='请输入待办内容';return;}patch({tasks:[...tasks,{id:crypto.randomUUID(),title,done:false}],draft:''});};
  const filter=view.querySelector('select');filter.value=state.filter||'all';filter.onchange=()=>patch({filter:filter.value});
  const list=view.querySelector('ul');list.replaceChildren();
  const shown=tasks.filter(t=>(state.showCompleted!==false||!t.done)&&(state.filter!=='active'||!t.done)&&(state.filter!=='done'||t.done));
  for(const task of shown){
   const li=document.createElement('li'),label=document.createElement('label'),check=document.createElement('input'),text=document.createElement('span'),del=document.createElement('button');
   check.type='checkbox';check.checked=task.done;check.setAttribute('aria-label',`完成 ${task.title}`);check.onchange=()=>patch({tasks:tasks.map(t=>t.id===task.id?{...t,done:check.checked}:t)});
   text.textContent=task.title;del.textContent='删除';del.setAttribute('aria-label',`删除 ${task.title}`);del.onclick=()=>patch({tasks:tasks.filter(t=>t.id!==task.id)});
   label.append(check,text);li.append(label,del);list.append(li);
  }
  view.querySelector('[data-empty]').hidden=shown.length>0;
 },{initialRoute,initialState:{tasks:[],draft:'',filter:'all',showCompleted:true}});
 return root;
}
export const Interactive={render:()=>renderStory('/tasks')};
export const Summary={render:()=>renderStory('/summary')};
