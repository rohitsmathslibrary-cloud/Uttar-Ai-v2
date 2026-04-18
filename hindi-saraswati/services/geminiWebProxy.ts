// Web proxy service - routes all Gemini calls through Firebase Cloud Function
// This keeps the API key secure on the server side

const PROXY_URL = 'https://geminiproxy-ljtntzc7pq-el.a.run.app';

export async function callGeminiProxy(model: string, body: object): Promise<any> {
  const response = await fetch(`${PROXY_URL}?model=${encodeURIComponent(model)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini proxy error: ${response.status} ${err}`);
  }
  return response.json();
}
