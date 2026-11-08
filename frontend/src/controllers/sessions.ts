import type { AxiosRequestConfig } from 'axios';
import type { SessionCreated, SessionDetail, SessionRecord } from '../types/api';
import type { ISessionApi } from '../types/contracts';
import type { Sample } from '../types/metrics';
import { BaseController } from './base';

const KEEPALIVE_REQUEST: AxiosRequestConfig = { timeout: 0, fetchOptions: { keepalive: true } };

class SessionsController extends BaseController implements ISessionApi {
  private readonly route = '/sessions';

  async createSession(idempotencyKey: string): Promise<SessionCreated> {
    const res = await this.client.post<SessionCreated>(this.route, undefined, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    return res.data;
  }

  async sendSamples(sessionId: string, samples: Sample[]): Promise<void> {
    await this.client.post(`${this.route}/${sessionId}/samples`, { samples });
  }

  sendSamplesKeepalive(sessionId: string, samples: Sample[]): void {
    this.client
      .post(`${this.route}/${sessionId}/samples`, { samples }, KEEPALIVE_REQUEST)
      .catch(() => undefined);
  }

  async listSessions(): Promise<SessionRecord[]> {
    const res = await this.client.get<SessionRecord[]>(this.route);
    return res.data;
  }

  async getSession(sessionId: string): Promise<SessionDetail> {
    const res = await this.client.get<SessionDetail>(`${this.route}/${sessionId}`);
    return res.data;
  }

  async stopSession(sessionId: string, samplesProduced: number): Promise<SessionRecord> {
    const res = await this.client.post<SessionRecord>(`${this.route}/${sessionId}/stop`, {
      samples_produced: samplesProduced,
    });
    return res.data;
  }

  stopSessionKeepalive(sessionId: string, samplesProduced: number): void {
    this.client
      .post(
        `${this.route}/${sessionId}/stop`,
        { samples_produced: samplesProduced },
        KEEPALIVE_REQUEST,
      )
      .catch(() => undefined);
  }
}

export const sessionsController = new SessionsController();
