import { fetchStreetcarLocations } from '../../server/streetcar-proxy';

export async function handler(event: { httpMethod?: string }) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: '' };
  }
  const result = await fetchStreetcarLocations();
  return {
    statusCode: result.status,
    headers: { 'Content-Type': result.contentType, 'Cache-Control': 'no-store' },
    body: result.body,
  };
}
