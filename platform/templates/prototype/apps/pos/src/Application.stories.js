import { connect } from '../../../packages/prototype-sdk/index.js';
import '../../../packages/prototype-sdk/style.css';
export default { id: 'pos-application', title: 'POS/应用', parameters: { layout: 'fullscreen' } };
export const Interactive = { render: () => {
  const root = document.createElement('div');
  connect('pos', root, (view, { state, route, navigate }) => {
    view.innerHTML = route === '/home'
      ? '<main><h1>登录成功</h1><p>欢迎进入 POS 工作台。</p><button data-action="back">返回登录</button></main>'
      : '<main data-prototype-id="login.sms.panel"><h1>POS 登录</h1><p>此原型只使用模拟数据。</p><label>账号<input aria-label="账号" value="demo"></label><label>密码<input aria-label="密码" type="password" value="demo"></label><button class="primary" data-action="password">账号密码登录</button><div data-prototype-id="login.sms.entry"></div><small>登录成功后进入首页，状态在当前演示会话内保留。</small></main>';
    if (route === '/login' && state.sms_login_enabled) {
      const sms = view.querySelector('[data-prototype-id="login.sms.entry"]');
      sms.innerHTML = '<label>模拟验证码<input aria-label="验证码" placeholder="输入 123456"></label><button data-action="sms">短信验证码登录</button><p class="error" aria-live="polite"></p>';
      sms.querySelector('button').onclick = () => {
        if (sms.querySelector('input').value === '123456') navigate('pos', '/home');
        else sms.querySelector('.error').textContent = '验证码不正确，请输入模拟验证码 123456';
      };
    }
    view.querySelector('[data-action="password"]')?.addEventListener('click', () => navigate('pos', '/home'));
    view.querySelector('[data-action="back"]')?.addEventListener('click', () => navigate('pos', '/login'));
  });
  return root;
} };
