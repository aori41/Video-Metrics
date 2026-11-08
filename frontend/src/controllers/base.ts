import axios, { type AxiosResponse } from 'axios';
import { appConfig } from '../config/env';
import type { ApiErrorBody } from '../types/api';
import { ApiRequestError } from './ApiRequestError';

const UNREACHABLE_MESSAGE = 'Could not reach the server. Check the connection and try again.';

// Axios returns a body it cannot parse as a string. A host answering 200 with
// an HTML page must not count as a saved batch.
function rejectUnparsedBody(response: AxiosResponse): AxiosResponse {
  if (typeof response.data === 'string') throw new ApiRequestError(UNREACHABLE_MESSAGE);
  return response;
}

function throwRequestError(error: unknown): never {
  if (!axios.isAxiosError<ApiErrorBody>(error) || !error.response) {
    throw new ApiRequestError(UNREACHABLE_MESSAGE);
  }
  const { status, data } = error.response;
  throw new ApiRequestError(data?.error?.message ?? `The server returned status ${status}`, status);
}

export class BaseController {
  // The fetch adapter is used because XHR cannot keep sending after the tab closes.
  protected readonly client = axios.create({
    baseURL: appConfig.apiBaseUrl.replace(/\/$/, ''),
    timeout: appConfig.requestTimeoutMs,
    adapter: 'fetch',
    // Axios would add this header, and CORS only allows the headers the API expects.
    headers: { 'User-Agent': false },
  });

  constructor() {
    this.client.interceptors.response.use(rejectUnparsedBody, throwRequestError);
  }
}
