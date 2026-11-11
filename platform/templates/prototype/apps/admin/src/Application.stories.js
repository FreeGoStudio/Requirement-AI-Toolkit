import { connect } from '../../../packages/prototype-sdk/index.js';
import '../../../packages/prototype-sdk/style.css';
export default { id: 'admin-application', title: '管理后台/应用', parameters: { layout: 'fullscreen' } };
export const Interactive = { render: () => {
  const root = document.createElement('div');
  connect('admin', root, (view, { state, route, patch, navigate }) => {
    view.innerHTML = '<main><nav><button data-action="settings">登录设置</button><button data-action="inventory">库存管理</button><button data-action="pos">前往 POS</button></nav><section></section></main>';
    const section = view.querySelector('section');
    if (route === '/inventory') section.innerHTML = '<h1>库存管理</h1><p>完整产品浏览中的辅助展示页。</p>';
    else {
      section.dataset.prototypeId = 'login.sms.settings';
      section.innerHTML = '<h1>登录方式设置</h1><p>设置会同步到当前演示中的 POS。切换页面不会重置。</p><label data-prototype-id="login.sms.enabled"><input type="checkbox" aria-label="启用短信验证码登录"> 启用短信验证码登录</label><p aria-live="polite"></p>';
      const input = section.querySelector('input'); input.checked = !!state.sms_login_enabled;
      input.onchange = () => { patch({ sms_login_enabled: input.checked }); patch({ sms_login_enabled: input.checked }, 'pos'); };
      section.querySelector('[aria-live]').textContent = state.sms_login_enabled ? '短信验证码登录已启用' : '当前仅启用账号密码登录';
    }
    view.querySelector('[data-action="settings"]').onclick = () => navigate('admin', '/settings');
    view.querySelector('[data-action="inventory"]').onclick = () => navigate('admin', '/inventory');
    view.querySelector('[data-action="pos"]').onclick = () => navigate('pos', '/login');
  });
  return root;
} };
