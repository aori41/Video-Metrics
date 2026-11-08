const RETRYABLE_CLIENT_STATUSES = [408, 429];
const NETWORK_FAILURE_STATUS = 0;

export class ApiRequestError extends Error {
  readonly status: number;
  readonly retryable: boolean;

  constructor(message: string, status: number = NETWORK_FAILURE_STATUS) {
    super(message);
    this.status = status;
    this.retryable =
      status === NETWORK_FAILURE_STATUS ||
      status >= 500 ||
      RETRYABLE_CLIENT_STATUSES.includes(status);
  }
}
