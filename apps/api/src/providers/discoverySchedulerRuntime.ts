import { randomUUID } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import type { ProviderDiscoveryService } from './discoveryService.js';
import type { PersistentSchedulerService } from './schedulerService.js';

type Timer = ReturnType<typeof setTimeout>;
type RuntimeOptions = { keepProcessAlive?: boolean };

export class DiscoverySchedulerRuntime {
  readonly workerId = `discovery:${process.pid}:${randomUUID()}`;
  private stopped = true;
  private pollTimer?: Timer;
  private current?: Promise<void>;

  constructor(
    private readonly scheduler: PersistentSchedulerService,
    private readonly discovery: ProviderDiscoveryService,
    private readonly logger: FastifyBaseLogger,
    private readonly pollMilliseconds = 15_000,
    private readonly options: RuntimeOptions = {}
  ) {}

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.schedule(0);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    await this.current;
  }

  private schedule(delay: number): void {
    if (this.stopped) return;
    this.pollTimer = setTimeout(() => {
      this.current = this.runOnce().finally(() => {
        this.current = undefined;
        this.schedule(this.pollMilliseconds);
      });
    }, delay);
    if (!this.options.keepProcessAlive) this.pollTimer.unref();
  }

  async runOnce(): Promise<void> {
    let lease: Awaited<ReturnType<PersistentSchedulerService['acquireDueDiscovery']>>;
    try {
      lease = await this.scheduler.acquireDueDiscovery(this.workerId);
    } catch (error) {
      this.logger.error({ error }, 'Periodic discovery scheduler acquisition failed');
      return;
    }
    if (!lease) return;

    const generation = Number(lease.discovery_lease_generation);
    const config = await this.scheduler.config();
    let heartbeat: Timer | undefined;
    let leaseLost = false;
    const renew = async () => {
      try {
        await this.scheduler.heartbeatDiscovery(lease.id, this.workerId, generation);
        heartbeat = setTimeout(renew, config.heartbeat_seconds * 1000);
        if (!this.options.keepProcessAlive) heartbeat.unref();
      } catch {
        leaseLost = true;
      }
    };
    heartbeat = setTimeout(renew, config.heartbeat_seconds * 1000);
    if (!this.options.keepProcessAlive) heartbeat.unref();

    try {
      await this.discovery.discover(lease.id, 'periodic', {
        principal: { sub: this.workerId, role: 'admin', exp: 2_147_483_647, auth_method: 'technical_hmac' },
        requestId: randomUUID()
      }, () => this.scheduler.assertDiscoveryLease(lease.id, this.workerId, generation));
      if (leaseLost) throw new Error('Discovery lease lost before completion');
      await this.scheduler.releaseDiscovery(lease.id, this.workerId, generation);
    } catch (error) {
      this.logger.error({ providerId: lease.id, error }, 'Periodic provider discovery failed');
      try { await this.scheduler.releaseDiscovery(lease.id, this.workerId, generation); } catch { /* lease already lost */ }
    } finally {
      if (heartbeat) clearTimeout(heartbeat);
    }
  }
}
