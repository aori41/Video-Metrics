import { BaseController } from './base';

class HealthController extends BaseController {
  private readonly route = '/health';

  async check(): Promise<void> {
    await this.client.get(this.route);
  }
}

export const healthController = new HealthController();
