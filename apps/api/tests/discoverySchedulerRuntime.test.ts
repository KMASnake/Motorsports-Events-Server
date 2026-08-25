import { describe, expect, it, vi } from 'vitest';
import { DiscoverySchedulerRuntime } from '../src/providers/discoverySchedulerRuntime.js';

describe('periodic discovery runtime', () => {
  it('uses the persistent scheduler lease and releases it after periodic discovery', async () => {
    const scheduler = {
      acquireDueDiscovery: vi.fn().mockResolvedValue({ id: 'provider-a', discovery_lease_generation: 7 }),
      config: vi.fn().mockResolvedValue({ heartbeat_seconds: 30 }),
      heartbeatDiscovery: vi.fn(),
      releaseDiscovery: vi.fn().mockResolvedValue({ id: 'provider-a' })
    };
    const discovery = { discover: vi.fn().mockResolvedValue({ status: 'deferred_quota' }) };
    const logger = { error: vi.fn() };
    const runtime = new DiscoverySchedulerRuntime(scheduler as never, discovery as never, logger as never);
    await runtime.runOnce();
    expect(scheduler.acquireDueDiscovery).toHaveBeenCalledOnce();
    expect(discovery.discover).toHaveBeenCalledWith('provider-a', 'periodic', expect.any(Object), expect.any(Function));
    expect(scheduler.releaseDiscovery).toHaveBeenCalledWith('provider-a', expect.stringMatching(/^discovery:/), 7);
  });

  it('cannot duplicate work when PostgreSQL returns no lease', async () => {
    const scheduler = { acquireDueDiscovery: vi.fn().mockResolvedValue(null) };
    const discovery = { discover: vi.fn() };
    const runtime = new DiscoverySchedulerRuntime(scheduler as never, discovery as never, { error: vi.fn() } as never);
    await runtime.runOnce();
    expect(discovery.discover).not.toHaveBeenCalled();
  });

  it('waits for in-flight work during graceful shutdown', async () => {
    vi.useFakeTimers();
    let finishDiscovery!: () => void;
    const discoveryPending = new Promise<void>((resolve) => { finishDiscovery = resolve; });
    const scheduler = {
      acquireDueDiscovery: vi.fn().mockResolvedValue({ id: 'provider-a', discovery_lease_generation: 3 }),
      config: vi.fn().mockResolvedValue({ heartbeat_seconds: 30 }),
      heartbeatDiscovery: vi.fn(),
      releaseDiscovery: vi.fn().mockResolvedValue({ id: 'provider-a' })
    };
    const discovery = { discover: vi.fn().mockReturnValue(discoveryPending) };
    const runtime = new DiscoverySchedulerRuntime(
      scheduler as never,
      discovery as never,
      { error: vi.fn() } as never
    );

    runtime.start();
    await vi.advanceTimersByTimeAsync(0);
    let stopped = false;
    const shutdown = runtime.stop().then(() => { stopped = true; });
    await Promise.resolve();
    expect(stopped).toBe(false);

    finishDiscovery();
    await shutdown;
    expect(scheduler.releaseDiscovery).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
