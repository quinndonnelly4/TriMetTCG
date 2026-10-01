import type { IncomingMessage, ServerResponse } from 'http';

const STREETCAR_URL =
  'https://retro.umoiq.com/service/publicJSONFeed?command=vehicleLocations&a=portland-sc&t=0';

export async function fetchStreetcarLocations(): Promise<{
  status: number;
  body: string;
  contentType: string;
}> {
  const res = await fetch(STREETCAR_URL, { headers: { Accept: 'application/json' } });
  const body = await res.text();
  return {
    status: res.status,
    body,
    contentType: res.headers.get('content-type') || 'application/json',
  };
}

export function createStreetcarMiddleware() {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const path = req.url ?? '';
    if (!path.startsWith('/api/streetcar')) {
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
        const result = await fetchStreetcarLocations();
        res.statusCode = result.status;
        res.setHeader('Content-Type', result.contentType);
        res.setHeader('Cache-Control', 'no-store');
        res.end(result.body);
      } catch {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Streetcar proxy failed' }));
      }
    })();
  };
}
