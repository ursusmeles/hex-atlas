import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../../functions/api/[[path]].js';

test('Cloudflare proxy forwards sessions without caching and preserves Set-Cookie headers', async (t) => {
  let forwarded;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    forwarded = { url: String(url), options };
    const response = Response.json({ ok: true });
    response.headers.append('set-cookie', 'session=one; Secure; HttpOnly');
    response.headers.append('set-cookie', 'other=two; Secure; HttpOnly');
    return response;
  });
  const response = await onRequest({
    request: new Request('https://atlas.pages.dev/api/auth/get-session', {
      headers: {
        cookie: 'session=one',
        host: 'atlas.pages.dev',
        'x-forwarded-proto': 'http',
        forwarded: 'host=evil.example',
        'cf-connecting-ip': '192.0.2.1',
        'x-hex-atlas-client-ip': 'evil',
        'x-hex-atlas-proxy-key': 'forged',
      },
    }),
    env: {
      API_ORIGIN: 'https://office.example',
      API_PROXY_SECRET: 'test-only-proxy-secret-with-more-than-32-characters',
    },
  });
  assert.equal(forwarded.url, 'https://office.example/api/auth/get-session');
  assert.equal(forwarded.options.headers.get('cookie'), 'session=one');
  assert.equal(forwarded.options.headers.get('x-forwarded-proto'), 'https');
  assert.equal(forwarded.options.headers.get('forwarded'), null);
  assert.equal(forwarded.options.headers.get('x-hex-atlas-client-ip'), '192.0.2.1');
  assert.equal(
    forwarded.options.headers.get('x-hex-atlas-proxy-key'),
    'test-only-proxy-secret-with-more-than-32-characters',
  );
  assert.equal(response.headers.getSetCookie().length, 2);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('Cloudflare proxy refuses HTTP origins, missing configuration and loops', async () => {
  for (const origin of [
    undefined,
    'http://office.example',
    'https://atlas.pages.dev',
    'https://user:pass@office.example',
  ]) {
    const response = await onRequest({
      request: new Request('https://atlas.pages.dev/api/campaigns'),
      env: { API_ORIGIN: origin },
    });
    assert.equal(response.status, 503);
  }
});
