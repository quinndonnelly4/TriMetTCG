import type { IncomingMessage, ServerResponse } from 'http';

const TRIMET_ORIGIN = 'https://developer.trimet.org';

const ALLOWED_PATHS = new Set(['/ws/v2/vehicles']);

const ALLOWED_PARAMS = new Set(['json', 'onrouteonly', 'shownonrevenue']);

export function trimetAppId(env: Record<string, string>): string {
  return (env.TRIMET_APP_ID || env.VITE_TRIMET_APP_ID || '').trim();
}

function apiPath(url: URL): string {
  let path = url.pathname;
  path = path.replace(/^\/\.netlify\/functions\/trimet/i, '');
  path = path.replace(/^\/api\/trimet/i, '');
  if (!path.startsWith('/')) path = `/${path}`;
  if (path.toLowerCase().includes('/ws/v2/vehicles')) return '/ws/v2/vehicles';
  return path;
}

export async function proxyTrimet(
  requestUrl: string,
  appId: string,
): Promise<{ status: number; body: string; contentType: string }> {
  if (!appId) {
    return { status: 503, body: JSON.stringify({ error: 'TriMet key is not configured' }), contentType: 'application/json' };
  }

  const url = new URL(requestUrl, 'http://local');
  const path = apiPath(url);
  if (!ALLOWED_PATHS.has(path.toLowerCase())) {
    return { status: 404, body: JSON.stringify({ error: 'Unknown TriMet path' }), contentType: 'application/json' };
  }

  const out = new URLSearchParams();
  url.searchParams.forEach((value, key) => {
    if (key.toLowerCase() === 'appid') return;
    if (!ALLOWED_PARAMS.has(key.toLowerCase())) return;
    out.set(key, value);
  });
  out.set('appID', appId);
  out.set('json', 'true');

  const target = `${TRIMET_ORIGIN}${path}?${out}`;
  const res = await fetch(target, { headers: { Accept: 'application/json' } });
  const body = await res.text();
  return {
    status: res.status,
    body,
    contentType: res.headers.get('content-type') || 'application/json',
  };
}

export function createTrimetMiddleware(appId: string) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const path = req.url ?? '';
    if (!path.startsWith('/api/trimet')) {
      next();
      return;
    }
    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.end();
      return;
    }
    void (async () => {
      try {
        const result = await proxyTrimet(path, appId);
        res.statusCode = result.status;
        res.setHeader('Content-Type', result.contentType);
        res.setHeader('Cache-Control', 'no-store');
        res.end(result.body);
      } catch {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'TriMet proxy failed' }));
      }
    })();
  };
}
