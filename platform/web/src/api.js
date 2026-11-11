let csrf;
export async function api(path, body) {
  const response = await fetch(`/api${path}`, { method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(body === undefined ? {} : { 'X-CSRF-Token': csrf || '', 'Idempotency-Key': crypto.randomUUID() }) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.message || '操作失败'), { status: response.status });
  if (data.csrf) csrf = data.csrf;
  return data;
}
export const artifactUrl = (build, origin = 'http://127.0.0.1:3078') => `${origin}/artifacts/${build}/index.html`;
