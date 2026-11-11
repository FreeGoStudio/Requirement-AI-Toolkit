import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export async function probe(url, fetcher = fetch) {
  try {
    const response = await fetcher(url, { signal: AbortSignal.timeout(10000), redirect: 'manual' });
    return { url, status: response.status, reachable: true, endpoint_ok: response.ok,
      authenticated: false, note: '连通性检查不代表认证、权限或业务验收通过' };
  } catch (error) {
    return { url, reachable: false, error: error.cause?.code || error.name };
  }
}

export async function doctor() {
  let git;
  try { git = execFileSync('git', ['--version'], { encoding: 'utf8' }).trim(); }
  catch { git = 'unavailable'; }
  return {
    checked_at: new Date().toISOString(), node: process.version, git,
    services: await Promise.all([
      probe(`${process.env.GITLAB_URL || 'http://127.0.0.1:8929'}/users/sign_in`),
      probe(`${process.env.PLANE_URL || 'http://127.0.0.1:8088'}/api/instances/`),
      probe(`${process.env.STORYBOOK_URL || 'http://127.0.0.1:6006'}/index.json`)
    ])
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await doctor();
  console.log(JSON.stringify(result, null, 2));
  if (result.services.some(service => !service.endpoint_ok)) process.exitCode = 1;
}
