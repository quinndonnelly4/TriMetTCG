import { proxyTrimet, trimetAppId } from '../../server/trimet-proxy';

type NetlifyEvent = {
  httpMethod?: string;
  path?: string;
  rawUrl?: string;
  rawQuery?: string;
  queryStringParameters?: Record<string, string | undefined> | null;
};

function pathAndQueryFromEvent(event: NetlifyEvent): string {
  if (event.rawUrl) {
    const url = new URL(event.rawUrl);
    return `${url.pathname}${url.search}`;
  }

  const suffix = (event.path ?? '')
    .replace(/^\/\.netlify\/functions\/trimet/i, '')
    .replace(/^\/api\/trimet/i, '');
  const fromParams = event.queryStringParameters
    ? new URLSearchParams(
        Object.entries(event.queryStringParameters).filter((entry): entry is [string, string] => Boolean(entry[1])),
      ).toString()
    : '';
  const qs = event.rawQuery ? event.rawQuery : fromParams;
  const path = suffix.startsWith('/') ? suffix : `/${suffix}`;
  return `/api/trimet${path === '/' ? '' : path}${qs ? `?${qs}` : ''}`;
}

export async function handler(event: NetlifyEvent) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: '' };
  }
  const result = await proxyTrimet(
    pathAndQueryFromEvent(event),
    trimetAppId({
      TRIMET_APP_ID: process.env.TRIMET_APP_ID ?? '',
      VITE_TRIMET_APP_ID: process.env.VITE_TRIMET_APP_ID ?? '',
    }),
  );
  return {
    statusCode: result.status,
    headers: { 'Content-Type': result.contentType, 'Cache-Control': 'no-store' },
    body: result.body,
  };
}
