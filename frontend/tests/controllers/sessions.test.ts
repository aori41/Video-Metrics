import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appConfig } from '../../src/config/env';
import { ApiRequestError } from '../../src/controllers/ApiRequestError';
import { sessionsController } from '../../src/controllers/sessions';
import { sampleAt } from '../helpers/fixtures';

function respondWith(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('sessionsController', () => {
  const fetchMock = vi.fn();

  function lastRequest(): Request {
    return fetchMock.mock.calls.at(-1)?.[0] as Request;
  }

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => respondWith([]));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('works when a method is called through the shared instance', async () => {
    await expect(sessionsController.listSessions()).resolves.toEqual([]);

    const request = lastRequest();
    expect(request.url).toBe(`${appConfig.apiBaseUrl}/sessions`);
    expect(request.method).toBe('GET');
  });

  it('sends no header that the CORS preflight would reject', async () => {
    await sessionsController.listSessions();

    expect(lastRequest().headers.get('User-Agent')).toBeNull();
  });

  it('creates a session with the idempotency key and no body', async () => {
    await sessionsController.createSession('key-1');

    const request = lastRequest();
    expect(request.url).toBe(`${appConfig.apiBaseUrl}/sessions`);
    expect(request.headers.get('Idempotency-Key')).toBe('key-1');
    expect(request.body).toBeNull();
  });

  it('sends samples in the shape the API expects', async () => {
    await sessionsController.sendSamples('s1', [sampleAt(1)]);

    const request = lastRequest();
    expect(request.url).toBe(`${appConfig.apiBaseUrl}/sessions/s1/samples`);
    await expect(request.text()).resolves.toBe(JSON.stringify({ samples: [sampleAt(1)] }));
  });

  it('sends the last samples with keepalive when the page closes', async () => {
    sessionsController.sendSamplesKeepalive('s1', [sampleAt(1)]);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const request = lastRequest();
    expect(request.url).toBe(`${appConfig.apiBaseUrl}/sessions/s1/samples`);
    expect(request.keepalive).toBe(true);
  });

  it('sends the produced sample count as JSON on Stop', async () => {
    await sessionsController.stopSession('s1', 7);

    const request = lastRequest();
    expect(request.url).toBe(`${appConfig.apiBaseUrl}/sessions/s1/stop`);
    expect(request.headers.get('Content-Type')).toBe('application/json');
    await expect(request.text()).resolves.toBe(JSON.stringify({ samples_produced: 7 }));
  });

  it('starts tab-close requests before the page can unload, marked keepalive', () => {
    sessionsController.stopSessionKeepalive('s1', 3);

    const request = lastRequest();
    expect(request.url).toBe(`${appConfig.apiBaseUrl}/sessions/s1/stop`);
    expect(request.keepalive).toBe(true);
  });

  it('rejects with the server message, not retryable, on a 4xx', async () => {
    fetchMock.mockImplementation(async () =>
      respondWith({ error: { message: 'Invalid sample' } }, 422),
    );

    const error = await sessionsController.getSession('s1').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ message: 'Invalid sample', status: 422, retryable: false });
  });

  it('keeps the status of an error response that is not JSON', async () => {
    fetchMock.mockImplementation(async () => new Response('<html>', { status: 404 }));

    const error = await sessionsController.getSession('s1').catch((caught: unknown) => caught);

    expect(error).toMatchObject({ status: 404, retryable: false });
  });

  it('rejects as retryable on a network failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('network down'));

    const error = await sessionsController.listSessions().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ retryable: true });
  });

  it('rejects as retryable when a 200 response is not JSON', async () => {
    fetchMock.mockImplementation(async () => new Response('<html>', { status: 200 }));

    const error = await sessionsController.listSessions().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ retryable: true });
  });
});
