import {connect} from '../../../packages/prototype-sdk/index.js';
import '../../../packages/prototype-sdk/style.css';
export default {id:'settings-application',title:'TodoList/设置',parameters:{layout:'fullscreen'}};
export const Interactive={render:()=>{
 const root=document.createElement('div');
 connect('settings',root,(view,{appStates,patch,navigate})=>{
  view.innerHTML='<main><h1>显示设置</h1><label data-prototype-id="todo.settings"><input type="checkbox" aria-label="显示已完成">显示已完成待办</label><p>设置仅影响当前演示会话。</p><button>返回待办列表</button></main>';
  const check=view.querySelector('input');check.checked=appStates.todo?.showCompleted!==false;
  check.onchange=()=>patch({showCompleted:check.checked},'todo');
  view.querySelector('button').onclick=()=>navigate('todo','/tasks');
 },{initialRoute:'/settings'});return root;
}};
