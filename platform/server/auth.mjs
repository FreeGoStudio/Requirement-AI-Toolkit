import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { requireThat } from './errors.mjs';
import { uid } from './store.mjs';
export const passwordHash = password => { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`; };
const tokenHash = token => createHash('sha256').update(token).digest('hex');
export class Auth {
  constructor(store) { this.store = store; this.failures = new Map(); }
  login(username, password) {
    const failure = this.failures.get(username);
    requireThat(!failure || failure.count < 8 || Date.now() - failure.at > 60000, 'RATE_LIMIT', '登录失败过多，请稍后重试', 429);
    const user = this.store.list('users').find(user => user.username === username);
    const [salt, expected] = (user?.password_hash || 'missing:' + '0'.repeat(128)).split(':');
    const actual = scryptSync(String(password || ''), salt, 64);
    if (!user || !timingSafeEqual(Buffer.from(expected, 'hex'), actual)) {
      this.failures.set(username, { count: (failure?.count || 0) + 1, at: Date.now() });
      requireThat(false, 'BAD_LOGIN', '账号或密码不正确', 401);
    }
    this.failures.delete(username);
    const token = randomBytes(32).toString('hex'), csrf = randomBytes(24).toString('hex');
    this.store.insert('sessions', { id: tokenHash(token), user_id: user.id, csrf, expires_at: Date.now() + 8 * 3600000 });
    return { token, csrf, user: this.publicUser(user) };
  }
  publicUser(user) { const { password_hash, ...visible } = user; return visible; }
  session(request) {
    const raw = request.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith('prototype_session='))?.slice(18);
    if (!raw) return null;
    const session = this.store.get('sessions', tokenHash(raw), false);
    if (!session || session.expires_at < Date.now()) return null;
    return { ...session, user: this.publicUser(this.store.get('users', session.user_id)) };
  }
}
